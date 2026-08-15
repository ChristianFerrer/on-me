import { Color } from "three";
import type { NodeState } from "@/lib/giftGraph/types";

/** Mismos tokens que app/globals.css (@theme), en hex: three.js no puede leer var(--...). */
export const VOID = "#070908";
/** Fondo del universo 3D: casi negro, pero no negro puro, para dar profundidad. */
export const DEEP_VOID = "#05060A";
export const INK = "#0e1211";
export const INK_2 = "#171c1a";
export const CHALK = "#f5f7f5";
export const LIME = "#d2fb4f";
export const SLATE = "#5d6b64";
export const AZURE = "#60a5fa";
export const CORAL = "#fb7185";
export const AMBER = "#fbbf24";
export const TEAL = "#2dd4bf";
export const MINT = "#4ade80";

export const LIME_COLOR = new Color(LIME);
export const CHALK_COLOR = new Color(CHALK);

export function dimColor(color: Color, amount: number): Color {
  return color.clone().lerp(new Color(INK_2), amount);
}

/**
 * Mismo mapeo estado → color que ya usan los badges de /admin/atribuciones
 * (STATE_SKIN): billable = lime (éxito), window = slate (el único acento
 * neutro de la paleta), discarded = ese mismo slate pero más apagado
 * -como el badge real, que es igual pero con menos opacidad-, expired =
 * coral (el color de alerta que ya usa el veredicto de escaneo inválido).
 * "opened" no tiene badge propio todavía: azure es el precedente más
 * cercano (invitación redimida, en el veredicto del escáner). "sent" no
 * devuelve relleno -se pinta en wireframe, sin color de superficie.
 */
export function stateColor(state: NodeState): Color {
  switch (state) {
    case "billable":
      return new Color(LIME);
    case "direct":
      return new Color(TEAL);
    case "claimed":
      return new Color(MINT);
    case "window":
      return new Color(SLATE);
    case "discarded":
      return dimColor(new Color(SLATE), 0.55);
    case "opened":
      return new Color(AZURE);
    case "expired":
      return new Color(CORAL);
    case "sent":
      return new Color(SLATE);
  }
}
