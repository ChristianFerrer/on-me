import type { Edge, GiftGraph, Node } from "@/lib/giftGraph/types";

/**
 * Recorta el grafo real de todo el local al subárbol de un solo cliente:
 * solo la gente que él invitó, y la que esas personas a su vez invitaron.
 * Nunca la red entera -eso expondría a otros clientes del local por
 * nombre, y esta vista la sirve un endpoint con sesión de cliente, no de
 * dueño-.
 *
 * Re-enraizado en `customerId`, no un simple filtro: `establishment` pasa
 * a ser el propio cliente. `layoutConstelacion` calcula su propia
 * profundidad con un recorrido desde `establishmentId` -no lee
 * `node.depth`-, así que reutilizarlo aquí "sencillamente funciona" sin
 * tener que recalcular esos campos, aunque sigan reflejando la profundidad
 * real del local completo en vez de la relativa a este cliente.
 */
export function customerSubgraph(full: GiftGraph, customerId: string, customerName: string): GiftGraph {
  const childrenOf = new Map<string, string[]>();
  for (const edge of full.edges) {
    childrenOf.set(edge.from, [...(childrenOf.get(edge.from) ?? []), edge.to]);
  }

  const included = new Set<string>();
  let frontier = childrenOf.get(customerId) ?? [];
  for (const id of frontier) included.add(id);
  while (frontier.length > 0) {
    const next: string[] = [];
    for (const id of frontier) {
      for (const childId of childrenOf.get(id) ?? []) {
        if (included.has(childId)) continue;
        included.add(childId);
        next.push(childId);
      }
    }
    frontier = next;
  }

  const nodesById = new Map(full.nodes.map((node) => [node.id, node]));
  const nodes: Node[] = [...included].map((id) => nodesById.get(id)!);
  const edges: Edge[] = full.edges.filter(
    (edge) => (edge.from === customerId || included.has(edge.from)) && included.has(edge.to),
  );

  return {
    establishment: { id: customerId, name: customerName },
    roots: childrenOf.get(customerId) ?? [],
    nodes,
    edges,
  };
}
