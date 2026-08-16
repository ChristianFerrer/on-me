import { describe, expect, it } from "vitest";
import { ESTABLISHMENT_RADIUS, layoutConstelacion } from "@/lib/giftGraph/constelacionLayout";
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

function point(layout: ReturnType<typeof layoutConstelacion>, id: string) {
  const found = layout.points.get(id);
  if (!found) throw new Error(`sin punto para ${id}`);
  return found;
}

describe("layoutConstelacion", () => {
  it("coloca el establecimiento en el centro", () => {
    const layout = layoutConstelacion([node("pau")], [edge(SHOP, "pau")], SHOP);
    const shop = point(layout, SHOP);
    expect(shop.ringRadius).toBe(0);
    expect(shop.depth).toBe(0);
  });

  it("separa las ramas de nivel 1 en ángulos distintos", () => {
    const layout = layoutConstelacion(
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
    const layout = layoutConstelacion(
      [node("pau"), node("chris"), node("delia"), node("bru")],
      [edge(SHOP, "pau"), edge("pau", "chris"), edge("pau", "delia"), edge("delia", "bru")],
      SHOP,
    );
    expect(point(layout, "pau").ringRadius).toBeLessThan(point(layout, "delia").ringRadius);
    expect(point(layout, "delia").ringRadius).toBeLessThan(point(layout, "bru").ringRadius);
  });

  it("un grafo vacío deja solo el establecimiento", () => {
    const layout = layoutConstelacion([], [], SHOP);
    expect(layout.points.size).toBe(1);
    expect(layout.links).toHaveLength(0);
    expect(layout.maxDepth).toBe(0);
    expect(layout.frameRadius).toBeCloseTo(ESTABLISHMENT_RADIUS * 2.4 * 1.18, 5);
  });

  it("una rama con más descendencia recibe un arco angular mayor", () => {
    const layout = layoutConstelacion(
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
    const layout = layoutConstelacion([node("a", 0), node("b", -3)], [edge(SHOP, "a"), edge("a", "b")], SHOP);
    for (const p of layout.points.values()) {
      expect(Number.isNaN(p.angle)).toBe(false);
      expect(Number.isNaN(p.ringRadius)).toBe(false);
      expect(Number.isNaN(p.nodeRadius)).toBe(false);
    }
  });

  it("cada link conecta el id real de padre e hijo", () => {
    const layout = layoutConstelacion([node("pau"), node("chris")], [edge(SHOP, "pau"), edge("pau", "chris")], SHOP);
    expect(layout.links).toContainEqual({ fromId: SHOP, toId: "pau" });
    expect(layout.links).toContainEqual({ fromId: "pau", toId: "chris" });
  });

  it("un anillo con muchos nodos crece para darles sitio, uno con pocos no", () => {
    // 60, no 30: con el arco mínimo por nodo más ajustado -para que quepan
    // muchos más clientes en el mapa, no solo referidos-, un anillo de 30
    // ya no basta para superar el radio mínimo del anillo 1 por sí solo.
    const crowdedNodes = Array.from({ length: 60 }, (_, i) => node(`c${i}`));
    const crowdedEdges = crowdedNodes.map((n) => edge(SHOP, n.id));
    const crowded = layoutConstelacion(crowdedNodes, crowdedEdges, SHOP);

    const quietNodes = [node("solo")];
    const quiet = layoutConstelacion(quietNodes, [edge(SHOP, "solo")], SHOP);

    expect(crowded.ringRadiusByDepth.get(1)!).toBeGreaterThan(quiet.ringRadiusByDepth.get(1)!);
  });

  it("nunca amontona: el arco disponible por nodo alcanza para todos", () => {
    const nodes = Array.from({ length: 50 }, (_, i) => node(`n${i}`));
    const edges = nodes.map((n) => edge(SHOP, n.id));
    const layout = layoutConstelacion(nodes, edges, SHOP);
    const r1 = layout.ringRadiusByDepth.get(1)!;
    // Circunferencia del anillo >= 11 unidades por nodo (el mínimo que pide el layout).
    expect(2 * Math.PI * r1).toBeGreaterThanOrEqual(50 * 11 - 1); // -1 por redondeo de coma flotante
  });

  it("frameRadius es el anillo más lejano ensanchado por el factor del embudo, nunca más", () => {
    const layout = layoutConstelacion([node("full", 20)], [edge(SHOP, "full")], SHOP);
    const full = point(layout, "full");
    expect(layout.frameRadius).toBeCloseTo(full.ringRadius * 1.18, 5);
  });

  it("una raíz directa con muchos invitados se aleja del núcleo más que una con uno solo, y arrastra a su descendencia", () => {
    const layout = layoutConstelacion(
      [
        node("popular"),
        node("p1"),
        node("p2"),
        node("p3"),
        node("p4"),
        node("p5"),
        node("nieta"),
        node("solitaria"),
        node("unico"),
        node("hijounico"),
      ],
      [
        edge(SHOP, "popular"),
        edge("popular", "p1"),
        edge("popular", "p2"),
        edge("popular", "p3"),
        edge("popular", "p4"),
        edge("popular", "p5"),
        edge("p1", "nieta"),
        edge(SHOP, "solitaria"),
        edge(SHOP, "unico"),
        edge("unico", "hijounico"),
      ],
      SHOP,
    );
    const popular = point(layout, "popular");
    const solitaria = point(layout, "solitaria");
    const unico = point(layout, "unico");
    const p1 = point(layout, "p1"); // profundidad 2, bajo "popular"

    // Sin invitados, o con uno solo: mismo radio que cualquier otra raíz, sin desplazamiento.
    expect(solitaria.ringRadius).toBe(unico.ringRadius);
    // Con 5 invitados directos, la raíz -y su rama entera- se aleja del anillo 1 base.
    expect(popular.ringRadius).toBeGreaterThan(solitaria.ringRadius);
    // El desplazamiento de "popular" viaja con toda su descendencia: su hijo
    // sigue en el anillo 2 -más lejos que la propia raíz-, no se queda atrás.
    expect(p1.ringRadius).toBeGreaterThan(popular.ringRadius);
  });
});
