import { describe, expect, it } from "vitest";
import { getGiftGraph } from "@/lib/giftGraph/getGiftGraph";
import { EMPTY_GIFT_GRAPH, mergeGraph } from "@/lib/giftGraph/mergeGraph";
import { MOCK_GIFT_GRAPH } from "@/lib/giftGraph/mock";

describe("getGiftGraph", () => {
  it("focus null trae los roots y las conexiones del establecimiento a cada uno", async () => {
    const slice = await getGiftGraph(null, 2);
    const rootEdges = slice.edges.filter((edge) => edge.from === slice.establishment.id);
    // Una conexión "shop -> raíz" por cada cadena, no solo las de persona a persona.
    expect(rootEdges).toHaveLength(MOCK_GIFT_GRAPH.roots.length);
  });

  it("trae exactamente `radius` saltos de profundidad desde el establecimiento", async () => {
    const slice = await getGiftGraph(null, 2);
    const depths = new Set(slice.nodes.map((n) => n.depth));
    expect(depths).toEqual(new Set([1, 2]));
  });

  it("trae `radius` saltos desde un nodo foco, incluido él mismo", async () => {
    const slice = await getGiftGraph("delia", 2);
    expect(slice.nodes.map((n) => n.id).sort()).toEqual(["bru", "delia", "martina", "nora", "vega"]);
  });

  it("el resultado se puede fusionar contra un grafo vacío sin perder nodos", async () => {
    // Regresión: las conexiones "shop -> raíz" se descartaban porque el
    // establecimiento nunca entraba en el set de nodos incluidos, así que
    // el merge con el estado inicial (vacío) se quedaba en cero nodos.
    const slice = await getGiftGraph(null, 2);
    const merged = mergeGraph(EMPTY_GIFT_GRAPH, slice, null, 2);
    expect(merged.nodes.length).toBe(slice.nodes.length);
    expect(merged.roots.length).toBe(MOCK_GIFT_GRAPH.roots.length);
  });
});
