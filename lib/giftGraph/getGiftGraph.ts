import { MOCK_GIFT_GRAPH } from "@/lib/giftGraph/mock";
import type { GiftGraph, Node } from "@/lib/giftGraph/types";

/**
 * Única puerta de entrada a los datos del universo: nunca se carga el grafo
 * entero de una vez. `focusId: null` pide los `radius` primeros saltos desde
 * el establecimiento; un `focusId` de nodo pide sus descendientes hasta
 * `radius` saltos más allá de él.
 *
 * Hoy recorta MOCK_GIFT_GRAPH en memoria. El día que esto hable con Supabase,
 * cambia lo de dentro de esta función — la firma y quien la llama no se tocan.
 */
export async function getGiftGraph(focusId: string | null, radius: number): Promise<GiftGraph> {
  const full = MOCK_GIFT_GRAPH;
  const childrenOf = new Map<string, string[]>();
  for (const edge of full.edges) {
    const siblings = childrenOf.get(edge.from) ?? [];
    siblings.push(edge.to);
    childrenOf.set(edge.from, siblings);
  }

  const originId = focusId ?? full.establishment.id;
  const included = new Set<string>();
  let frontier = [originId];
  // `radius` expansiones desde el origen: radius=2 trae dos saltos de gente
  // más allá de él (a la primera vuelta se topa a los hijos directos).
  for (let hop = 0; hop < radius && frontier.length > 0; hop++) {
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
  // El propio nodo foco siempre va incluido (si no es el establecimiento).
  if (focusId) included.add(focusId);

  const nodesById = new Map(full.nodes.map((node) => [node.id, node]));
  const nodes: Node[] = [...included].map((id) => {
    const node = nodesById.get(id)!;
    const loadedChildCount = (childrenOf.get(id) ?? []).filter((childId) => included.has(childId)).length;
    return { ...node, loadedChildCount };
  });

  // El establecimiento nunca entra en `included` (no es un nodo de persona),
  // así que hay que aceptarlo aparte o las conexiones "shop"->raíz desaparecen.
  const includedOrShop = new Set([...included, full.establishment.id]);
  const edges = full.edges.filter((edge) => includedOrShop.has(edge.from) && includedOrShop.has(edge.to));

  return {
    establishment: full.establishment,
    roots: full.roots.filter((id) => included.has(id)),
    nodes,
    edges,
  };
}
