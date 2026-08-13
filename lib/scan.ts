/**
 * Decisión de un escaneo. Lógica pura: ni Next, ni Supabase, ni red.
 * Todo lo que entra son datos y todo lo que sale es una decisión, así que
 * se puede testear entera sin levantar nada.
 */

/** Antirrebote: dos escaneos del mismo cliente dentro de esta ventana no suman. */
export const DEBOUNCE_MINUTES = 5;

export type InvalidReason = "device" | "other_shop" | "unknown_token";

export type ScanAction =
  | { action: "stamp" }
  | { action: "redeem_invitation" }
  | { action: "redeem_reward" }
  | { action: "duplicate"; minutesAgo: number };

export type ScanContext = {
  now: Date;
  /** Último escaneo registrado de este cliente, o null si nunca vino. */
  lastScanAt: Date | null;
  /** Tiene una invitación reclamada y todavía sin canjear. */
  hasClaimedInvitation: boolean;
  /** Completó tarjeta y aún no se ha llevado el café gratis. */
  rewardPending: boolean;
  /**
   * Segunda llamada, ya confirmada por el barista con PIN. Salta el
   * antirrebote a propósito: es una acción humana explícita, no un rebote
   * del lector de QR.
   */
  confirmed?: boolean;
};

/**
 * El orden importa y es deliberado:
 *
 *   1. antirrebote — protege del doble sellado por rebote del lector
 *   2. invitación  — un cliente nuevo canjea antes que nada
 *   3. recompensa  — tarjeta completa pendiente de café
 *   4. sello       — el caso normal, el 95% de los escaneos
 *
 * El antirrebote va primero incluso por delante de la recompensa: si alguien
 * acaba de sellar hace un minuto, la respuesta correcta es "ya sellado" y que
 * el barista lo repita, no regalar un café por un rebote de cámara.
 */
export function decideScan(ctx: ScanContext): ScanAction {
  if (!ctx.confirmed && ctx.lastScanAt) {
    const minutesAgo = minutesBetween(ctx.lastScanAt, ctx.now);
    if (minutesAgo < DEBOUNCE_MINUTES) {
      return { action: "duplicate", minutesAgo };
    }
  }

  if (ctx.hasClaimedInvitation) return { action: "redeem_invitation" };
  if (ctx.rewardPending) return { action: "redeem_reward" };
  return { action: "stamp" };
}

/**
 * ¿Esta acción muta algo sin preguntar?
 *
 * El sello es inmediato: si el barista tuviese que confirmar cada café, el
 * gesto no cabe en tres segundos y el sistema muere por sabotaje pasivo.
 * Las dos acciones que regalan producto sí piden confirmación y PIN.
 */
export function requiresConfirmation(action: ScanAction["action"]): boolean {
  return action === "redeem_reward" || action === "redeem_invitation";
}

// ------------------------------------------------------------------- pases

export type PassState = {
  stamps: number;
  cardsCompleted: number;
  rewardPending: boolean;
};

export type StampOutcome = {
  pass: PassState;
  /** La tarjeta se ha completado con este sello. */
  cardCompleted: boolean;
};

/**
 * Suma un sello. Al llegar a la meta la tarjeta se cierra, el contador
 * vuelve a cero y queda un café pendiente de canjear.
 */
export function applyStamp(pass: PassState, goal: number): StampOutcome {
  const stamps = pass.stamps + 1;

  if (stamps >= goal) {
    return {
      pass: {
        stamps: 0,
        cardsCompleted: pass.cardsCompleted + 1,
        rewardPending: true,
      },
      cardCompleted: true,
    };
  }

  return {
    pass: { ...pass, stamps },
    cardCompleted: false,
  };
}

/** El café de invitación cuenta como primer sello de su primera tarjeta. */
export function applyInvitationRedeem(pass: PassState): PassState {
  return { ...pass, stamps: 1 };
}

export function applyRewardRedeem(pass: PassState): PassState {
  return { ...pass, rewardPending: false };
}

/** Sellos de bonus al padrino cuando su invitado vuelve y paga. */
export function applyBonus(pass: PassState, bonus: number, goal: number): PassState {
  let next = pass;
  for (let i = 0; i < bonus; i++) {
    next = applyStamp(next, goal).pass;
  }
  return next;
}

// ------------------------------------------------------------------ tiempo

export function minutesBetween(from: Date, to: Date): number {
  return Math.floor((to.getTime() - from.getTime()) / 60_000);
}
