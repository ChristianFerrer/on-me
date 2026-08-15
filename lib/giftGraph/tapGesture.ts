export type PointerPoint = { x: number; y: number; t: number };

const TAP_MAX_DISTANCE_PX = 10;
const TAP_MAX_DURATION_MS = 300;

/**
 * Distingue un toque (selección) de un arrastre (girar/mover la cámara): solo
 * cuenta como toque si el dedo no se movió más de `maxDistancePx` y soltó
 * antes de `maxDurationMs`. Función pura para poder testearla sin simular una
 * pantalla táctil real. Los valores por defecto son los del universo 3D; la
 * constelación de saltos pasa sus propios umbrales (8px/400ms).
 */
export function isTap(
  down: PointerPoint,
  up: PointerPoint,
  maxDistancePx = TAP_MAX_DISTANCE_PX,
  maxDurationMs = TAP_MAX_DURATION_MS,
): boolean {
  const distance = Math.hypot(up.x - down.x, up.y - down.y);
  const duration = up.t - down.t;
  return distance <= maxDistancePx && duration <= maxDurationMs;
}
