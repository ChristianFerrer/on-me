import { describe, expect, it } from "vitest";
import {
  applyBonus,
  applyInvitationRedeem,
  applyRewardRedeem,
  applyStamp,
  decideScan,
  requiresConfirmation,
} from "@/lib/scan";

const base = {
  hasClaimedInvitation: false,
  rewardPending: false,
};

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

  it("sin restricción de tiempo: escanear al mismo cliente varias veces seguidas sella cada vez", () => {
    expect(decideScan(base)).toEqual({ action: "stamp" });
    expect(decideScan(base)).toEqual({ action: "stamp" });
    expect(decideScan(base)).toEqual({ action: "stamp" });
  });

  it("solo lo que regala producto pide confirmación", () => {
    expect(requiresConfirmation("stamp")).toBe(false);
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
