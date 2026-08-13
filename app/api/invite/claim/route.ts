import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db/client";
import { newToken, normalizeInviteCode, normalizePhone } from "@/lib/crypto";
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

const CLAIMABLE = ["created", "sent", "opened"];

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
    await db().from("invitations").update({ state: "void" }).eq("id", invitation.id);
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

  await db()
    .from("invitations")
    .update({
      state: "claimed",
      claimed_at: new Date().toISOString(),
      claimed_by: customer.id,
    })
    .eq("id", invitation.id);

  await writeCustomerCookie(token);

  return NextResponse.json({ token, existing: false });
}
