import { describe, expect, it } from "vitest";
import { assertNoQueryError } from "@/lib/db/client";

describe("assertNoQueryError distingue error real de ausencia legítima", () => {
  it("no hace nada si no hay error", () => {
    expect(() => assertNoQueryError(null, "ctx")).not.toThrow();
  });

  it("lanza cuando Supabase devuelve un error, en vez de leerlo como 'no existe'", () => {
    // Este es el fallo real: antes, un error de credenciales o de proyecto
    // se disfrazaba de "esto no existe" en cada pantalla, porque el código
    // solo miraba `data` y nunca `error`.
    let thrown: Error | null = null;
    try {
      assertNoQueryError(
        { message: "JWT expired", code: "PGRST301" },
        "shops.slug=madness",
      );
    } catch (error) {
      thrown = error as Error;
    }

    expect(thrown).not.toBeNull();
    expect(thrown?.message).toContain("shops.slug=madness");
    expect(thrown?.message).toContain("JWT expired");
    expect(thrown?.message).toContain("PGRST301");
  });

  it("incluye 'desconocido' cuando el error no trae código", () => {
    let thrown: Error | null = null;
    try {
      assertNoQueryError({ message: "network error" }, "ctx");
    } catch (error) {
      thrown = error as Error;
    }

    expect(thrown?.message).toContain("desconocido");
  });
});
