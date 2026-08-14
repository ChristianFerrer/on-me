import { describe, expect, it } from "vitest";
import { clampScale, panBy, pixelsToUnits, zoomAtPoint } from "@/lib/panZoom";

describe("zoomAtPoint", () => {
  it("mantiene el mismo punto de contenido bajo el cursor tras escalar", () => {
    const pan = { x: 10, y: -20, scale: 1.5 };
    const viewX = 40;
    const viewY = 30;

    // El punto de contenido que hay ahora mismo bajo (viewX, viewY).
    const contentBefore = { x: (viewX - pan.x) / pan.scale, y: (viewY - pan.y) / pan.scale };

    const next = zoomAtPoint(pan, viewX, viewY, 2, 0.5, 4);

    const contentAfter = {
      x: (viewX - next.x) / next.scale,
      y: (viewY - next.y) / next.scale,
    };

    expect(contentAfter.x).toBeCloseTo(contentBefore.x);
    expect(contentAfter.y).toBeCloseTo(contentBefore.y);
  });

  it("aplica el factor de zoom pedido", () => {
    const pan = { x: 0, y: 0, scale: 1 };
    const next = zoomAtPoint(pan, 0, 0, 1.5, 0.1, 10);
    expect(next.scale).toBeCloseTo(1.5);
  });

  it("no deja escapar el zoom de sus límites", () => {
    const pan = { x: 0, y: 0, scale: 1 };
    expect(zoomAtPoint(pan, 0, 0, 100, 0.5, 3.5).scale).toBe(3.5);
    expect(zoomAtPoint(pan, 0, 0, 0.001, 0.5, 3.5).scale).toBe(0.5);
  });
});

describe("clampScale", () => {
  it("respeta el rango", () => {
    expect(clampScale(5, 0.5, 3.5)).toBe(3.5);
    expect(clampScale(0.1, 0.5, 3.5)).toBe(0.5);
    expect(clampScale(2, 0.5, 3.5)).toBe(2);
  });
});

describe("panBy", () => {
  it("desplaza sin tocar la escala", () => {
    const pan = { x: 10, y: 10, scale: 2 };
    const next = panBy(pan, 5, -3);
    expect(next).toEqual({ x: 15, y: 7, scale: 2 });
  });
});

describe("pixelsToUnits", () => {
  it("convierte un delta de pantalla a unidades del mapa", () => {
    // Contenedor de 500px representando un viewBox de 1000 unidades: cada
    // píxel de pantalla vale 2 unidades del mapa.
    expect(pixelsToUnits(50, 500, 1000)).toBeCloseTo(100);
  });

  it("no revienta con un contenedor sin medir todavía", () => {
    expect(pixelsToUnits(50, 0, 1000)).toBe(50);
  });
});
