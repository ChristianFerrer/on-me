import { beforeAll, describe, expect, it } from "vitest";

beforeAll(() => {
  // `normalizePhone` hashea, y el hash necesita sal. Cualquier valor sirve
  // para los tests: lo que se comprueba es la normalización, no el hash.
  process.env.APP_SALT = "sal-de-pruebas-0123456789abcdef";
});

const { isValidInviteCode, newInviteCode, newToken, normalizeInviteCode, normalizePhone } =
  await import("@/lib/crypto");

describe("normalización de teléfono", () => {
  it("acepta un móvil español escrito de cualquier manera", () => {
    const forms = ["600123456", "600 12 34 56", "600-12-34-56", "+34600123456", "0034600123456"];
    for (const form of forms) {
      expect(normalizePhone(form, "+34")?.e164).toBe("+34600123456");
    }
  });

  it("respeta un número extranjero con su propio prefijo", () => {
    // El público del local son en buena parte expatriados y estudiantes.
    expect(normalizePhone("+44 7700 900123", "+34")?.e164).toBe("+447700900123");
    expect(normalizePhone("+1 415 555 0132", "+34")?.e164).toBe("+14155550132");
  });

  it("quita el cero troncal antes de anteponer el prefijo del local", () => {
    expect(normalizePhone("0600123456", "+34")?.e164).toBe("+34600123456");
  });

  it("guarda los cuatro últimos dígitos en claro y nada más", () => {
    const phone = normalizePhone("+34600123456", "+34");
    expect(phone?.last4).toBe("3456");
    expect(phone?.hash).toMatch(/^[0-9a-f]{64}$/);
    expect(phone?.hash).not.toContain("600123456");
  });

  it("el mismo número siempre da el mismo hash, y dos distintos no", () => {
    const a = normalizePhone("600123456", "+34");
    const b = normalizePhone("+34 600 12 34 56", "+34");
    const c = normalizePhone("600123457", "+34");

    expect(a?.hash).toBe(b?.hash);
    expect(a?.hash).not.toBe(c?.hash);
  });

  it("rechaza lo que no es un teléfono", () => {
    for (const bad of ["", "   ", "abc", "12", "+0600123456", "+3460012345678901"]) {
      expect(normalizePhone(bad, "+34")).toBeNull();
    }
  });
});

describe("códigos de invitación", () => {
  it("no usa caracteres que se confunden al dictarlos en voz alta", () => {
    for (let i = 0; i < 400; i++) {
      const code = newInviteCode();
      expect(code).toHaveLength(6);
      expect(code).not.toMatch(/[IO01]/);
      expect(isValidInviteCode(code)).toBe(true);
    }
  });

  it("normaliza lo que el barista teclea a mano", () => {
    expect(normalizeInviteCode("  a b c 2 3 4 ")).toBe("ABC234");
  });

  it("rechaza códigos mal formados", () => {
    expect(isValidInviteCode("ABC23")).toBe(false);
    expect(isValidInviteCode("ABC2O4")).toBe(false);
  });
});

describe("tokens", () => {
  it("son 32 hex y no se repiten", () => {
    const tokens = new Set(Array.from({ length: 500 }, () => newToken()));
    expect(tokens.size).toBe(500);
    for (const token of tokens) expect(token).toMatch(/^[0-9a-f]{32}$/);
  });
});
