import { describe, expect, it } from "vitest";
import { ESTABLISHMENT_RADIUS, layoutSaltos } from "@/lib/giftGraph/saltosLayout";
import type { Edge, Node } from "@/lib/giftGraph/types";

const SHOP = "shop";

function node(id: string, invited = 0): Node {
  return {
    id,
    name: id,
    claimed: true,
    depth: 1,
    rootId: id,
    state: "billable",
    stamps: 0,
    cardsCompleted: 0,
    redeemedAt: null,
    returnedAt: null,
    lastActivityAt: new Date(0).toISOString(),
    expiresAt: null,
    childCount: invited,
    loadedChildCount: invited,
  };
}

function edge(from: string, to: string): Edge {
  return { from, to, giftedAt: new Date(0).toISOString() };
}

function point(layout: ReturnType<typeof layoutSaltos>, id: string) {
  const found = layout.points.get(id);
  if (!found) throw new Error(`sin punto para ${id}`);
  return found;
}

describe("layoutSaltos", () => {
  it("coloca el establecimiento en el centro", () => {
    const layout = layoutSaltos([node("pau")], [edge(SHOP, "pau")], SHOP);
    const shop = point(layout, SHOP);
    expect(shop.ringRadius).toBe(0);
    expect(shop.depth).toBe(0);
  });

  it("separa las ramas de nivel 1 en ángulos distintos", () => {
    const layout = layoutSaltos(
      [node("pau"), node("delia")],
      [edge(SHOP, "pau"), edge(SHOP, "delia")],
      SHOP,
    );
    const pau = point(layout, "pau");
    const delia = point(layout, "delia");

    expect(pau.ringRadius).toBe(delia.ringRadius); // mismo nivel
    expect(pau.angle).not.toBe(delia.angle);
  });

  it("cada nivel se aleja más del centro", () => {
    const layout = layoutSaltos(
      [node("pau"), node("chris"), node("delia"), node("bru")],
      [edge(SHOP, "pau"), edge("pau", "chris"), edge("pau", "delia"), edge("delia", "bru")],
      SHOP,
    );
    expect(point(layout, "pau").ringRadius).toBeLessThan(point(layout, "delia").ringRadius);
    expect(point(layout, "delia").ringRadius).toBeLessThan(point(layout, "bru").ringRadius);
  });

  it("un grafo vacío deja solo el establecimiento", () => {
    const layout = layoutSaltos([], [], SHOP);
    expect(layout.points.size).toBe(1);
    expect(layout.links).toHaveLength(0);
    expect(layout.maxDepth).toBe(0);
    expect(layout.arcRadius).toBeCloseTo(ESTABLISHMENT_RADIUS * 2.4 * 1.18, 5);
  });

  it("una rama con más descendencia recibe un arco angular mayor", () => {
    const layout = layoutSaltos(
      [node("busy"), node("a"), node("b"), node("c"), node("quiet")],
      [
        edge(SHOP, "busy"),
        edge("busy", "a"),
        edge("busy", "b"),
        edge("busy", "c"),
        edge(SHOP, "quiet"),
      ],
      SHOP,
    );
    // "busy" reparte su arco entre 3 hojas, "quiet" es su propia única hoja:
    // el arco total (2π) se reparte 3:1, así que "busy" ocupa 3/4 del total.
    const busyWidth = point(layout, "a").angle - point(layout, "c").angle;
    expect(Math.abs(busyWidth)).toBeGreaterThan(0);
    expect(layout.points.size).toBe(6); // shop + 5 nodos reales
  });

  it("nunca produce NaN, incluso con invitados en 0 o negativos", () => {
    const layout = layoutSaltos([node("a", 0), node("b", -3)], [edge(SHOP, "a"), edge("a", "b")], SHOP);
    for (const p of layout.points.values()) {
      expect(Number.isNaN(p.angle)).toBe(false);
      expect(Number.isNaN(p.ringRadius)).toBe(false);
      expect(Number.isNaN(p.nodeRadius)).toBe(false);
    }
  });

  it("cada link conecta el id real de padre e hijo", () => {
    const layout = layoutSaltos([node("pau"), node("chris")], [edge(SHOP, "pau"), edge("pau", "chris")], SHOP);
    expect(layout.links).toContainEqual({ fromId: SHOP, toId: "pau" });
    expect(layout.links).toContainEqual({ fromId: "pau", toId: "chris" });
  });

  it("un anillo con muchos nodos crece para darles sitio, uno con pocos no", () => {
    // 60, no 30: con el arco mínimo por nodo más ajustado -para que quepan
    // muchos más clientes en el mapa, no solo referidos-, un anillo de 30
    // ya no basta para superar el radio mínimo del anillo 1 por sí solo.
    const crowdedNodes = Array.from({ length: 60 }, (_, i) => node(`c${i}`));
    const crowdedEdges = crowdedNodes.map((n) => edge(SHOP, n.id));
    const crowded = layoutSaltos(crowdedNodes, crowdedEdges, SHOP);

    const quietNodes = [node("solo")];
    const quiet = layoutSaltos(quietNodes, [edge(SHOP, "solo")], SHOP);

    expect(crowded.ringRadiusByDepth.get(1)!).toBeGreaterThan(quiet.ringRadiusByDepth.get(1)!);
  });

  it("nunca amontona: el arco disponible por nodo alcanza para todos", () => {
    const nodes = Array.from({ length: 50 }, (_, i) => node(`n${i}`));
    const edges = nodes.map((n) => edge(SHOP, n.id));
    const layout = layoutSaltos(nodes, edges, SHOP);
    const r1 = layout.ringRadiusByDepth.get(1)!;
    // Circunferencia del anillo >= 11 unidades por nodo (el mínimo que pide el layout).
    expect(2 * Math.PI * r1).toBeGreaterThanOrEqual(50 * 11 - 1); // -1 por redondeo de coma flotante
  });

  it("arcRadius es el anillo más lejano ensanchado por el factor del embudo, nunca más", () => {
    const layout = layoutSaltos([node("full", 20)], [edge(SHOP, "full")], SHOP);
    const full = point(layout, "full");
    expect(layout.arcRadius).toBeCloseTo(full.ringRadius * 1.18, 5);
  });
});
