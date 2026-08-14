import { describe, expect, it } from "vitest";
import { assertServiceRole } from "@/lib/db/client";

/** Construye un JWT de mentira con el rol pedido. La firma da igual. */
function fakeJwt(role: string): string {
  const head = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString(
    "base64url",
  );
  const body = Buffer.from(JSON.stringify({ iss: "supabase", role })).toString(
    "base64url",
  );
  return `${head}.${body}.firma-irrelevante`;
}

describe("la clave configurada tiene que ser la service_role", () => {
  it("acepta el JWT heredado con rol service_role", () => {
    expect(() => assertServiceRole(fakeJwt("service_role"))).not.toThrow();
  });

  it("acepta el formato nuevo de clave secreta", () => {
    expect(() => assertServiceRole("sb_secret_abc123")).not.toThrow();
  });

  it("rechaza la clave pública heredada, que es el error que duele", () => {
    // Con esta clave el RLS deniega todo, Supabase responde 200 con lista
    // vacía y cada pantalla se pinta como "esto no existe", sin ningún error.
    expect(() => assertServiceRole(fakeJwt("anon"))).toThrow(/anon/);
  });

  it("rechaza la clave publicable del formato nuevo", () => {
    expect(() => assertServiceRole("sb_publishable_abc123")).toThrow(
      /publicable/,
    );
  });

  it("rechaza cualquier cosa que no parezca una clave", () => {
    for (const bad of ["", "no-es-un-jwt", "a.b"]) {
      expect(() => assertServiceRole(bad)).toThrow();
    }
  });
});
