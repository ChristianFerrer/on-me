import { describe, expect, it } from "vitest";
import { EMPTY_GIFT_GRAPH, mergeGraph } from "@/lib/giftGraph/mergeGraph";
import type { GiftGraph } from "@/lib/giftGraph/types";

const establishment = { id: "shop", name: "OnMe" };

function node(id: string, depth: number, rootId: string, childCount = 0, loadedChildCount = 0) {
  return { id, name: id, depth, rootId, giftedAt: "2025-01-01T00:00:00.000Z", childCount, loadedChildCount };
}

describe("mergeGraph", () => {
  it("une nodos y conexiones nuevas sin duplicar los que ya estaban", () => {
    const prev: GiftGraph = {
      establishment,
      roots: ["a"],
      nodes: [node("a", 1, "a", 1, 1)],
      edges: [{ from: "shop", to: "a", giftedAt: "2025-01-01T00:00:00.000Z" }],
    };
    const incoming: GiftGraph = {
      establishment,
      roots: ["a"],
      nodes: [node("a", 1, "a", 1, 1), node("b", 2, "a", 0, 0)],
      edges: [
        { from: "shop", to: "a", giftedAt: "2025-01-01T00:00:00.000Z" },
        { from: "a", to: "b", giftedAt: "2025-01-02T00:00:00.000Z" },
      ],
    };

    const merged = mergeGraph(prev, incoming, null, 2);

    expect(merged.nodes.map((n) => n.id).sort()).toEqual(["a", "b"]);
    expect(merged.edges).toHaveLength(2);
  });

  it("no pierde el loadedChildCount ya conocido si la respuesta nueva trae menos", () => {
    const prev: GiftGraph = {
      establishment,
      roots: ["a"],
      nodes: [node("a", 1, "a", 3, 3)],
      edges: [{ from: "shop", to: "a", giftedAt: "2025-01-01T00:00:00.000Z" }],
    };
    // Una respuesta centrada en otro nodo que de paso vuelve a traer "a"
    // pero sin sus hijos cargados esta vez.
    const incoming: GiftGraph = {
      establishment,
      roots: ["a"],
      nodes: [node("a", 1, "a", 3, 0)],
      edges: [{ from: "shop", to: "a", giftedAt: "2025-01-01T00:00:00.000Z" }],
    };

    const merged = mergeGraph(prev, incoming, null, 2);

    expect(merged.nodes.find((n) => n.id === "a")?.loadedChildCount).toBe(3);
  });

  it("descarta nodos a más de radius+2 saltos del foco actual", () => {
    // shop -> a -> b -> c -> d -> e, cadena de 5 saltos desde el foco.
    const chain: GiftGraph = {
      establishment,
      roots: ["a"],
      nodes: ["a", "b", "c", "d", "e"].map((id, index) => node(id, index + 1, "a")),
      edges: [
        { from: "shop", to: "a", giftedAt: "2025-01-01T00:00:00.000Z" },
        { from: "a", to: "b", giftedAt: "2025-01-01T00:00:00.000Z" },
        { from: "b", to: "c", giftedAt: "2025-01-01T00:00:00.000Z" },
        { from: "c", to: "d", giftedAt: "2025-01-01T00:00:00.000Z" },
        { from: "d", to: "e", giftedAt: "2025-01-01T00:00:00.000Z" },
      ],
    };

    // Foco en "a", radius 1 => se conserva hasta 3 saltos de "a": a,b,c,d, no "e".
    const merged = mergeGraph(EMPTY_GIFT_GRAPH, chain, "a", 1);

    expect(merged.nodes.map((n) => n.id).sort()).toEqual(["a", "b", "c", "d"]);
  });

  it("no duplica una conexión aunque llegue dos veces", () => {
    const graph: GiftGraph = {
      establishment,
      roots: ["a"],
      nodes: [node("a", 1, "a")],
      edges: [{ from: "shop", to: "a", giftedAt: "2025-01-01T00:00:00.000Z" }],
    };

    const merged = mergeGraph(graph, graph, null, 2);

    expect(merged.edges).toHaveLength(1);
  });
});
