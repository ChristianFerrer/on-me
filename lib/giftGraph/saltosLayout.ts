import type { Edge, Node } from "@/lib/giftGraph/types";

export type SaltosPoint = {
  id: string;
  depth: number;
  /** Ángulo, en radianes. Estático: esta constelación no rota ni bambolea. */
  angle: number;
  /** Distancia radial desde el centro, ya resuelta por el anillo adaptativo de su profundidad. */
  ringRadius: number;
  /** Radio visual de la burbuja, por sellos. */
  nodeRadius: number;
};

export type SaltosLink = { fromId: string; toId: string };

export type SaltosLayout = {
  points: Map<string, SaltosPoint>;
  links: SaltosLink[];
  maxDepth: number;
  /** Radio de anillo por profundidad (1..maxDepth), para dibujar las guías. */
  ringRadiusByDepth: Map<number, number>;
  /** Cuánto ocupa el nodo más lejano -radio de anillo + su propia burbuja-, arco excluido. */
  maxNodeReach: number;
};

const MIN_NODE_R = 5;
const MAX_NODE_R = 22;
export const ESTABLISHMENT_RADIUS = 26;

/** Cuánto arco de circunferencia (en unidades del viewBox) le hace falta a cada burbuja para no pisar a la de al lado. */
const MIN_ARC_PER_NODE = 15;
/** Separación mínima entre un anillo y el siguiente, aunque haya pocos nodos. */
const MIN_RING_GAP = 48;

/** Radio de burbuja por sellos: crece en raíz, para que una tarjeta completa no aplaste al resto. */
function nodeRadiusFor(stamps: number): number {
  return Math.min(MAX_NODE_R, Math.max(MIN_NODE_R, MIN_NODE_R + 4.2 * Math.sqrt(Math.max(0, stamps))));
}

/**
 * Distribución radial tipo d3.tree: cada rama recibe un arco proporcional al
 * número de hojas que cuelgan de ella -no al número de hijos directos-, igual
 * que el viejo lib/radialLayout.ts pero sobre el modelo plano Node[]/Edge[].
 *
 * El radio de cada anillo es adaptativo, no un múltiplo fijo de la
 * profundidad: con pocos nodos en un anillo, el radio mínimo entre anillos
 * basta; con muchos (39 invitaciones reales no caben todas en el mismo
 * círculo pequeño), el anillo crece lo que haga falta para darles sitio.
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

  // Primera pasada: profundidad y ángulo de cada nodo. El radio se resuelve
  // aparte, porque depende de cuántos nodos comparten cada anillo entero, no
  // solo de la propia rama.
  const placed: { id: string; depth: number; angle: number }[] = [];

  function place(id: string, depth: number, angleStart: number, angleEnd: number) {
    placed.push({ id, depth, angle: (angleStart + angleEnd) / 2 });

    const children = childrenOf.get(id) ?? [];
    if (children.length === 0) return;
    const total = countLeaves(id);
    let cursor = angleStart;
    for (const childId of children) {
      const span = ((angleEnd - angleStart) * countLeaves(childId)) / total;
      place(childId, depth + 1, cursor, cursor + span);
      cursor += span;
    }
  }

  const roots = childrenOf.get(establishmentId) ?? [];
  const total = roots.reduce((sum, id) => sum + countLeaves(id), 0) || 1;
  let cursor = -Math.PI / 2; // arranca arriba, como las agujas de un reloj
  for (const rootId of roots) {
    const span = (2 * Math.PI * countLeaves(rootId)) / total;
    place(rootId, 1, cursor, cursor + span);
    cursor += span;
  }

  const maxDepth = placed.reduce((max, p) => Math.max(max, p.depth), 0);

  // Segunda pasada: radio de anillo adaptativo, uno por profundidad.
  const countByDepth = new Map<number, number>();
  for (const p of placed) countByDepth.set(p.depth, (countByDepth.get(p.depth) ?? 0) + 1);

  const ringRadiusByDepth = new Map<number, number>();
  let prevRadius = 0;
  for (let depth = 1; depth <= maxDepth; depth++) {
    const n = countByDepth.get(depth) ?? 0;
    const bySpacing = (n * MIN_ARC_PER_NODE) / (2 * Math.PI);
    const radius = depth === 1 ? Math.max(ESTABLISHMENT_RADIUS * 2.4, bySpacing) : Math.max(prevRadius + MIN_RING_GAP, bySpacing);
    ringRadiusByDepth.set(depth, radius);
    prevRadius = radius;
  }

  const points = new Map<string, SaltosPoint>();
  points.set(establishmentId, { id: establishmentId, depth: 0, angle: 0, ringRadius: 0, nodeRadius: ESTABLISHMENT_RADIUS });

  let maxNodeReach = ESTABLISHMENT_RADIUS;
  for (const p of placed) {
    const ringRadius = ringRadiusByDepth.get(p.depth) ?? 0;
    const nodeRadius = nodeRadiusFor(byId.get(p.id)?.stamps ?? 0);
    maxNodeReach = Math.max(maxNodeReach, ringRadius + nodeRadius);
    points.set(p.id, { id: p.id, depth: p.depth, angle: p.angle, ringRadius, nodeRadius });
  }

  const links: SaltosLink[] = [];
  for (const [parentId, children] of childrenOf) {
    for (const childId of children) links.push({ fromId: parentId, toId: childId });
  }

  return { points, links, maxDepth, ringRadiusByDepth, maxNodeReach };
}
