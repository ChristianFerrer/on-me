import type { Edge, Node, NodeState } from "@/lib/giftGraph/types";

export type ConstelacionPoint = {
  id: string;
  depth: number;
  /** Ángulo base, en radianes. La rotación global y el bamboleo se aplican encima, en el componente. */
  angle: number;
  /** Distancia radial desde el centro, ya resuelta por el anillo adaptativo de su profundidad. */
  ringRadius: number;
  /** Radio visual de la burbuja, por fase del camino del cliente -ver CONSTELACION_PHASE_SIZE-. */
  nodeRadius: number;
  /** Orden estable de aparición: semilla del bamboleo (freq/phase), no depende de un hash. */
  index: number;
};

export type ConstelacionLink = { fromId: string; toId: string };

export type ConstelacionLayout = {
  points: Map<string, ConstelacionPoint>;
  links: ConstelacionLink[];
  maxDepth: number;
  /** Radio de anillo por profundidad (1..maxDepth), para dibujar las guías. */
  ringRadiusByDepth: Map<number, number>;
  /** Radio de encuadre: RING[maxDepth] * 1.18, el borde más lejano que hay que enseñar. */
  frameRadius: number;
};

export const ESTABLISHMENT_RADIUS = 27;

/** Cuánto arco de circunferencia (en unidades del viewBox) le hace falta a cada burbuja para no pisar a la de al lado. */
const MIN_ARC_PER_NODE = 11;
/** Separación mínima entre un anillo y el siguiente, aunque haya pocos nodos. */
const MIN_RING_GAP = 36;
const FRAME_RADIUS_FACTOR = 1.18;

/**
 * Radio de burbuja por fase del camino del cliente, no por cuánta gente ha
 * invitado: este mapa cuenta el journey -prospecto, cliente, verificado-,
 * así que el tamaño tiene que contar esa misma historia. "sent" es la
 * unidad de referencia (1.0); el resto son múltiplos suyos, tal como pide
 * la especificación ("10% más grande", "50% más grande", "100% más
 * grande" = el doble). "window" arranca en el tamaño del canje (2.0) y se
 * encoge con el tiempo -eso lo aplica ConstelacionMap en cada frame, no aquí,
 * porque depende de la hora actual y esta capa no vuelve a calcularse en
 * cada tick-. "expired"/"discarded" son las dos salidas sin historia que
 * seguir contando: el tamaño mínimo de todos.
 */
export const CONSTELACION_PHASE_SIZE: Record<NodeState, number> = {
  sent: 1.0,
  opened: 1.1,
  claimed: 1.5,
  window: 2.0,
  billable: 2.0,
  direct: 2.0,
  expired: 0.75,
  discarded: 0.75,
};
const BASE_NODE_R = 2.2;

function nodeRadiusFor(node: Node | undefined): number {
  return BASE_NODE_R * (node ? CONSTELACION_PHASE_SIZE[node.state] : 1);
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
export function layoutConstelacion(nodes: Node[], edges: Edge[], establishmentId: string): ConstelacionLayout {
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

  const points = new Map<string, ConstelacionPoint>();
  points.set(establishmentId, { id: establishmentId, depth: 0, angle: 0, ringRadius: 0, nodeRadius: ESTABLISHMENT_RADIUS, index: 0 });

  placed.forEach((p, i) => {
    const ringRadius = ringRadiusByDepth.get(p.depth) ?? 0;
    const nodeRadius = nodeRadiusFor(byId.get(p.id));
    points.set(p.id, { id: p.id, depth: p.depth, angle: p.angle, ringRadius, nodeRadius, index: i + 1 });
  });

  const frameRadius = maxDepth > 0 ? (ringRadiusByDepth.get(maxDepth) ?? 0) * FRAME_RADIUS_FACTOR : ESTABLISHMENT_RADIUS * 2.4 * FRAME_RADIUS_FACTOR;

  const links: ConstelacionLink[] = [];
  for (const [parentId, children] of childrenOf) {
    for (const childId of children) links.push({ fromId: parentId, toId: childId });
  }

  return { points, links, maxDepth, ringRadiusByDepth, frameRadius };
}
