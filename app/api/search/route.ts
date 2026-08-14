import { NextResponse } from "next/server";
import { z } from "zod";
import { getDeviceContext } from "@/lib/auth/device";
import { normalizePhone } from "@/lib/crypto";
import { db } from "@/lib/db/client";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { firstName } from "@/lib/scan-service";

const Query = z.object({ phone: z.string().trim().min(3).max(32) });

type CustomerWithPass = {
  id: string;
  name: string;
  phone_last4: string;
  passes: { stamps: number; reward_pending: boolean }[];
};

export type SearchHit = {
  id: string;
  name: string;
  last4: string;
  stamps: number;
  goal: number;
  rewardPending: boolean;
};

/**
 * Búsqueda por el móvil completo, el plan B de la barra.
 *
 * El teléfono nunca se guarda en claro, así que se normaliza igual que en el
 * alta y se compara por hash: una coincidencia exacta, no un patrón sobre
 * cuatro dígitos que podían tocarle a varios clientes a la vez.
 *
 * Nunca devuelve el token del cliente: es su identidad al portador y no tiene
 * por qué acabar en el localStorage de un iPad compartido. Para sellar basta
 * el id, y para devolverle la tarjeta está el QR de `/s/cliente/[id]`.
 */
export async function GET(request: Request) {
  const ctx = await getDeviceContext();
  if (!ctx) {
    return NextResponse.json({ error: "device_session" }, { status: 401 });
  }

  const limit = rateLimit(`search:${clientIp(request.headers)}`, 30, 60_000);
  if (!limit.ok) {
    return NextResponse.json({ error: "rate" }, { status: 429 });
  }

  const url = new URL(request.url);
  const parsed = Query.safeParse({ phone: url.searchParams.get("phone") ?? "" });
  if (!parsed.success) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  const normalized = normalizePhone(parsed.data.phone, ctx.shop.default_country_code);
  if (!normalized) {
    return NextResponse.json({ hits: [] });
  }

  const { data } = await db()
    .from("customers")
    .select("id, name, phone_last4, passes(stamps, reward_pending)")
    .eq("shop_id", ctx.shop.id)
    .eq("phone_hash", normalized.hash)
    .order("created_at", { ascending: false })
    .limit(5)
    .returns<CustomerWithPass[]>();

  const hits: SearchHit[] = (data ?? []).map((row) => ({
    id: row.id,
    name: firstName(row.name),
    last4: row.phone_last4,
    stamps: row.passes[0]?.stamps ?? 0,
    goal: ctx.shop.stamps_goal,
    rewardPending: row.passes[0]?.reward_pending ?? false,
  }));

  return NextResponse.json({ hits });
}
