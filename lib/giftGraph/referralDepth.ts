/**
 * Profundidad de red -saltos desde el local-, compartida entre la
 * constelación y la página de métricas: si cada una calculara la suya por su
 * cuenta, un día darían números distintos para la misma pregunta, que es
 * justo lo que la spec de métricas llama "bug bloqueante".
 */

/** Cliente sin padrino -alta directa por QR-, raíz de su propia cadena. */
export function findChainRoots(
  customerIds: string[],
  invitations: { claimed_by: string | null }[],
): string[] {
  const hasPadrino = new Set(
    invitations.filter((inv) => inv.claimed_by).map((inv) => inv.claimed_by as string),
  );
  return customerIds.filter((id) => !hasPadrino.has(id));
}

export type ReferralDepth = { depth: number; rootId: string };

/**
 * Profundidad de cada nodo alcanzable desde las raíces, recorriendo
 * padrino → invitado. `childrenOf` no tiene que mapear solo entre clientes
 * reales -la constelación también da profundidad a invitaciones sin
 * reclamar, con un id sintético para ese nodo-, así que quien construye el
 * árbol decide qué id le corresponde a cada hijo.
 *
 * Recorrido en memoria, no CTE recursivo en SQL: a la escala de un piloto de
 * un solo local -cientos de filas, no millones- es más simple de mantener.
 */
export function computeReferralDepth(
  chainRoots: string[],
  childrenOf: Map<string, string[]>,
): Map<string, ReferralDepth> {
  const depthById = new Map<string, ReferralDepth>();
  const seen = new Set<string>();

  function walk(id: string, depth: number, rootId: string) {
    if (seen.has(id)) return; // guarda de cordura: no debería haber ciclos
    seen.add(id);
    depthById.set(id, { depth, rootId });
    for (const childId of childrenOf.get(id) ?? []) walk(childId, depth + 1, rootId);
  }

  for (const rootId of chainRoots) walk(rootId, 1, rootId);
  return depthById;
}
