const MIN_RADIUS = 0.55;
const MAX_RADIUS = 2.6;

/**
 * Radio de una esfera de persona según cuánta gente ha invitado. Escala en
 * raíz, no lineal: con lineal un nodo con 20 invitados aplastaría al resto.
 */
export function computeRadius(invitedCount: number): number {
  const raw = MIN_RADIUS + 0.42 * Math.sqrt(Math.max(0, invitedCount));
  return Math.min(MAX_RADIUS, Math.max(MIN_RADIUS, raw));
}

/** Hash determinista de un string a [0, 1). El mismo id siempre da el mismo valor. */
export function hash01(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 1_000_000) / 1_000_000;
}

/**
 * Multiplicador de "respiración": oscila ±2.5% con un periodo propio (entre
 * `minPeriodMs` y `maxPeriodMs`, según el hash del nodo) y una fase propia,
 * para que ningún par de nodos respire al mismo compás.
 */
export function breathingScale(
  elapsedMs: number,
  seed: string,
  minPeriodMs = 5000,
  maxPeriodMs = 9000,
): number {
  const period = minPeriodMs + hash01(`${seed}:period`) * (maxPeriodMs - minPeriodMs);
  const phase = hash01(`${seed}:phase`) * Math.PI * 2;
  return 1 + Math.sin((elapsedMs / period) * Math.PI * 2 + phase) * 0.025;
}
