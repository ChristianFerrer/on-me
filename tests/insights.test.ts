import { describe, expect, it } from "vitest";
import { bestPadrinoId, isExpiringSoon, recencyFactor } from "@/lib/giftGraph/insights";
import type { Edge, Node } from "@/lib/giftGraph/types";

const NOW = Date.UTC(2025, 5, 15);

describe("recencyFactor", () => {
  it("brilla al máximo si la actividad fue hoy mismo", () => {
    expect(recencyFactor(new Date(NOW).toISOString(), NOW)).toBeCloseTo(1);
  });

  it("está del todo apagado a partir de 30 días", () => {
    const monthAgo = new Date(NOW - 31 * 86_400_000).toISOString();
    expect(recencyFactor(monthAgo, NOW)).toBeCloseTo(0);
  });

  it("decae de forma suave entre medias, no de golpe", () => {
    const halfway = new Date(NOW - 15 * 86_400_000).toISOString();
    const factor = recencyFactor(halfway, NOW);
    expect(factor).toBeGreaterThan(0);
    expect(factor).toBeLessThan(1);
  });
});

describe("isExpiringSoon", () => {
  it("null nunca está a punto de caducar", () => {
    expect(isExpiringSoon(null, NOW)).toBe(false);
  });

  it("dentro de 24h cuenta como a punto de caducar", () => {
    expect(isExpiringSoon(new Date(NOW + 10 * 3_600_000).toISOString(), NOW)).toBe(true);
  });

  it("a una semana vista no es urgente", () => {
    expect(isExpiringSoon(new Date(NOW + 7 * 86_400_000).toISOString(), NOW)).toBe(false);
  });

  it("una fecha ya pasada no cuenta como 'a punto de' caducar", () => {
    expect(isExpiringSoon(new Date(NOW - 3_600_000).toISOString(), NOW)).toBe(false);
  });
});

describe("bestPadrinoId", () => {
  function node(id: string, state: Node["state"]): Node {
    return {
      id,
      name: id,
      depth: 1,
      rootId: id,
      state,
      stamps: 0,
      redeemedAt: null,
      returnedAt: null,
      lastActivityAt: new Date(NOW).toISOString(),
      expiresAt: null,
      childCount: 0,
      loadedChildCount: 0,
    };
  }

  it("elige al nodo con más descendencia facturable, no al de más hijos directos", () => {
    // a -> b (billable) -> d (billable); a -> c (window). a tiene 2 billables
    // en su descendencia; c y b tienen menos.
    const nodes = [node("a", "billable"), node("b", "billable"), node("c", "window"), node("d", "billable")];
    const edges: Edge[] = [
      { from: "a", to: "b", giftedAt: "" },
      { from: "a", to: "c", giftedAt: "" },
      { from: "b", to: "d", giftedAt: "" },
    ];
    expect(bestPadrinoId(nodes, edges)).toBe("a");
  });

  it("da null si nadie tiene descendencia facturable", () => {
    const nodes = [node("a", "window"), node("b", "discarded")];
    const edges: Edge[] = [{ from: "a", to: "b", giftedAt: "" }];
    expect(bestPadrinoId(nodes, edges)).toBeNull();
  });
});
