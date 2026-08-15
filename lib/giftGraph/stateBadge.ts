import type { Dict } from "@/lib/i18n";
import type { NodeState } from "@/lib/giftGraph/types";

/**
 * Misma piel que ya usan los badges de /admin/atribuciones para los tres
 * estados que comparten (billable/window/discarded), extendida a los tres
 * que solo existen en el mapa. Una sola fuente para que el mapa, la ficha
 * y la leyenda no puedan desincronizarse entre sí ni se invente paleta.
 *
 * opened → azul del veredicto "redeem_invitation" del escáner (el
 * precedente más cercano: no tiene badge propio todavía). expired → coral
 * sólido, igual que la puerta "below" del embudo. sent → sin relleno,
 * a juego con el nodo wireframe del universo: todavía no es cliente.
 */
export const STATE_BADGE_SKIN: Record<NodeState, string> = {
  billable: "bg-lime text-ink",
  window: "bg-white/8 text-chalk/60",
  discarded: "bg-white/8 text-chalk/35",
  opened: "bg-azure text-ink",
  expired: "bg-coral text-ink",
  sent: "border border-white/15 text-chalk/45",
};

export function stateBadgeLabel(state: NodeState, t: Dict): string {
  const label: Record<NodeState, string> = {
    billable: t.admin.attrBillable,
    window: t.admin.attrWindow,
    discarded: t.admin.attrDiscarded,
    opened: t.admin.attrOpened,
    sent: t.admin.attrSent,
    expired: t.admin.attrExpired,
  };
  return label[state];
}
