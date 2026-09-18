import { describe, expect, it } from "vitest";
import {
  applyBonus,
  applyInvitationRedeem,
  applyRewardRedeem,
  applyStamp,
  applyStampBatch,
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
  const empty = { stamps: 0, cardsCompleted: 0, rewardsPending: 0 };

  it("suma un sello sin cerrar la tarjeta", () => {
    const { pass, cardCompleted } = applyStamp({ ...empty, stamps: 3 }, 10);
    expect(pass.stamps).toBe(4);
    expect(cardCompleted).toBe(false);
    expect(pass.rewardsPending).toBe(0);
  });

  it("al llegar a la meta cierra la tarjeta y suma un café pendiente", () => {
    const { pass, cardCompleted } = applyStamp({ ...empty, stamps: 9 }, 10);
    expect(cardCompleted).toBe(true);
    expect(pass.stamps).toBe(0);
    expect(pass.cardsCompleted).toBe(1);
    expect(pass.rewardsPending).toBe(1);
  });

  it("completar una tarjeta con otra ya pendiente no la pierde: se acumulan", () => {
    const { pass } = applyStamp({ stamps: 9, cardsCompleted: 1, rewardsPending: 1 }, 10);
    expect(pass.rewardsPending).toBe(2);
  });

  it("el café de invitación cuenta como primer sello", () => {
    expect(applyInvitationRedeem(empty).stamps).toBe(1);
  });

  it("canjear la recompensa resta uno, por defecto", () => {
    const pass = applyRewardRedeem({ stamps: 2, cardsCompleted: 1, rewardsPending: 2 });
    expect(pass.rewardsPending).toBe(1);
    expect(pass.stamps).toBe(2);
  });

  it("canjear varios de golpe resta esa cantidad, sin bajar de cero", () => {
    const pass = applyRewardRedeem({ stamps: 2, cardsCompleted: 1, rewardsPending: 2 }, 5);
    expect(pass.rewardsPending).toBe(0);
  });
});

describe("applyStampBatch", () => {
  const empty = { stamps: 0, cardsCompleted: 0, rewardsPending: 0 };

  it("aplica toda la cantidad pedida cuando no completa ninguna tarjeta", () => {
    const batch = applyStampBatch({ ...empty, stamps: 2 }, 10, 3);
    expect(batch.applied).toBe(3);
    expect(batch.rewardsEarned).toBe(0);
    expect(batch.pass.stamps).toBe(5);
  });

  it("con 8 sellos y 4 cafés pedidos, completa la tarjeta y los 2 que sobran arrancan la siguiente", () => {
    const batch = applyStampBatch({ ...empty, stamps: 8 }, 10, 4);
    expect(batch.applied).toBe(4);
    expect(batch.rewardsEarned).toBe(1);
    expect(batch.pass.stamps).toBe(2);
    expect(batch.pass.cardsCompleted).toBe(1);
    expect(batch.pass.rewardsPending).toBe(1);
  });

  it("puede completar más de una tarjeta en la misma tanda con una meta pequeña", () => {
    const batch = applyStampBatch(empty, 2, 5);
    expect(batch.applied).toBe(5);
    expect(batch.rewardsEarned).toBe(2);
    expect(batch.pass.stamps).toBe(1);
    expect(batch.pass.rewardsPending).toBe(2);
  });
});

describe("bonus del padrino", () => {
  it("suma exactamente los sellos configurados", () => {
    const pass = applyBonus({ stamps: 2, cardsCompleted: 0, rewardsPending: 0 }, 3, 10);
    expect(pass.stamps).toBe(5);
    expect(pass.cardsCompleted).toBe(0);
  });

  it("si el bonus completa la tarjeta, la cierra y arrastra el resto", () => {
    const pass = applyBonus({ stamps: 9, cardsCompleted: 1, rewardsPending: 0 }, 3, 10);
    expect(pass.cardsCompleted).toBe(2);
    expect(pass.rewardsPending).toBe(1);
    expect(pass.stamps).toBe(2);
  });
});
