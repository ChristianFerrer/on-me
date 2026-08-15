import type { Edge, Node } from "@/lib/giftGraph/types";

export type SaltosPoint = {
  id: string;
  depth: number;
  /** Ángulo base, en radianes. La rotación y el bamboleo se aplican encima, en el componente. */
  angle: number;
  /** Distancia radial estática desde el centro. */
  ringRadius: number;
  /** Radio visual de la burbuja, por sellos. */
  nodeRadius: number;
};

export type SaltosLink = { fromId: string; toId: string };

export type SaltosLayout = {
  points: Map<string, SaltosPoint>;
  links: SaltosLink[];
  maxDepth: number;
  /** ringRadius máximo ocupado, para dimensionar el viewBox. */
  extent: number;
};

/** Separación entre anillos. */
export const RING_STEP = 108;
const MIN_NODE_R = 9;
const MAX_NODE_R = 30;
export const ESTABLISHMENT_RADIUS = 40;

/** Radio de burbuja por sellos: crece en raíz, para que una tarjeta completa no aplaste al resto. */
function nodeRadiusFor(stamps: number): number {
  return Math.min(MAX_NODE_R, Math.max(MIN_NODE_R, MIN_NODE_R + 3.4 * Math.sqrt(Math.max(0, stamps))));
}

/**
 * Distribución radial tipo d3.tree: cada rama recibe un arco proporcional al
 * número de hojas que cuelgan de ella -no al número de hijos directos-, y el
 * radio crece con la profundidad. Mismo principio que el viejo
 * lib/radialLayout.ts, pero sobre el modelo plano Node[]/Edge[] del grafo de
 * saltos en vez de un árbol ReferralNode ya anidado.
 */
export function layoutSaltos(nodes: Node[], edges: Edge[], establishmentId: string): SaltosLayout {
  const childrenOf = new Map<string, string[]>();
  for (const edge of edges) {
    childrenOf.set(edge.from, [...(childrenOf.get(edge.from) ?? []), edge.to]);
  }
  const byId = new Map(nodes.map((n) => [n.id, n]));

  const leavesCache = new Map<string, number>();
  function countLeaves(id: string): number {
    const cached = leavesCache.get(id);
    if (cached != null) return cached;
    const children = childrenOf.get(id) ?? [];
    const count = children.length === 0 ? 1 : children.reduce((sum, childId) => sum + countLeaves(childId), 0);
    leavesCache.set(id, count);
    return count;
  }

  const points = new Map<string, SaltosPoint>();
  points.set(establishmentId, {
    id: establishmentId,
    depth: 0,
    angle: 0,
    ringRadius: 0,
    nodeRadius: ESTABLISHMENT_RADIUS,
  });

  const links: SaltosLink[] = [];
  let maxDepth = 0;
  let extent = 0;

  function place(id: string, depth: number, angleStart: number, angleEnd: number, parentId: string) {
    const angle = (angleStart + angleEnd) / 2;
    const ringRadius = depth * RING_STEP;
    maxDepth = Math.max(maxDepth, depth);
    extent = Math.max(extent, ringRadius);

    points.set(id, { id, depth, angle, ringRadius, nodeRadius: nodeRadiusFor(byId.get(id)?.stamps ?? 0) });
    links.push({ fromId: parentId, toId: id });

    const children = childrenOf.get(id) ?? [];
    if (children.length === 0) return;
    const total = countLeaves(id);
    let cursor = angleStart;
    for (const childId of children) {
      const span = ((angleEnd - angleStart) * countLeaves(childId)) / total;
      place(childId, depth + 1, cursor, cursor + span, id);
      cursor += span;
    }
  }

  const roots = childrenOf.get(establishmentId) ?? [];
  const total = roots.reduce((sum, id) => sum + countLeaves(id), 0) || 1;
  let cursor = -Math.PI / 2; // arranca arriba, como las agujas de un reloj
  for (const rootId of roots) {
    const span = (2 * Math.PI * countLeaves(rootId)) / total;
    place(rootId, 1, cursor, cursor + span, establishmentId);
    cursor += span;
  }

  return { points, links, maxDepth, extent };
}
