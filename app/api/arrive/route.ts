import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getArrivalStatus, registerArrival } from "@/lib/arrivals";
import { assertNoQueryError, db } from "@/lib/db/client";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { readCustomerToken } from "@/lib/session";

const Body = z.object({
  shop: z.string().trim().min(1).max(64),
});

/**
 * Check-in con el QR fijo de barra: el cliente que ya tiene tarjeta avisa
 * de que está en el mostrador. No sella nada -ver lib/arrivals.ts-, así que
 * lo único que protege el límite es que la lista de barra no se llene de
 * ruido desde un script.
 */
export async function POST(request: Request) {
  const ipLimit = rateLimit(`arrive:ip:${clientIp(request.headers)}`, 30, 60_000);
  if (!ipLimit.ok) return tooMany(ipLimit.retryAfterSeconds);

  const customer = await customerFromCookie();
  if (!customer) return NextResponse.json({ error: "no_card" }, { status: 401 });

  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "bad_request" }, { status: 400 });

  const { data: shop, error } = await db()
    .from("shops")
    .select("id")
    .eq("slug", parsed.data.shop)
    .maybeSingle();

  assertNoQueryError(error, `shops.slug=${parsed.data.shop}`);
  // Tarjeta de otro local: aquí no vale, igual que al escanearla en barra.
  if (!shop || shop.id !== customer.shop_id) {
    return NextResponse.json({ error: "other_shop" }, { status: 404 });
  }

  const limit = rateLimit(`arrive:customer:${customer.id}`, 6, 60_000);
  if (!limit.ok) return tooMany(limit.retryAfterSeconds);

  const arrival = await registerArrival(shop.id, customer.id);

  return NextResponse.json({ arrivalId: arrival.id, expiresAt: arrival.expires_at });
}

/** Lo que sondea la pantalla de espera del cliente: ¿ya me han atendido? */
export async function GET(request: NextRequest) {
  const id = z.string().uuid().safeParse(request.nextUrl.searchParams.get("id"));
  if (!id.success) return NextResponse.json({ error: "bad_request" }, { status: 400 });

  const customer = await customerFromCookie();
  if (!customer) return NextResponse.json({ error: "no_card" }, { status: 401 });

  const status = await getArrivalStatus(id.data, customer.id);
  if (!status) return NextResponse.json({ error: "not_found" }, { status: 404 });

  return NextResponse.json({ status });
}

async function customerFromCookie() {
  const token = await readCustomerToken();
  if (!token) return null;

  const { data, error } = await db()
    .from("customers")
    .select("id, shop_id")
    .eq("token", token)
    .maybeSingle();

  assertNoQueryError(error, "customers.token");
  return data;
}

function tooMany(retryAfterSeconds: number) {
  return NextResponse.json(
    { error: "rate" },
    { status: 429, headers: { "retry-after": String(retryAfterSeconds) } },
  );
}
