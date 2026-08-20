import { fill, type Dict } from "@/lib/i18n";

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
  | "invite_expiring"
  | "invite_expired"
  | "stamp"
  | "redeemed"
  | "returned";

/**
 * Frase legible de un suceso, ya traducida. `name` es quien protagoniza el
 * suceso -el propio cliente para new_direct/stamp/redeemed/returned, quien
 * invita para new_invite-; las tres fases de una invitación sin reclamar
 * -opened/expiring/expired- no llevan nombre -una invitación sin reclamar
 * no tiene ficha propia, ver Node.claimed en lib/giftGraph/types.ts-, así
 * que esas tres frases se quedan genéricas a propósito.
 */
export function liveEventMessage(kind: LiveEventKind, name: string, t: Dict): string {
  switch (kind) {
    case "new_direct":
      return fill(t.admin.constelacionActionNewDirect, { name });
    case "new_invite":
      return fill(t.admin.constelacionActionNewInvite, { name });
    case "invite_opened":
      return t.admin.constelacionActionInviteOpened;
    case "invite_expiring":
      return t.admin.constelacionActionInviteExpiring;
    case "invite_expired":
      return t.admin.constelacionActionInviteExpired;
    case "stamp":
      return fill(t.admin.constelacionActionStamp, { name });
    case "redeemed":
      return fill(t.admin.constelacionActionRedeemed, { name });
    case "returned":
      return fill(t.admin.constelacionActionReturned, { name });
  }
}
