/**
 * Decisión de un escaneo. Lógica pura: ni Next, ni Supabase, ni red.
 * Todo lo que entra son datos y todo lo que sale es una decisión, así que
 * se puede testear entera sin levantar nada.
 */

export type InvalidReason = "device" | "other_shop" | "unknown_token" | "network";

export type ScanAction =
  | { action: "stamp" }
  | { action: "redeem_invitation" }
  | { action: "redeem_reward" };

/**
 * Lo que la barra recibe y pinta a pantalla completa.
 * Vive en el módulo puro para que el componente de cliente pueda importarlo
 * con `import type` sin arrastrar nada de servidor.
 */
export type ScanResponse =
  | {
      kind: "stamp";
      name: string;
      /** Sellos de la tarjeta activa tras esta acción -la nueva, si alguna se completó y sobraron cafés-. */
      stamps: number;
      goal: number;
      /**
       * Tarjetas completadas en esta tanda -normalmente 0-. Con el selector
       * de cantidad, pedir más cafés de los que le faltaban para el premio
       * no se para en seco: el resto sigue sumando a la tarjeta siguiente,
       * así que puede ser más de una si la cantidad pedida cruza más de un
       * límite -raro, pero posible con una meta pequeña-.
       */
      rewardsEarned: number;
      /** Sellos añadidos en esta acción -normalmente 1, más si el barista pidió varios cafés de una vez-. */
      added: number;
    }
  | { kind: "redeem_reward"; name: string; pending: boolean }
  | { kind: "redeem_invitation"; name: string; padrino: string; pending: boolean }
  | { kind: "invalid"; reason: InvalidReason };

export type ScanContext = {
  /** Tiene una invitación reclamada y todavía sin canjear. */
  hasClaimedInvitation: boolean;
  /** Completó tarjeta y aún no se ha llevado el café gratis. */
  rewardPending: boolean;
};

/**
 * El orden importa y es deliberado:
 *
 *   1. invitación  — un cliente nuevo canjea antes que nada
 *   2. recompensa  — tarjeta completa pendiente de café
 *   3. sello       — el caso normal, el 95% de los escaneos
 *
 * Sin antirrebote por tiempo: un mismo cliente puede volver a escanearse
 * segundos después del anterior sello -pide varios cafés y el barista
 * escanea uno a uno, o se le olvidó pedir el segundo a la vez-, y eso tiene
 * que sumar, no rebotar como "ya sellado". Ver también el selector de
 * cantidad en Scanner.tsx, para el caso de pedir varios cafés en el mismo
 * gesto en vez de reescanear.
 */
export function decideScan(ctx: ScanContext): ScanAction {
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
