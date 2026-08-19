import { NextResponse } from "next/server";
import { getAdminContext } from "@/lib/auth/admin";
import { loadRealGiftGraph } from "@/lib/giftGraph/loadRealGiftGraph";

/**
 * Snapshot fresco del grafo, para el sondeo periódico de la vista sol: la
 * página en sí lo carga una vez en el servidor al entrar, pero una pantalla
 * pensada para quedarse encendida en el local todo el día necesita volver a
 * pedirlo cada cierto tiempo sin recargar -así es como esa vista puede
 * reaccionar a un sello o un canje de verdad, no solo con el paso del
 * reloj-. Mismo shape que el que ya sirve la página, para que el cliente
 * pueda sustituir uno por otro sin tocar nada más.
 */
export async function GET() {
  const ctx = await getAdminContext();
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const graph = await loadRealGiftGraph(ctx.shop.id, ctx.shop.name);
  return NextResponse.json({
    graph,
    stampsGoal: ctx.shop.stamps_goal,
    returnWindowDays: ctx.shop.return_window_days,
  });
}
