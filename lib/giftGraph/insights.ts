import type { Edge, Node } from "@/lib/giftGraph/types";

const DAY_MS = 86_400_000;
/** Del todo apagado a partir de aquí: un mes sin actividad ya no brilla nada. */
const STALE_AFTER_DAYS = 30;
/** Por debajo de esto, una invitación pendiente pulsa en alerta. */
const EXPIRING_SOON_HOURS = 24;

/**
 * Cuánto brilla un nodo según su última actividad: 1 = hoy, 0 = un mes o
 * más sin moverse. Interpolación suave (smoothstep), no un corte seco.
 */
export function recencyFactor(lastActivityAt: string, now: number): number {
  const ageDays = Math.max(0, (now - new Date(lastActivityAt).getTime()) / DAY_MS);
  const t = Math.min(1, ageDays / STALE_AFTER_DAYS);
  const eased = t * t * (3 - 2 * t);
  return 1 - eased;
}

/** Una invitación pendiente (sent/opened) está a punto de caducar. */
export function isExpiringSoon(expiresAt: string | null, now: number): boolean {
  if (!expiresAt) return false;
  const hoursLeft = (new Date(expiresAt).getTime() - now) / 3_600_000;
  return hoursLeft > 0 && hoursLeft <= EXPIRING_SOON_HOURS;
}

/**
 * El nodo con más descendencia facturable: el mejor padrino de toda la
 * red visible, no solo de su propia cadena. `null` si nadie tiene
 * descendencia facturable todavía.
 */
export function bestPadrinoId(nodes: Node[], edges: Edge[]): string | null {
  const childrenOf = new Map<string, string[]>();
  for (const edge of edges) childrenOf.set(edge.from, [...(childrenOf.get(edge.from) ?? []), edge.to]);
  const stateById = new Map(nodes.map((node) => [node.id, node.state]));

  function countBillableDescendants(id: string, seen: Set<string>): number {
    let count = 0;
    for (const childId of childrenOf.get(id) ?? []) {
      if (seen.has(childId)) continue; // el grafo es un árbol, pero por si acaso no hay ciclos infinitos
      seen.add(childId);
      if (stateById.get(childId) === "billable") count += 1;
      count += countBillableDescendants(childId, seen);
    }
    return count;
  }

  let bestId: string | null = null;
  let bestCount = 0;
  for (const node of nodes) {
    const count = countBillableDescendants(node.id, new Set([node.id]));
    if (count > bestCount) {
      bestCount = count;
      bestId = node.id;
    }
  }
  return bestId;
}
