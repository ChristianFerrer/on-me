import { describe, expect, it } from "vitest";
import { breathingScale, computeRadius, hash01 } from "@/lib/giftGraph/organicMotion";

describe("computeRadius", () => {
  it("nunca baja del mínimo, ni con cero invitados", () => {
    expect(computeRadius(0)).toBeCloseTo(0.34);
    expect(computeRadius(-5)).toBeCloseTo(0.34);
  });

  it("crece en raíz, no en línea recta", () => {
    const r1 = computeRadius(1);
    const r4 = computeRadius(4);
    const r16 = computeRadius(16);
    // Cuadruplicar los invitados no duplica el radio.
    expect(r4 - r1).toBeGreaterThan(0);
    expect(r16 - r4).toBeLessThan((r4 - r1) * 4);
  });

  it("nunca pasa del máximo aunque haya muchísimos invitados", () => {
    expect(computeRadius(10_000)).toBeCloseTo(1.5);
  });
});

describe("hash01", () => {
  it("es determinista", () => {
    expect(hash01("chris")).toBe(hash01("chris"));
  });

  it("da valores distintos para ids distintos", () => {
    expect(hash01("chris")).not.toBe(hash01("delia"));
  });

  it("siempre cae en [0, 1)", () => {
    for (const id of ["a", "b", "chris", "the-establishment", ""]) {
      const v = hash01(id);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

describe("breathingScale", () => {
  it("oscila dentro de ±2.5%", () => {
    for (let t = 0; t < 20000; t += 500) {
      const scale = breathingScale(t, "chris");
      expect(scale).toBeGreaterThanOrEqual(0.975);
      expect(scale).toBeLessThanOrEqual(1.025);
    }
  });

  it("dos nodos distintos no respiran en fase", () => {
    const a = [0, 1000, 2000, 3000].map((t) => breathingScale(t, "chris"));
    const b = [0, 1000, 2000, 3000].map((t) => breathingScale(t, "delia"));
    expect(a).not.toEqual(b);
  });
});
