import type { Dict } from "@/lib/i18n";
import type { NodeState } from "@/lib/giftGraph/types";

/**
 * Misma piel que ya usan los badges de /admin/atribuciones para los tres
 * estados que comparten (billable/window/discarded), extendida a los
 * cuatro que solo existen en el mapa. Una sola fuente para que el embudo,
 * la ficha y la leyenda del universo 3D no puedan desincronizarse entre sí.
 *
 * opened → azul del veredicto "redeem_invitation" del escáner (el
 * precedente más cercano: no tiene badge propio todavía). expired → coral
 * sólido, igual que la puerta "below" del embudo. sent → sin relleno,
 * a juego con el nodo wireframe del universo: todavía no es cliente.
 * direct → teal, un tono que no usa ningún otro estado: cliente real dado
 * de alta por QR, sin invitación de nadie, así que no tiene equivalente
 * en /admin/atribuciones -esa tabla solo existe para pares padrino/ahijado.
 *
 * La constelación de /admin/atribuciones/mapa pinta "abierta" en ámbar por
 * su propia especificación visual (SALTOS_STATE_COLOR en SaltosMap.tsx):
 * ese override es solo de esa vista y no toca este mapa compartido, para
 * no cambiar el color de "abierta" en el embudo real ni en el universo 3D.
 */
export const STATE_BADGE_SKIN: Record<NodeState, string> = {
  billable: "bg-lime text-ink",
  direct: "bg-teal text-ink",
  window: "bg-white/8 text-chalk/60",
  discarded: "bg-white/8 text-chalk/35",
  opened: "bg-azure text-ink",
  expired: "bg-coral text-ink",
  sent: "border border-white/15 text-chalk/45",
};

/**
 * Los mismos colores de STATE_BADGE_SKIN, pero como valor de color pintable
 * -var(--color-x)-, no como clase de Tailwind: hace falta para pintar un
 * <circle> o <path> de SVG, donde una clase de fondo no sirve.
 */
export const STATE_LINE_COLOR: Record<NodeState, string> = {
  billable: "var(--color-lime)",
  direct: "var(--color-teal)",
  window: "var(--color-slate)",
  discarded: "var(--color-slate)",
  opened: "var(--color-azure)",
  expired: "var(--color-coral)",
  sent: "var(--color-slate)",
};

export function stateBadgeLabel(state: NodeState, t: Dict): string {
  const label: Record<NodeState, string> = {
    billable: t.admin.attrBillable,
    direct: t.admin.attrDirect,
    window: t.admin.attrWindow,
    discarded: t.admin.attrDiscarded,
    opened: t.admin.attrOpened,
    sent: t.admin.attrSent,
    expired: t.admin.attrExpired,
  };
  return label[state];
}
