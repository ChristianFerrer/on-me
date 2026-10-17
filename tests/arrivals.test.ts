import { describe, expect, it } from "vitest";
import { ARRIVAL_TTL_MS, arrivalStatus, summarizeArrivals } from "@/lib/arrivals";

const now = Date.parse("2026-10-17T10:00:00Z");
const at = (ms: number) => new Date(now + ms).toISOString();

describe("estado de una llegada", () => {
  it("está pendiente mientras no caduca", () => {
    expect(arrivalStatus({ expires_at: at(ARRIVAL_TTL_MS), handled_at: null }, now)).toBe("pending");
  });

  it("caduca sola si nadie la atiende", () => {
    expect(arrivalStatus({ expires_at: at(-1), handled_at: null }, now)).toBe("expired");
    expect(arrivalStatus({ expires_at: at(0), handled_at: null }, now)).toBe("expired");
  });

  it("atendida gana a caducada: el sello ya se puso", () => {
    expect(arrivalStatus({ expires_at: at(-60_000), handled_at: at(-90_000) }, now)).toBe("handled");
  });

  it("dura lo justo para una cola, no una mañana", () => {
    expect(ARRIVAL_TTL_MS).toBeLessThanOrEqual(5 * 60_000);
  });
});

describe("resumen de llegadas", () => {
  it("separa atendidas, sin atender y vivas", () => {
    const rows = [
      { expires_at: at(-1_000), handled_at: at(-30_000) }, // atendida
      { expires_at: at(-1_000), handled_at: null }, // sin atender
      { expires_at: at(60_000), handled_at: null }, // viva: aún no cuenta
    ];
    expect(summarizeArrivals(rows, now)).toEqual({ total: 3, handled: 1, unattended: 1 });
  });

  it("sin avisos, todo a cero", () => {
    expect(summarizeArrivals([], now)).toEqual({ total: 0, handled: 0, unattended: 0 });
  });
});
