import { describe, expect, it } from "vitest";
import { computeFitScale, layoutSaltos } from "@/lib/giftGraph/saltosLayout";
import type { Edge, Node } from "@/lib/giftGraph/types";

const SHOP = "shop";

function node(id: string, stamps = 0): Node {
  return {
    id,
    name: id,
    depth: 1,
    rootId: id,
    state: "billable",
    stamps,
    redeemedAt: null,
    returnedAt: null,
    lastActivityAt: new Date(0).toISOString(),
    expiresAt: null,
    childCount: 0,
    loadedChildCount: 0,
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

  it("nunca produce NaN, incluso con sellos en 0 o negativos", () => {
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
});

describe("computeFitScale", () => {
  const MIN = 0.5;
  const MAX = 3.5;

  it("con poca profundidad hace zoom in, no deja aire de sobra", () => {
    const half = 84 + 64 + 200; // un solo anillo (RING_STEP) + paddings
    const scale = computeFitScale(84, half, MIN, MAX);
    expect(scale).toBeGreaterThan(1);
  });

  it("con cadenas largas no supera el máximo permitido", () => {
    const extent = 84 * 8; // ocho saltos de profundidad
    const half = extent + 64 + 200;
    const scale = computeFitScale(extent, half, MIN, MAX);
    expect(scale).toBeLessThanOrEqual(MAX);
    expect(scale).toBeGreaterThanOrEqual(MIN);
  });

  it("un grafo vacío no revienta ni da una escala absurda", () => {
    const half = 0 + 64 + 200;
    const scale = computeFitScale(0, half, MIN, MAX);
    expect(Number.isNaN(scale)).toBe(false);
    expect(scale).toBeGreaterThanOrEqual(MIN);
    expect(scale).toBeLessThanOrEqual(MAX);
  });

  it("más ramificación (extent mayor) nunca da más zoom que menos ramificación", () => {
    const shallow = computeFitScale(84, 84 + 64 + 200, MIN, MAX);
    const deep = computeFitScale(84 * 5, 84 * 5 + 64 + 200, MIN, MAX);
    expect(deep).toBeLessThanOrEqual(shallow);
  });
});
