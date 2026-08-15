import { Color } from "three";

/** Mismos tokens que app/globals.css, en hex: three.js no puede leer var(--...). */
export const VOID = "#070908";
/** Fondo del universo 3D: casi negro, pero no negro puro, para dar profundidad. */
export const DEEP_VOID = "#05060A";
export const INK = "#0e1211";
export const INK_2 = "#171c1a";
export const CHALK = "#f5f7f5";
export const LIME = "#d2fb4f";

export const LIME_COLOR = new Color(LIME);
export const CHALK_COLOR = new Color(CHALK);

/**
 * Un tono que se desliza por el espectro según cuántos saltos hay hasta el
 * local: depth 1 (los primeros invitados) se queda en el propio acento,
 * y cada salto más allá gira un poco más el matiz. Así de un vistazo se
 * distingue cuánto de lejos viene cada persona en su cadena.
 */
export function depthColor(depth: number): Color {
  const color = LIME_COLOR.clone();
  const hueShift = ((Math.max(1, depth) - 1) * 0.085) % 1;
  color.offsetHSL(hueShift, 0, 0);
  return color;
}

export function dimColor(color: Color, amount: number): Color {
  return color.clone().lerp(new Color(INK_2), amount);
}
