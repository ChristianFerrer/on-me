import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db/client";
import { newToken, normalizeInviteCode, normalizePhone } from "@/lib/crypto";
import type { InvitationState } from "@/lib/db/types";
import { LOCALES } from "@/lib/i18n";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { writeCustomerCookie } from "@/lib/session";

const Body = z.object({
  code: z.string().trim().min(4).max(12),
  name: z.string().trim().min(1).max(80),
  phone: z.string().trim().min(5).max(32),
  consent: z.literal(true),
  locale: z.enum(LOCALES).optional(),
});

const CLAIMABLE: InvitationState[] = ["created", "sent", "opened"];

/**
 * El invitado acepta el café.
 *
 * Aquí vive la detección de "ya era cliente", que es la condición 1 de las
 * cinco del Cliente Nuevo Verificado. Si el teléfono ya existe en este local,
 * la invitación se anula: no se emite café gratis y no se genera atribución.
 *
 * Es la regla que hace que la factura sea defendible. Sin ella, cualquiera
 * podría "invitar" a un habitual y cobrarlo como cliente nuevo.
 */
export async function POST(request: Request) {
  const limit = rateLimit(`claim:${clientIp(request.headers)}`, 20, 60_000);
  if (!limit.ok) {
    return NextResponse.json(
      { error: "rate" },
      { status: 429, headers: { "retry-after": String(limit.retryAfterSeconds) } },
    );
  }

  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    const field = parsed.error.issues[0]?.path[0];
    return NextResponse.json(
      { error: field === "consent" ? "consent" : "bad_request" },
      { status: 400 },
    );
  }

  const { code, name, phone, locale } = parsed.data;

  const { data: invitation } = await db()
    .from("invitations")
    .select("id, shop_id, state, expires_at")
    .eq("code", normalizeInviteCode(code))
    .maybeSingle();

  if (!invitation || !CLAIMABLE.includes(invitation.state)) {
    return NextResponse.json({ error: "invalid" }, { status: 404 });
  }

  if (new Date(invitation.expires_at) < new Date()) {
    await db()
      .from("invitations")
      .update({ state: "expired" })
      .eq("id", invitation.id);
    return NextResponse.json({ error: "expired" }, { status: 410 });
  }

  const { data: shop } = await db()
    .from("shops")
    .select("id, default_country_code, default_locale")
    .eq("id", invitation.shop_id)
    .maybeSingle();

  if (!shop) return NextResponse.json({ error: "invalid" }, { status: 404 });

  const normalized = normalizePhone(phone, shop.default_country_code);
  if (!normalized) return NextResponse.json({ error: "phone" }, { status: 400 });

  // ---------------------------------------------- ¿ya nos conocía?
  const { data: existing } = await db()
    .from("customers")
    .select("token")
    .eq("shop_id", shop.id)
    .eq("phone_hash", normalized.hash)
    .maybeSingle();

  if (existing) {
    // Condicionado al estado -no solo al id-: si otra petición concurrente
    // para el mismo código ya lo reclamó de verdad justo antes de que esta
    // llegue aquí, esto no debe pisarle su "claimed" con un "void".
    await db().from("invitations").update({ state: "void" }).eq("id", invitation.id).in("state", CLAIMABLE);
    await writeCustomerCookie(existing.token);

    // Se le devuelve su tarjeta con sus sellos, pero ni café ni atribución.
    return NextResponse.json(
      { error: "existing_customer", token: existing.token },
      { status: 200 },
    );
  }

  const token = newToken();

  const { data: customer, error } = await db()
    .from("customers")
    .insert({
      shop_id: shop.id,
      name,
      phone_hash: normalized.hash,
      phone_last4: normalized.last4,
      token,
      source: "invitation",
      locale: locale ?? shop.default_locale,
    })
    .select("id")
    .single();

  if (error || !customer) {
    return NextResponse.json({ error: "generic" }, { status: 500 });
  }

  await db().from("passes").insert({ customer_id: customer.id });

  // Condicionado a que el estado siga siendo reclamable, no solo al id: la
  // comprobación de arriba (línea 55) y esta escritura son dos viajes
  // separados a la base de datos, así que dos peticiones concurrentes para
  // el mismo código -con dos teléfonos distintos- podían pasar ambas la
  // comprobación antes de que ninguna escribiera, crear cada una su propio
  // cliente, y la segunda escritura ganar `claimed_by` dejando al cliente
  // de la primera huérfano -sin invitación que canjear nunca, gastando de
  // todos modos un hueco de invitación del padrino. Con la condición, solo
  // una escritura afecta a alguna fila; la otra lo sabe por `claimedRows`
  // vacío y deshace el cliente que acaba de crear en vez de dejarlo suelto.
  const { data: claimedRows } = await db()
    .from("invitations")
    .update({
      state: "claimed",
      claimed_at: new Date().toISOString(),
      claimed_by: customer.id,
    })
    .eq("id", invitation.id)
    .in("state", CLAIMABLE)
    .select("id");

  if (!claimedRows?.length) {
    await db().from("passes").delete().eq("customer_id", customer.id);
    await db().from("customers").delete().eq("id", customer.id);
    return NextResponse.json({ error: "invalid" }, { status: 404 });
  }

  await writeCustomerCookie(token);

  return NextResponse.json({ token, existing: false });
}
