import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db/client";
import { newToken, normalizePhone } from "@/lib/crypto";
import { LOCALES } from "@/lib/i18n";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { writeCustomerCookie } from "@/lib/session";

const Body = z.object({
  shop: z.string().trim().min(1).max(64),
  name: z.string().trim().min(1).max(80),
  phone: z.string().trim().min(5).max(32),
  /** Consentimiento RGPD. Sin él no hay alta: es la base legal del tratamiento. */
  consent: z.literal(true),
  locale: z.enum(LOCALES).optional(),
});

export async function POST(request: Request) {
  const limit = rateLimit(`join:${clientIp(request.headers)}`, 20, 60_000);
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

  const { shop: slug, name, phone, locale } = parsed.data;

  const { data: shop } = await db()
    .from("shops")
    .select("id, default_country_code, default_locale")
    .eq("slug", slug)
    .maybeSingle();

  if (!shop) return NextResponse.json({ error: "shop" }, { status: 404 });

  const normalized = normalizePhone(phone, shop.default_country_code);
  if (!normalized) return NextResponse.json({ error: "phone" }, { status: 400 });

  // Ya es cliente: se le devuelve su tarjeta en vez de crear una segunda.
  // Sin esto, cambiar de móvil generaría tarjetas duplicadas y el recuento
  // de altas —el denominador de la puerta P1— dejaría de significar nada.
  const { data: existing } = await db()
    .from("customers")
    .select("token")
    .eq("shop_id", shop.id)
    .eq("phone_hash", normalized.hash)
    .maybeSingle();

  if (existing) {
    await writeCustomerCookie(existing.token);
    return NextResponse.json({ token: existing.token, existing: true });
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
      source: "qr",
      locale: locale ?? shop.default_locale,
    })
    .select("id")
    .single();

  if (error || !customer) {
    return NextResponse.json({ error: "generic" }, { status: 500 });
  }

  await db().from("passes").insert({ customer_id: customer.id });
  await writeCustomerCookie(token);

  // El teléfono en claro muere aquí: no se devuelve, no se registra y no se
  // guarda. En la base solo quedan el hash y los cuatro últimos dígitos.
  return NextResponse.json({ token, existing: false });
}
