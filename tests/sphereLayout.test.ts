import { describe, expect, it } from "vitest";
import { layoutSphere } from "@/lib/giftGraph/sphereLayout";
import { MOCK_GIFT_GRAPH } from "@/lib/giftGraph/mock";
import type { Node } from "@/lib/giftGraph/types";

function len(p: { x: number; y: number; z: number }): number {
  return Math.hypot(p.x, p.y, p.z);
}

describe("layoutSphere", () => {
  it("es determinista: el mismo grafo siempre da las mismas posiciones", () => {
    const a = layoutSphere(MOCK_GIFT_GRAPH.nodes, MOCK_GIFT_GRAPH.edges, MOCK_GIFT_GRAPH.roots);
    const b = layoutSphere(MOCK_GIFT_GRAPH.nodes, MOCK_GIFT_GRAPH.edges, MOCK_GIFT_GRAPH.roots);
    for (const [id, pos] of a) expect(b.get(id)).toEqual(pos);
  });

  it("no mueve las posiciones ya cacheadas cuando llegan nodos nuevos", () => {
    const shallow = MOCK_GIFT_GRAPH.nodes.filter((n) => n.depth <= 2);
    const cached = layoutSphere(shallow, MOCK_GIFT_GRAPH.edges, MOCK_GIFT_GRAPH.roots);

    const full = layoutSphere(MOCK_GIFT_GRAPH.nodes, MOCK_GIFT_GRAPH.edges, MOCK_GIFT_GRAPH.roots, cached);

    for (const [id, pos] of cached) expect(full.get(id)).toEqual(pos);
    // Y sí coloca a los nuevos.
    expect(full.size).toBe(MOCK_GIFT_GRAPH.nodes.length);
  });

  it("el radio crece con la profundidad", () => {
    const positions = layoutSphere(MOCK_GIFT_GRAPH.nodes, MOCK_GIFT_GRAPH.edges, MOCK_GIFT_GRAPH.roots);
    const byDepth = new Map<number, number[]>();
    for (const node of MOCK_GIFT_GRAPH.nodes) {
      const radius = len(positions.get(node.id)!);
      byDepth.set(node.depth, [...(byDepth.get(node.depth) ?? []), radius]);
    }
    const avgRadius = (depth: number) => {
      const radii = byDepth.get(depth)!;
      return radii.reduce((a, b) => a + b, 0) / radii.length;
    };
    expect(avgRadius(2)).toBeGreaterThan(avgRadius(1));
    expect(avgRadius(3)).toBeGreaterThan(avgRadius(2));
    expect(avgRadius(4)).toBeGreaterThan(avgRadius(3));
  });

  it("no coloca dos nodos exactamente en el mismo punto", () => {
    const positions = layoutSphere(MOCK_GIFT_GRAPH.nodes, MOCK_GIFT_GRAPH.edges, MOCK_GIFT_GRAPH.roots);
    const seen = new Set<string>();
    for (const [, pos] of positions) {
      const key = `${pos.x.toFixed(4)},${pos.y.toFixed(4)},${pos.z.toFixed(4)}`;
      expect(seen.has(key)).toBe(false);
      seen.add(key);
    }
  });

  it("nunca produce NaN, incluso con una sola cadena", () => {
    const nodes: Node[] = [
      { id: "solo", name: "Solo", depth: 1, rootId: "solo", giftedAt: "2025-01-01T00:00:00.000Z", childCount: 0, loadedChildCount: 0 },
    ];
    const positions = layoutSphere(nodes, [{ from: "shop", to: "solo", giftedAt: "2025-01-01T00:00:00.000Z" }], ["solo"]);
    const pos = positions.get("solo")!;
    expect(Number.isNaN(pos.x)).toBe(false);
    expect(Number.isNaN(pos.y)).toBe(false);
    expect(Number.isNaN(pos.z)).toBe(false);
  });
});
