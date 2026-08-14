import type { ReferralNode } from "@/lib/referralTree";

export type RadialPoint = {
  id: string;
  name: string;
  depth: number;
  billable: boolean;
  /** Cuántos clientes cuelgan de este, directa o indirectamente. */
  descendants: number;
  /** Radio de la burbuja, ya resuelto: cabe el nombre y refleja su alcance. */
  radius: number;
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
  /** Radio máximo ocupado, para dimensionar el viewBox y los anillos de fondo. */
  extent: number;
  maxDepth: number;
};

/** Separación entre anillos. Burbujas grandes necesitan más aire que puntos. */
const RADIUS_STEP = 138;

const MIN_R = 22;
const MAX_R = 40;
const SHOP_MIN_R = 34;
const SHOP_MAX_R = 58;

/**
 * Aproxima cuánto radio necesita una burbuja para que el nombre quepa
 * dentro sin medir texto de verdad —esto se renderiza en servidor, sin
 * lienzo—: un ancho medio por carácter basta para un nombre de pila.
 */
function textFitRadius(name: string, fontSize: number, padding: number): number {
  const width = name.length * fontSize * 0.58;
  return width / 2 + padding;
}

function countLeaves(node: ReferralNode): number {
  if (node.children.length === 0) return 1;
  return node.children.reduce((sum, child) => sum + countLeaves(child), 0);
}

function countDescendants(node: ReferralNode): number {
  return node.children.reduce((sum, child) => sum + 1 + countDescendants(child), 0);
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
 *
 * El radio de cada burbuja mezcla dos cosas: cuánto alcance tiene ese
 * cliente (más ahijados, burbuja más grande) y cuánto sitio pide su
 * nombre para no desbordar el círculo.
 */
export function layoutRadialTree(roots: ReferralNode[]): RadialLayout {
  const shopDescendants = roots.reduce((sum, node) => sum + 1 + countDescendants(node), 0);
  const shopRadius = Math.min(
    SHOP_MAX_R,
    Math.max(SHOP_MIN_R, textFitRadius("shop", 15, 14), SHOP_MIN_R + Math.min(shopDescendants, 12)),
  );

  const nodes: RadialPoint[] = [
    { id: "shop", name: "", depth: 0, billable: false, descendants: shopDescendants, radius: shopRadius, x: 0, y: 0 },
  ];
  const edges: RadialEdge[] = [];
  let extent = 0;
  let maxDepth = 0;

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
    maxDepth = Math.max(maxDepth, depth);

    const descendants = countDescendants(node);
    const bubbleRadius = Math.min(
      MAX_R,
      Math.max(MIN_R, textFitRadius(node.name, 11, 10), MIN_R + Math.min(descendants, 8) * 1.4),
    );

    nodes.push({
      id: node.id,
      name: node.name,
      depth,
      billable: node.billable,
      descendants,
      radius: bubbleRadius,
      x,
      y,
    });

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

  return { nodes, edges, extent, maxDepth };
}
