import { CanvasTexture } from "three";

let cached: CanvasTexture | null = null;

/**
 * Textura de un gradiente radial (centro blanco opaco, bordes transparentes)
 * generada en un <canvas> 2D, para los sprites de brillo. Una sola vez,
 * compartida por todos los sprites — nunca por sprite.
 */
export function getGlowTexture(): CanvasTexture {
  if (cached) return cached;

  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;

  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, "rgba(255,255,255,1)");
  gradient.addColorStop(0.35, "rgba(255,255,255,0.45)");
  gradient.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);

  cached = new CanvasTexture(canvas);
  return cached;
}
