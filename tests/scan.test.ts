import { describe, expect, it } from "vitest";
import {
  DEBOUNCE_MINUTES,
  applyBonus,
  applyInvitationRedeem,
  applyRewardRedeem,
  applyStamp,
  decideScan,
  requiresConfirmation,
} from "@/lib/scan";

const NOW = new Date("2026-03-01T09:00:00Z");

function minutesAgo(minutes: number): Date {
  return new Date(NOW.getTime() - minutes * 60_000);
}

const base = {
  now: NOW,
  lastScanAt: null,
  hasClaimedInvitation: false,
  rewardPending: false,
};

describe("antirrebote", () => {
  it("dos escaneos dentro de 5 minutos devuelven duplicado", () => {
    const result = decideScan({ ...base, lastScanAt: minutesAgo(2) });
    expect(result).toEqual({ action: "duplicate", minutesAgo: 2 });
  });

  it("pasados los 5 minutos vuelve a sellar", () => {
    const result = decideScan({ ...base, lastScanAt: minutesAgo(DEBOUNCE_MINUTES) });
    expect(result).toEqual({ action: "stamp" });
  });

  it("el duplicado gana incluso con café pendiente: no se regala por un rebote", () => {
    const result = decideScan({
      ...base,
      lastScanAt: minutesAgo(1),
      rewardPending: true,
    });
    expect(result.action).toBe("duplicate");
  });

  it("una confirmación explícita del barista salta el antirrebote", () => {
    const result = decideScan({
      ...base,
      lastScanAt: minutesAgo(1),
      rewardPending: true,
      confirmed: true,
    });
    expect(result).toEqual({ action: "redeem_reward" });
  });
});

describe("prioridad de acciones", () => {
  it("la invitación se canjea antes que la recompensa", () => {
    const result = decideScan({
      ...base,
      hasClaimedInvitation: true,
      rewardPending: true,
    });
    expect(result).toEqual({ action: "redeem_invitation" });
  });

  it("el caso normal es sellar", () => {
    expect(decideScan(base)).toEqual({ action: "stamp" });
  });

  it("solo lo que regala producto pide confirmación", () => {
    expect(requiresConfirmation("stamp")).toBe(false);
    expect(requiresConfirmation("duplicate")).toBe(false);
    expect(requiresConfirmation("redeem_reward")).toBe(true);
    expect(requiresConfirmation("redeem_invitation")).toBe(true);
  });
});

describe("tarjeta de sellos", () => {
  const empty = { stamps: 0, cardsCompleted: 0, rewardPending: false };

  it("suma un sello sin cerrar la tarjeta", () => {
    const { pass, cardCompleted } = applyStamp({ ...empty, stamps: 3 }, 10);
    expect(pass.stamps).toBe(4);
    expect(cardCompleted).toBe(false);
    expect(pass.rewardPending).toBe(false);
  });

  it("al llegar a la meta cierra la tarjeta y deja un café pendiente", () => {
    const { pass, cardCompleted } = applyStamp({ ...empty, stamps: 9 }, 10);
    expect(cardCompleted).toBe(true);
    expect(pass.stamps).toBe(0);
    expect(pass.cardsCompleted).toBe(1);
    expect(pass.rewardPending).toBe(true);
  });

  it("el café de invitación cuenta como primer sello", () => {
    expect(applyInvitationRedeem(empty).stamps).toBe(1);
  });

  it("canjear la recompensa solo apaga el pendiente", () => {
    const pass = applyRewardRedeem({ stamps: 2, cardsCompleted: 1, rewardPending: true });
    expect(pass.rewardPending).toBe(false);
    expect(pass.stamps).toBe(2);
  });
});

describe("bonus del padrino", () => {
  it("suma exactamente los sellos configurados", () => {
    const pass = applyBonus({ stamps: 2, cardsCompleted: 0, rewardPending: false }, 3, 10);
    expect(pass.stamps).toBe(5);
    expect(pass.cardsCompleted).toBe(0);
  });

  it("si el bonus completa la tarjeta, la cierra y arrastra el resto", () => {
    const pass = applyBonus({ stamps: 9, cardsCompleted: 1, rewardPending: false }, 3, 10);
    expect(pass.cardsCompleted).toBe(2);
    expect(pass.rewardPending).toBe(true);
    expect(pass.stamps).toBe(2);
  });
});
