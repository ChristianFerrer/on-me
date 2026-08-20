import { fill, type Dict } from "@/lib/i18n";
import type { NodeState } from "@/lib/giftGraph/types";

/**
 * Un solo vocabulario de sucesos para las dos fuentes que alimentan el feed
 * de actividad de la vista sol -el sondeo real cada 20s (ver
 * detectGraphActivity en ConstelacionSolMap) y el modo simulación (ver
 * simulateActivity.ts)-, para que ambos hablen el mismo idioma y el
 * componente no tenga que traducir entre dos vocabularios distintos según
 * de dónde vino el suceso.
 */
export type LiveEventKind =
  | "new_direct"
  | "new_invite"
  | "invite_opened"
  | "claimed"
  | "invite_expiring"
  | "invite_expired"
  | "stamp"
  | "redeemed"
  | "returned";

/**
 * Frase legible de un suceso, ya traducida. `name` es quien protagoniza el
 * suceso -el propio cliente para new_direct/claimed/stamp/redeemed/returned,
 * quien invita para new_invite-; "opened"/"expiring"/"expired" no llevan
 * nombre -una invitación sin reclamar no tiene ficha propia, ver
 * Node.claimed en lib/giftGraph/types.ts-, así que esas tres frases se
 * quedan genéricas a propósito; "claimed" es justo el momento en que esa
 * invitación deja de ser anónima y por fin tiene nombre. `stampNumber` -solo
 * para "stamp"- es qué número de sello acaba de ganar, no cuántos van en
 * total: sin él el mensaje decía "ganó un sello" sin más contexto, aunque
 * llevara la tarjeta a la mitad o casi completa.
 */
export function liveEventMessage(kind: LiveEventKind, name: string, t: Dict, stampNumber?: number): string {
  switch (kind) {
    case "new_direct":
      return fill(t.admin.constelacionActionNewDirect, { name });
    case "new_invite":
      return fill(t.admin.constelacionActionNewInvite, { name });
    case "invite_opened":
      return t.admin.constelacionActionInviteOpened;
    case "claimed":
      return fill(t.admin.constelacionActionClaimed, { name });
    case "invite_expiring":
      return t.admin.constelacionActionInviteExpiring;
    case "invite_expired":
      return t.admin.constelacionActionInviteExpired;
    case "stamp":
      return fill(t.admin.constelacionActionStamp, { name, n: stampNumber ?? 0 });
    case "redeemed":
      return fill(t.admin.constelacionActionRedeemed, { name });
    case "returned":
      return fill(t.admin.constelacionActionReturned, { name });
  }
}

/**
 * Segunda línea, más discreta, con el "un poco más de información" que la
 * frase principal por sí sola no cuenta -de qué color quedó la estrella, o
 * qué viene después-. `state` es el de la estrella YA aplicado el suceso
 * -mismo criterio que LiveActivityEvent.state en el componente-, así que
 * "redeemed" puede leerse distinto según si de verdad entró en ventana de
 * retorno (se dio de alta por invitación, su primer canje) o si solo sumó
 * otra tarjeta a un estado que ya era final (directo/facturable, ver
 * redeemCard en simulateActivity.ts).
 */
export function liveEventDetail(kind: LiveEventKind, t: Dict, ctx: { state: NodeState; stampsGoal: number; stampNumber?: number }): string {
  switch (kind) {
    case "new_direct":
      return t.admin.constelacionActionDetailNewDirect;
    case "new_invite":
      return t.admin.constelacionActionDetailNewInvite;
    case "invite_opened":
      return t.admin.constelacionActionDetailInviteOpened;
    case "claimed":
      return t.admin.constelacionActionDetailClaimed;
    case "invite_expiring":
      return t.admin.constelacionActionDetailInviteExpiring;
    case "invite_expired":
      return t.admin.constelacionActionDetailInviteExpired;
    case "stamp": {
      const remaining = Math.max(ctx.stampsGoal - (ctx.stampNumber ?? 0), 0);
      return fill(t.admin.constelacionActionDetailStamp, { n: remaining });
    }
    case "redeemed":
      return ctx.state === "window" ? t.admin.constelacionActionDetailRedeemedWindow : t.admin.constelacionActionDetailRedeemedGrowing;
    case "returned":
      return t.admin.constelacionActionDetailReturned;
  }
}
