import type { Edge, Node } from "@/lib/giftGraph/types";

export type Vec3 = { x: number; y: number; z: number };

const RADIUS_PER_DEPTH = 6;
/** Cuánto se arrastra un hijo hacia la posición de su padre (0 = nada, 1 = encima). */
const PARENT_PULL = 0.35;

/** Hash determinista de un string a [0, 1). El mismo id siempre da el mismo valor. */
function hash01(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 1_000_000) / 1_000_000;
}

/** N direcciones bien repartidas sobre una esfera unitaria (distribución de Fibonacci). */
function fibonacciSphereDirections(count: number): Vec3[] {
  if (count <= 0) return [];
  const goldenAngle = Math.PI * (3 - Math.sqrt(5));
  const directions: Vec3[] = [];
  for (let i = 0; i < count; i++) {
    const y = count === 1 ? 0 : 1 - (2 * i) / (count - 1);
    const radiusAtY = Math.sqrt(Math.max(0, 1 - y * y));
    const theta = goldenAngle * i;
    directions.push({ x: Math.cos(theta) * radiusAtY, y, z: Math.sin(theta) * radiusAtY });
  }
  return directions;
}

function normalize(v: Vec3): Vec3 {
  const len = Math.hypot(v.x, v.y, v.z) || 1;
  return { x: v.x / len, y: v.y / len, z: v.z / len };
}

/** Dos vectores unitarios perpendiculares a `dir`, para movernos dentro de su cono. */
function perpendicularBasis(dir: Vec3): [Vec3, Vec3] {
  const helper = Math.abs(dir.y) < 0.9 ? { x: 0, y: 1, z: 0 } : { x: 1, y: 0, z: 0 };
  const u = normalize({
    x: dir.y * helper.z - dir.z * helper.y,
    y: dir.z * helper.x - dir.x * helper.z,
    z: dir.x * helper.y - dir.y * helper.x,
  });
  const v = normalize({
    x: dir.y * u.z - dir.z * u.y,
    y: dir.z * u.x - dir.x * u.z,
    z: dir.x * u.y - dir.y * u.x,
  });
  return [u, v];
}

function lerp(a: Vec3, b: Vec3, t: number): Vec3 {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t };
}

/**
 * Posición 3D de cada nodo, en capas: cada cadena (`rootId`) recibe su propio
 * sector angular sobre una esfera (reparto de Fibonacci entre las raíces, con
 * ancho proporcional al tamaño de la cadena), y dentro del sector cada
 * `depth` es un anillo concéntrico. Determinista: el mismo grafo siempre
 * produce las mismas posiciones, y las posiciones ya calculadas en `cached`
 * no se recalculan ni se mueven cuando llegan nodos nuevos.
 */
export function layoutSphere(
  nodes: Node[],
  edges: Edge[],
  roots: string[],
  cached: Map<string, Vec3> = new Map(),
): Map<string, Vec3> {
  const positions = new Map(cached);
  if (nodes.length === 0) return positions;

  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const parentOf = new Map(edges.map((edge) => [edge.to, edge.from]));

  const chainSize = new Map<string, number>();
  for (const node of nodes) chainSize.set(node.rootId, (chainSize.get(node.rootId) ?? 0) + 1);

  const chainRoots = roots.filter((id) => nodeById.has(id));
  const chainDirections = new Map(
    chainRoots.map((id, index) => [id, fibonacciSphereDirections(chainRoots.length)[index]]),
  );

  const totalNodes = nodes.length;
  const sectorWidth = new Map(
    chainRoots.map((id) => {
      const size = chainSize.get(id) ?? 1;
      // Raíz cuadrada: una cadena con 4x más gente no se lleva 4x el ángulo.
      return [id, Math.sqrt(size / totalNodes)] as const;
    }),
  );

  function positionOf(id: string): Vec3 {
    const cachedPos = positions.get(id);
    if (cachedPos) return cachedPos;

    const node = nodeById.get(id)!;
    const chainDir = chainDirections.get(node.rootId) ?? { x: 1, y: 0, z: 0 };
    const [u, v] = perpendicularBasis(chainDir);
    const width = (sectorWidth.get(node.rootId) ?? 0.3) * Math.PI;

    // Dos valores pseudoaleatorios (pero deterministas) a partir del id: uno
    // decide el ángulo dentro del cono, el otro cuánto se aleja del eje.
    const angle = (hash01(id) - 0.5) * width;
    const spread = hash01(`${id}:spread`) * width * 0.5;
    const offsetDir = normalize({
      x: u.x * Math.cos(angle) + v.x * Math.sin(angle),
      y: u.y * Math.cos(angle) + v.y * Math.sin(angle),
      z: u.z * Math.cos(angle) + v.z * Math.sin(angle),
    });
    const dir = normalize(lerp(chainDir, offsetDir, Math.sin(spread)));
    const radius = node.depth * RADIUS_PER_DEPTH;
    let position: Vec3 = { x: dir.x * radius, y: dir.y * radius, z: dir.z * radius };

    const parentId = parentOf.get(id);
    // El padre puede ser el establecimiento (para los nodos de depth 1), que
    // no es un nodo del grafo: su posición es el centro del universo.
    if (parentId && nodeById.has(parentId)) {
      const parentPos = positionOf(parentId);
      position = lerp(position, projectToRadius(parentPos, radius), PARENT_PULL);
    }

    positions.set(id, position);
    return position;
  }

  function projectToRadius(pos: Vec3, radius: number): Vec3 {
    const dir = normalize(pos);
    return { x: dir.x * radius, y: dir.y * radius, z: dir.z * radius };
  }

  for (const node of nodes) positionOf(node.id);
  return positions;
}
