import { describe, expect, it } from "vitest";
import {
  GATE_CONFIG,
  RETURN_MIN_HOURS,
  evaluateAttribution,
  evaluateGate,
} from "@/lib/attribution";

const REDEEMED = new Date("2026-03-01T10:00:00Z");
const WINDOW_DAYS = 30;

function hoursAfterRedeem(hours: number): Date {
  return new Date(REDEEMED.getTime() + hours * 3_600_000);
}

function stamp(id: string, hours: number) {
  return { id, createdAt: hoursAfterRedeem(hours), kind: "stamp" };
}

describe("condición 4 · segunda compra con más de 24 h de separación", () => {
  it("factura cuando el invitado vuelve a las 25 h", () => {
    const result = evaluateAttribution({
      now: hoursAfterRedeem(30),
      redeemedAt: REDEEMED,
      returnWindowDays: WINDOW_DAYS,
      scans: [stamp("scan-25h", 25)],
    });

    expect(result.state).toBe("billable");
    if (result.state === "billable") {
      expect(result.returnScanId).toBe("scan-25h");
      expect(result.returnedAt).toEqual(hoursAfterRedeem(25));
    }
  });

  it("no factura cuando el invitado vuelve a las 20 h", () => {
    const result = evaluateAttribution({
      now: hoursAfterRedeem(30),
      redeemedAt: REDEEMED,
      returnWindowDays: WINDOW_DAYS,
      scans: [stamp("scan-20h", 20)],
    });

    // Todavía en ventana: puede volver otro día y entonces sí contará.
    expect(result.state).toBe("window");
  });

  it("no factura justo en las 24 h: el umbral es estrictamente mayor", () => {
    const result = evaluateAttribution({
      now: hoursAfterRedeem(48),
      redeemedAt: REDEEMED,
      returnWindowDays: WINDOW_DAYS,
      scans: [stamp("scan-24h", RETURN_MIN_HOURS)],
    });

    expect(result.state).toBe("window");
  });

  it("un canje no cuenta como compra: solo un sello prueba que pagó", () => {
    const result = evaluateAttribution({
      now: hoursAfterRedeem(72),
      redeemedAt: REDEEMED,
      returnWindowDays: WINDOW_DAYS,
      scans: [
        { id: "otro-canje", createdAt: hoursAfterRedeem(48), kind: "redeem_reward" },
        { id: "duplicado", createdAt: hoursAfterRedeem(50), kind: "duplicate" },
      ],
    });

    expect(result.state).toBe("window");
  });

  it("toma la primera compra válida cuando hay varias", () => {
    const result = evaluateAttribution({
      now: hoursAfterRedeem(200),
      redeemedAt: REDEEMED,
      returnWindowDays: WINDOW_DAYS,
      scans: [stamp("tercera", 100), stamp("primera", 26), stamp("segunda", 60)],
    });

    expect(result.state).toBe("billable");
    if (result.state === "billable") expect(result.returnScanId).toBe("primera");
  });
});

describe("condición 5 · todo dentro de la ventana de retorno", () => {
  it("descarta cuando la ventana se cierra sin retorno", () => {
    const result = evaluateAttribution({
      now: hoursAfterRedeem(WINDOW_DAYS * 24 + 1),
      redeemedAt: REDEEMED,
      returnWindowDays: WINDOW_DAYS,
      scans: [],
    });

    expect(result).toEqual({ state: "discarded", reason: "window_closed" });
  });

  it("no factura una compra posterior al cierre de la ventana", () => {
    const result = evaluateAttribution({
      now: hoursAfterRedeem(WINDOW_DAYS * 24 + 48),
      redeemedAt: REDEEMED,
      returnWindowDays: WINDOW_DAYS,
      scans: [stamp("tarde", WINDOW_DAYS * 24 + 5)],
    });

    expect(result).toEqual({ state: "discarded", reason: "window_closed" });
  });

  it("sigue en ventana mientras no haya vencido y no haya retorno", () => {
    const result = evaluateAttribution({
      now: hoursAfterRedeem(48),
      redeemedAt: REDEEMED,
      returnWindowDays: WINDOW_DAYS,
      scans: [],
    });

    expect(result).toEqual({ state: "window" });
  });
});

describe("puertas del piloto", () => {
  it("no emite veredicto sin muestra suficiente", () => {
    // 2 de 7 es un 28,6%, por encima del umbral del 25%... y no significa nada.
    const gate = evaluateGate("p2", 2, 7, GATE_CONFIG.p2.threshold, GATE_CONFIG.p2.minSample);

    expect(gate.verdict).toBe("insufficient_sample");
    expect(gate.ratio).toBeCloseTo(0.2857, 3);
  });

  it("pasa con muestra suficiente y por encima del umbral", () => {
    const gate = evaluateGate("p1", 12, 25, GATE_CONFIG.p1.threshold, GATE_CONFIG.p1.minSample);
    expect(gate.verdict).toBe("pass");
  });

  it("marca por debajo con muestra suficiente", () => {
    const gate = evaluateGate("p3", 2, 20, GATE_CONFIG.p3.threshold, GATE_CONFIG.p3.minSample);
    expect(gate.verdict).toBe("below");
  });

  it("con denominador cero no inventa un porcentaje", () => {
    const gate = evaluateGate("p1", 0, 0, GATE_CONFIG.p1.threshold, GATE_CONFIG.p1.minSample);
    expect(gate.ratio).toBeNull();
    expect(gate.verdict).toBe("insufficient_sample");
  });
});
