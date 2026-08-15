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

/** Un tono ligeramente distinto del acento por cadena, sin salirse de la paleta. */
export function chainColor(chainIndex: number, chainCount: number): Color {
  const color = LIME_COLOR.clone();
  const spread = chainCount <= 1 ? 0 : (chainIndex / chainCount - 0.5) * 0.22;
  color.offsetHSL(spread, 0, 0);
  return color;
}

export function dimColor(color: Color, amount: number): Color {
  return color.clone().lerp(new Color(INK_2), amount);
}
