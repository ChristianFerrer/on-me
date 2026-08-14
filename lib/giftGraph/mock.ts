import type { Edge, GiftGraph, Node } from "@/lib/giftGraph/types";

/**
 * El "universo" completo, como si fuera toda la tabla de invitaciones en BD.
 * getGiftGraph() recorta esto en trozos; nada fuera de este archivo conoce
 * la forma del árbol entero de una vez.
 */
type TreeSpec = { name: string; children?: TreeSpec[] };

const ESTABLISHMENT = { id: "shop", name: "OnMe Café" };

const CHAINS: TreeSpec[] = [
  {
    name: "Chris",
    children: [
      {
        name: "Delia",
        children: [
          { name: "Bru", children: [{ name: "Nora", children: [{ name: "Iker" }] }, { name: "Vega" }] },
          { name: "Martina", children: [{ name: "Omar" }] },
        ],
      },
      {
        name: "Pau",
        children: [
          { name: "Nadia" },
          { name: "Leo", children: [{ name: "Clara", children: [{ name: "Aitor" }] }] },
        ],
      },
    ],
  },
  {
    name: "Marta",
    children: [
      { name: "Sara", children: [{ name: "Marc", children: [{ name: "Julia" }] }] },
      { name: "Diego", children: [{ name: "Carla" }] },
      { name: "Rubén" },
    ],
  },
  {
    name: "Youssef",
    children: [
      { name: "Alba", children: [{ name: "Hugo", children: [{ name: "Noa", children: [{ name: "Bruno" }] }] }] },
      { name: "Vera", children: [{ name: "Adam" }] },
      { name: "Mia" },
    ],
  },
  {
    name: "Elena",
    children: [
      { name: "Kai", children: [{ name: "Lucia", children: [{ name: "Enzo" }] }] },
      { name: "Zoe", children: [{ name: "Max" }] },
      { name: "Nina", children: [{ name: "Theo", children: [{ name: "Elsa", children: [{ name: "Iris" }] }] }] },
    ],
  },
  {
    name: "Toni",
    children: [{ name: "Eva" }, { name: "Gael", children: [{ name: "Mar" }] }],
  },
];

function slug(name: string): string {
  return name.toLowerCase().replace(/[^a-z]/g, "");
}

/** Fecha determinista: nada de `new Date()` sin argumentos ni `Date.now()`. */
function isoDate(dayOffset: number): string {
  const anchor = Date.UTC(2025, 0, 1);
  return new Date(anchor + dayOffset * 86_400_000).toISOString();
}

function buildGraph(): GiftGraph {
  const nodes: Node[] = [];
  const edges: Edge[] = [];
  const roots: string[] = [];
  let order = 0;

  function walk(spec: TreeSpec, depth: number, rootId: string, parentId: string) {
    const id = slug(spec.name);
    const children = spec.children ?? [];
    order += 1;
    const giftedAt = isoDate(depth * 21 + order);

    nodes.push({
      id,
      name: spec.name,
      depth,
      rootId,
      giftedAt,
      childCount: children.length,
      loadedChildCount: children.length,
    });
    edges.push({ from: parentId, to: id, giftedAt });

    for (const child of children) walk(child, depth + 1, rootId, id);
  }

  for (const root of CHAINS) {
    const rootId = slug(root.name);
    roots.push(rootId);
    walk(root, 1, rootId, ESTABLISHMENT.id);
  }

  return { establishment: ESTABLISHMENT, roots, nodes, edges };
}

/** Todo el universo, calculado una sola vez al cargar el módulo. */
export const MOCK_GIFT_GRAPH: GiftGraph = buildGraph();
