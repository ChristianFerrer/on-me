import { NextResponse } from "next/server";
import { customerSubgraph } from "@/lib/giftGraph/customerSubgraph";
import { loadRealGiftGraph } from "@/lib/giftGraph/loadRealGiftGraph";
import { loadCard } from "@/lib/card";
import { firstName } from "@/lib/scan-service";
import { readCustomerToken } from "@/lib/session";

/**
 * La constelación del propio cliente: a quién invitó, y a quién invitaron
 * esos. Sesión de cliente, no de dueño -a diferencia de
 * /api/admin/constelacion-, así que nunca puede servir la red completa del
 * local: se pide el grafo real entero en el servidor, pero solo sale de
 * aquí el subárbol ya recortado a este cliente.
 */
export async function GET() {
  const token = await readCustomerToken();
  const card = token ? await loadCard(token) : null;
  if (!card) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const full = await loadRealGiftGraph(card.shop.id, card.shop.name);
  const graph = customerSubgraph(full, card.customer.id, firstName(card.customer.name));
  return NextResponse.json({ graph });
}
