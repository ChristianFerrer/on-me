import { NextResponse } from "next/server";
import { listPendingArrivals } from "@/lib/arrivals";
import { getDeviceContext } from "@/lib/auth/device";

/**
 * Lista de llegadas de la barra -ver ArrivalsTray.tsx-, sondeada cada
 * pocos segundos. Sondeo y no Realtime por lo mismo que /api/card/status:
 * el navegador nunca habla con Supabase directamente.
 */
export async function GET() {
  const ctx = await getDeviceContext();
  if (!ctx) return NextResponse.json({ error: "device_session" }, { status: 401 });

  const arrivals = await listPendingArrivals(ctx.shop);

  return NextResponse.json({ arrivals }, { headers: { "cache-control": "no-store" } });
}
