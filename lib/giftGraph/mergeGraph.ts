import type { Edge, GiftGraph } from "@/lib/giftGraph/types";

function edgeKey(edge: Edge): string {
  return `${edge.from}->${edge.to}`;
}

/** Distancia en saltos desde `originId`, contando las conexiones en ambos sentidos. */
function hopDistances(originId: string, edges: Edge[]): Map<string, number> {
  const neighborsOf = new Map<string, string[]>();
  for (const edge of edges) {
    neighborsOf.set(edge.from, [...(neighborsOf.get(edge.from) ?? []), edge.to]);
    neighborsOf.set(edge.to, [...(neighborsOf.get(edge.to) ?? []), edge.from]);
  }

  const distance = new Map<string, number>([[originId, 0]]);
  let frontier = [originId];
  while (frontier.length > 0) {
    const next: string[] = [];
    for (const id of frontier) {
      const hop = distance.get(id)!;
      for (const neighbor of neighborsOf.get(id) ?? []) {
        if (distance.has(neighbor)) continue;
        distance.set(neighbor, hop + 1);
        next.push(neighbor);
      }
    }
    frontier = next;
  }
  return distance;
}

/**
 * Combina lo ya cargado con una respuesta nueva de getGiftGraph, sin duplicar
 * nodos ni conexiones, y recorta lo que ha quedado demasiado lejos del foco
 * actual para que la memoria no crezca sin límite mientras se explora.
 */
export function mergeGraph(
  prev: GiftGraph,
  incoming: GiftGraph,
  focusId: string | null,
  radius: number,
): GiftGraph {
  const nodeById = new Map(prev.nodes.map((node) => [node.id, node]));
  for (const node of incoming.nodes) {
    const existing = nodeById.get(node.id);
    nodeById.set(node.id, existing
      ? { ...node, loadedChildCount: Math.max(existing.loadedChildCount, node.loadedChildCount) }
      : node);
  }

  const edgeByKey = new Map(prev.edges.map((edge) => [edgeKey(edge), edge]));
  for (const edge of incoming.edges) edgeByKey.set(edgeKey(edge), edge);

  const roots = [...new Set([...prev.roots, ...incoming.roots])];

  const establishment = incoming.establishment ?? prev.establishment;
  const originId = focusId ?? establishment.id;
  const distances = hopDistances(originId, [...edgeByKey.values()]);
  const maxHops = radius + 2;
  const keptNodeIds = new Set(
    [...nodeById.keys()].filter((id) => (distances.get(id) ?? Infinity) <= maxHops),
  );
  // El establecimiento nunca se recorta: es el ancla del universo, aunque no
  // sea un "nodo" en sí y por tanto no cuente para el límite de memoria.
  const keptEdgeEndpoints = new Set([...keptNodeIds, establishment.id]);

  return {
    establishment,
    roots: roots.filter((id) => keptNodeIds.has(id)),
    nodes: [...nodeById.values()].filter((node) => keptNodeIds.has(node.id)),
    edges: [...edgeByKey.values()].filter(
      (edge) => keptEdgeEndpoints.has(edge.from) && keptEdgeEndpoints.has(edge.to),
    ),
  };
}

export const EMPTY_GIFT_GRAPH: GiftGraph = {
  establishment: { id: "", name: "" },
  roots: [],
  nodes: [],
  edges: [],
};
