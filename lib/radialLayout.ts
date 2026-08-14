import type { ReferralNode } from "@/lib/referralTree";

export type RadialPoint = {
  id: string;
  name: string;
  depth: number;
  billable: boolean;
  x: number;
  y: number;
};

export type RadialEdge = {
  x0: number;
  y0: number;
  /** Puntos de control de la curva, ya resueltos: el componente solo dibuja. */
  cx1: number;
  cy1: number;
  cx2: number;
  cy2: number;
  x1: number;
  y1: number;
  billable: boolean;
};

export type RadialLayout = {
  nodes: RadialPoint[];
  edges: RadialEdge[];
  /** Radio máximo ocupado, para dimensionar el viewBox. */
  extent: number;
};

/** Separación entre anillos. Un piloto con pocos niveles no necesita más. */
const RADIUS_STEP = 96;

function countLeaves(node: ReferralNode): number {
  if (node.children.length === 0) return 1;
  return node.children.reduce((sum, child) => sum + countLeaves(child), 0);
}

/**
 * Distribución radial tipo d3.tree: cada rama recibe un arco proporcional
 * al número de hojas que cuelgan de ella, y el radio crece con la
 * profundidad.
 *
 * Los enlaces son curvas, no radios rectos: el punto de control de cada
 * extremo va a mitad de radio pero en el ángulo de ESE extremo (el mismo
 * truco que usa d3.linkRadial), así que la rama gira suave hacia su hijo en
 * vez de partir en línea recta desde el centro. Eso es lo que las hace leer
 * como tentáculos.
 */
export function layoutRadialTree(roots: ReferralNode[]): RadialLayout {
  const nodes: RadialPoint[] = [{ id: "shop", name: "", depth: 0, billable: false, x: 0, y: 0 }];
  const edges: RadialEdge[] = [];
  let extent = 0;

  function place(
    node: ReferralNode,
    depth: number,
    angleStart: number,
    angleEnd: number,
    parent: { x: number; y: number; angle: number; radius: number },
  ) {
    const angle = (angleStart + angleEnd) / 2;
    const radius = depth * RADIUS_STEP;
    const x = radius * Math.cos(angle);
    const y = radius * Math.sin(angle);
    extent = Math.max(extent, radius);

    nodes.push({ id: node.id, name: node.name, depth, billable: node.billable, x, y });

    // Desde el propio centro (radio 0) el ángulo del padre no significa
    // nada: el primer tramo sale recto, y ya curva a partir del segundo.
    const midRadius = (parent.radius + radius) / 2;
    const a0 = parent.radius === 0 ? angle : parent.angle;
    edges.push({
      x0: parent.x,
      y0: parent.y,
      cx1: midRadius * Math.cos(a0),
      cy1: midRadius * Math.sin(a0),
      cx2: midRadius * Math.cos(angle),
      cy2: midRadius * Math.sin(angle),
      x1: x,
      y1: y,
      billable: node.billable,
    });

    if (node.children.length === 0) return;
    const total = countLeaves(node);
    let cursor = angleStart;
    const self = { x, y, angle, radius };
    for (const child of node.children) {
      const span = ((angleEnd - angleStart) * countLeaves(child)) / total;
      place(child, depth + 1, cursor, cursor + span, self);
      cursor += span;
    }
  }

  const total = roots.reduce((sum, node) => sum + countLeaves(node), 0) || 1;
  let cursor = 0;
  const center = { x: 0, y: 0, angle: 0, radius: 0 };
  for (const root of roots) {
    const span = (2 * Math.PI * countLeaves(root)) / total;
    place(root, 1, cursor, cursor + span, center);
    cursor += span;
  }

  return { nodes, edges, extent };
}
