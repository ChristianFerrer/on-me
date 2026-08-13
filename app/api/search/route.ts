import { NextResponse } from "next/server";
import { z } from "zod";
import { getDeviceContext } from "@/lib/auth/device";
import { db } from "@/lib/db/client";
import { firstName } from "@/lib/scan-service";

const Query = z.object({ last4: z.string().regex(/^\d{4}$/) });

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
 * Búsqueda por los cuatro últimos dígitos, el plan B de la barra.
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

  const url = new URL(request.url);
  const parsed = Query.safeParse({ last4: url.searchParams.get("last4") ?? "" });
  if (!parsed.success) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  const { data } = await db()
    .from("customers")
    .select("id, name, phone_last4, passes(stamps, reward_pending)")
    .eq("shop_id", ctx.shop.id)
    .eq("phone_last4", parsed.data.last4)
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
