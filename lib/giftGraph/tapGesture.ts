export type PointerPoint = { x: number; y: number; t: number };

const TAP_MAX_DISTANCE_PX = 10;
const TAP_MAX_DURATION_MS = 300;

/**
 * Distingue un toque (selección) de un arrastre (girar/mover la cámara): solo
 * cuenta como toque si el dedo no se movió más de 10px y soltó antes de 300ms.
 * Función pura para poder testearla sin simular una pantalla táctil real.
 */
export function isTap(down: PointerPoint, up: PointerPoint): boolean {
  const distance = Math.hypot(up.x - down.x, up.y - down.y);
  const duration = up.t - down.t;
  return distance <= TAP_MAX_DISTANCE_PX && duration <= TAP_MAX_DURATION_MS;
}
