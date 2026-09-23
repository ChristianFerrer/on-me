import { NextResponse } from "next/server";
import { z } from "zod";
import { getDeviceContext } from "@/lib/auth/device";
import { normalizePhone } from "@/lib/crypto";
import { db } from "@/lib/db/client";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { firstName } from "@/lib/scan-service";

const Query = z.object({ phone: z.string().trim().min(3).max(32) });

/** Menos dígitos que esto no vale la pena preguntarle a Supabase -mismo umbral que ManualSearch.tsx-. */
const MIN_SEARCH_DIGITS = 6;

type CustomerWithPass = {
  id: string;
  name: string;
  phone_last4: string;
  passes: { stamps: number; reward_pending_count: number }[];
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
 * Dos vías a la vez, por si acaso:
 *   1. Por hash exacto -normalizado igual que en el alta-, la única vía que
 *      existía antes de guardar el teléfono en claro (migración 0003): sigue
 *      haciendo falta para los clientes dados de alta antes de ese cambio,
 *      cuyo número completo no se puede recuperar.
 *   2. Por coincidencia de los dígitos escritos al final de `phone`, para
 *      los clientes dados de alta después: no exige acertar con el `+` ni
 *      con el prefijo de país -la ambigüedad real que hacía fallar la
 *      búsqueda con números extranjeros-, así que basta con teclear el
 *      número tal cual se lee.
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

  const digits = parsed.data.phone.replace(/\D/g, "");
  const normalized = normalizePhone(parsed.data.phone, ctx.shop.default_country_code);

  const filters: string[] = [];
  if (normalized) filters.push(`phone_hash.eq.${normalized.hash}`);
  // Los dígitos ya vienen limpios de `replace(/\D/g, "")`: no hay comas ni
  // comodines que puedan colarse en el propio filtro `.or()`.
  if (digits.length >= MIN_SEARCH_DIGITS) filters.push(`phone.ilike.%${digits}`);

  if (filters.length === 0) {
    return NextResponse.json({ hits: [] });
  }

  const { data } = await db()
    .from("customers")
    .select("id, name, phone_last4, passes(stamps, reward_pending_count)")
    .eq("shop_id", ctx.shop.id)
    .or(filters.join(","))
    .order("created_at", { ascending: false })
    .limit(5)
    .returns<CustomerWithPass[]>();

  const hits: SearchHit[] = (data ?? []).map((row) => ({
    id: row.id,
    name: firstName(row.name),
    last4: row.phone_last4,
    stamps: row.passes[0]?.stamps ?? 0,
    goal: ctx.shop.stamps_goal,
    rewardPending: (row.passes[0]?.reward_pending_count ?? 0) > 0,
  }));

  return NextResponse.json({ hits });
}
