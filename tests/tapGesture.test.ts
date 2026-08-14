import { describe, expect, it } from "vitest";
import { isTap } from "@/lib/giftGraph/tapGesture";

describe("isTap", () => {
  it("cuenta como toque si el dedo casi no se movió y soltó rápido", () => {
    expect(isTap({ x: 100, y: 100, t: 0 }, { x: 103, y: 101, t: 150 })).toBe(true);
  });

  it("no cuenta como toque si el dedo se movió más de 10px (es un arrastre)", () => {
    expect(isTap({ x: 100, y: 100, t: 0 }, { x: 130, y: 100, t: 150 })).toBe(false);
  });

  it("no cuenta como toque si tardó más de 300ms, aunque no se moviera", () => {
    expect(isTap({ x: 100, y: 100, t: 0 }, { x: 100, y: 100, t: 500 })).toBe(false);
  });

  it("acepta justo en el límite de distancia y tiempo", () => {
    expect(isTap({ x: 0, y: 0, t: 0 }, { x: 10, y: 0, t: 300 })).toBe(true);
  });
});
