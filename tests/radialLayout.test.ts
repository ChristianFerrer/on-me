import { describe, expect, it } from "vitest";
import { layoutRadialTree } from "@/lib/radialLayout";
import type { ReferralNode } from "@/lib/referralTree";

function node(id: string, children: ReferralNode[] = [], billable = false): ReferralNode {
  return { id, name: id, billable, children };
}

describe("layoutRadialTree", () => {
  it("coloca el local en el centro", () => {
    const { nodes } = layoutRadialTree([node("pau")]);
    const shop = nodes.find((n) => n.id === "shop");
    expect(shop?.x).toBe(0);
    expect(shop?.y).toBe(0);
  });

  it("separa las ramas de nivel 1 en ángulos distintos", () => {
    const { nodes } = layoutRadialTree([node("pau"), node("delia")]);
    const pau = nodes.find((n) => n.id === "pau")!;
    const delia = nodes.find((n) => n.id === "delia")!;

    // Mismo radio (mismo nivel), posiciones distintas: no se pisan.
    expect(Math.hypot(pau.x, pau.y)).toBeCloseTo(Math.hypot(delia.x, delia.y));
    expect(pau.x === delia.x && pau.y === delia.y).toBe(false);
  });

  it("cada nivel se aleja del centro", () => {
    const tree = node("pau", [node("chris"), node("delia", [node("bru")])]);
    const { nodes } = layoutRadialTree([tree]);

    const radius = (id: string) => {
      const found = nodes.find((n) => n.id === id)!;
      return Math.hypot(found.x, found.y);
    };

    expect(radius("pau")).toBeLessThan(radius("delia"));
    expect(radius("delia")).toBeLessThan(radius("bru"));
  });

  it("un árbol vacío deja solo el nodo del local", () => {
    const { nodes, edges } = layoutRadialTree([]);
    expect(nodes).toHaveLength(1);
    expect(nodes[0].id).toBe("shop");
    expect(edges).toHaveLength(0);
  });

  it("cada arista conecta con la posición real de su padre", () => {
    const tree = node("pau", [node("chris")]);
    const { nodes, edges } = layoutRadialTree([tree]);
    const pau = nodes.find((n) => n.id === "pau")!;
    const chris = nodes.find((n) => n.id === "chris")!;

    const shopToPau = edges.find((e) => e.x1 === pau.x && e.y1 === pau.y)!;
    expect(shopToPau.x0).toBe(0);
    expect(shopToPau.y0).toBe(0);

    const pauToChris = edges.find((e) => e.x1 === chris.x && e.y1 === chris.y)!;
    expect(pauToChris.x0).toBe(pau.x);
    expect(pauToChris.y0).toBe(pau.y);
  });
});
