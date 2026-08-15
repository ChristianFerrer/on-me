import { assertNoQueryError, db } from "@/lib/db/client";
import { firstName } from "@/lib/scan-service";
import type { Edge, GiftGraph, Node, NodeState } from "@/lib/giftGraph/types";

const ESTABLISHMENT_ID = "shop";

/**
 * El grafo real de saltos, de la tabla de verdad: el padrino de cada cliente
 * sale de `invitations` (padrino_id → claimed_by, igual que `referralTree`),
 * y el estado de cada salto sale de `attributions` una vez canjeado, o del
 * propio estado de la invitación mientras sigue pendiente.
 *
 * Dos decisiones que no salen solas de las tablas:
 *
 * - Una invitación sin reclamar todavía no tiene nombre -createInvitation no
 *   pide el nombre de a quién se invita, eso llega en el claim-, así que ese
 *   nodo va con `claimed: false` y sin nombre. El código de invitación es un
 *   dato interno: no debe verse nunca en el mapa ni en la ficha.
 * - Todo cliente sin padrino (alta directa por QR, no por invitación) es
 *   raíz de su propia cadena, tenga o no descendencia: este mapa es el
 *   sitio donde el dueño cuenta cuántos clientes tiene, no solo cuántas
 *   historias de referidos existen, así que un cliente que entró solo,
 *   con su tarjeta virtual, también tiene que aparecer como un punto.
 *   Va en estado "direct" -no pasa por `attributions`, esa tabla solo
 *   existe para pares padrino/ahijado-.
 */
export async function loadRealGiftGraph(shopId: string, establishmentName: string): Promise<GiftGraph> {
  const [
    { data: customers, error: custErr },
    { data: invitations, error: invErr },
    { data: attributions, error: attrErr },
  ] = await Promise.all([
    db().from("customers").select("id, name, created_at").eq("shop_id", shopId),
    db()
      .from("invitations")
      .select("id, padrino_id, claimed_by, state, code, created_at, sent_at, opened_at, claimed_at, expires_at")
      .eq("shop_id", shopId),
    db().from("attributions").select("padrino_id, ahijado_id, redeemed_at, returned_at, state").eq("shop_id", shopId),
  ]);
  assertNoQueryError(custErr, `customers.shop_id=${shopId}`);
  assertNoQueryError(invErr, `invitations.shop_id=${shopId}`);
  assertNoQueryError(attrErr, `attributions.shop_id=${shopId}`);

  const customerRows = customers ?? [];
  const customerIds = customerRows.map((c) => c.id);

  const { data: passes, error: passErr } = customerIds.length
    ? await db().from("passes").select("customer_id, stamps, updated_at").in("customer_id", customerIds)
    : { data: [], error: null };
  assertNoQueryError(passErr, `passes.customer_id in shop=${shopId}`);

  const names = new Map(customerRows.map((c) => [c.id, firstName(c.name)]));
  const createdAtOf = new Map(customerRows.map((c) => [c.id, c.created_at]));
  const passByCustomer = new Map((passes ?? []).map((p) => [p.customer_id, p]));
  const attrByAhijado = new Map((attributions ?? []).map((a) => [a.ahijado_id, a]));
  const invs = invitations ?? [];

  const nodeIdOf = (inv: (typeof invs)[number]) => inv.claimed_by ?? `inv:${inv.id}`;
  const invByChildId = new Map(invs.map((inv) => [nodeIdOf(inv), inv]));

  const childrenOf = new Map<string, string[]>();
  const edges: Edge[] = [];
  for (const inv of invs) {
    const childId = nodeIdOf(inv);
    edges.push({ from: inv.padrino_id, to: childId, giftedAt: inv.sent_at ?? inv.created_at });
    childrenOf.set(inv.padrino_id, [...(childrenOf.get(inv.padrino_id) ?? []), childId]);
  }

  const hasPadrino = new Set(invs.filter((inv) => inv.claimed_by).map((inv) => inv.claimed_by as string));
  const chainRoots = customerIds.filter((id) => !hasPadrino.has(id));
  for (const rootId of chainRoots) {
    edges.push({ from: ESTABLISHMENT_ID, to: rootId, giftedAt: createdAtOf.get(rootId) ?? new Date(0).toISOString() });
  }

  function buildNode(id: string, depth: number, rootId: string): Node {
    const childCount = (childrenOf.get(id) ?? []).length;

    if (names.has(id)) {
      const attr = attrByAhijado.get(id);
      const pass = passByCustomer.get(id);
      const stamps = pass?.stamps ?? 0;
      const inv = invByChildId.get(id);

      let state: NodeState;
      let redeemedAt: string | null = null;
      let returnedAt: string | null = null;
      let lastActivityAt: string;

      if (attr) {
        state = attr.state as NodeState;
        redeemedAt = attr.redeemed_at;
        returnedAt = attr.returned_at;
        lastActivityAt = pass?.updated_at ?? attr.returned_at ?? attr.redeemed_at;
      } else if (inv) {
        // Se dio de alta desde la invitación, pero todavía no ha canjeado
        // en barra: ya es cliente, pero attributions no nace hasta el canje.
        // Distinto de "opened" -que es todavía un prospecto sin ficha propia.
        state = "claimed";
        lastActivityAt = pass?.updated_at ?? inv.claimed_at ?? inv.opened_at ?? inv.sent_at ?? inv.created_at;
      } else {
        // Alta directa por QR, sin invitación que la traiga: cliente real,
        // pero fuera de cualquier cadena de referidos.
        state = "direct";
        lastActivityAt = pass?.updated_at ?? createdAtOf.get(id) ?? new Date(0).toISOString();
      }

      return {
        id,
        name: names.get(id) ?? "—",
        claimed: true,
        depth,
        rootId,
        state,
        stamps,
        redeemedAt,
        returnedAt,
        lastActivityAt,
        expiresAt: null,
        childCount,
        loadedChildCount: childCount,
      };
    }

    // Invitación todavía sin reclamar: sin nombre -nunca el código, es un
    // dato interno-. El sheet sustituye el nombre por un texto genérico.
    const inv = invByChildId.get(id);
    if (!inv) throw new Error(`nodo de saltos sin invitación ni cliente: ${id}`);

    const pending = inv.state === "created" || inv.state === "sent" || inv.state === "opened";
    const state: NodeState =
      inv.state === "opened" ? "opened" : pending ? "sent" : "expired"; // redeemed/claimed sin claimed_by no debería pasar; expired/void caen aquí

    return {
      id,
      name: "",
      claimed: false,
      depth,
      rootId,
      state,
      stamps: 0,
      redeemedAt: null,
      returnedAt: null,
      lastActivityAt: inv.opened_at ?? inv.sent_at ?? inv.created_at,
      expiresAt: pending ? inv.expires_at : null,
      childCount: 0,
      loadedChildCount: 0,
    };
  }

  const nodes: Node[] = [];
  const roots: string[] = [];

  function walk(id: string, depth: number, rootId: string, seen: Set<string>) {
    if (seen.has(id)) return; // guarda de cordura: no debería haber ciclos
    seen.add(id);
    nodes.push(buildNode(id, depth, rootId));
    for (const childId of childrenOf.get(id) ?? []) walk(childId, depth + 1, rootId, seen);
  }

  const seen = new Set<string>();
  for (const rootId of chainRoots) {
    roots.push(rootId);
    walk(rootId, 1, rootId, seen);
  }

  return {
    establishment: { id: ESTABLISHMENT_ID, name: establishmentName },
    roots,
    nodes,
    edges,
  };
}
