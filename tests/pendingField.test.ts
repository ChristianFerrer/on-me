import { describe, expect, it } from "vitest";
import { generatePendingField } from "@/components/universe/pendingField";

describe("generatePendingField", () => {
  it("da el número de puntos pedido", () => {
    expect(generatePendingField(50, 10, 20)).toHaveLength(50);
  });

  it("todos los puntos caen dentro del cascarón, no dentro del grafo ni muy lejos", () => {
    const points = generatePendingField(80, 10, 20);
    for (const p of points) {
      const distance = Math.hypot(p.x, p.y, p.z);
      expect(distance).toBeGreaterThanOrEqual(10);
      expect(distance).toBeLessThanOrEqual(20);
    }
  });

  it("es determinista", () => {
    expect(generatePendingField(30, 5, 15)).toEqual(generatePendingField(30, 5, 15));
  });

  it("no amontona todos los puntos en el mismo sitio", () => {
    const points = generatePendingField(40, 10, 20);
    const unique = new Set(points.map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)},${p.z.toFixed(2)}`));
    expect(unique.size).toBe(points.length);
  });
});
