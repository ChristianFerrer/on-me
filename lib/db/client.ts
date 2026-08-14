import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";
import type { Database } from "./types";

export type Db = SupabaseClient<Database>;

let client: Db | null = null;

/**
 * Cliente de Supabase con `service_role`. **Solo servidor.**
 *
 * Esta clave ignora RLS por diseño, que es justo el motivo de que todas las
 * tablas tengan RLS activo y ninguna política: si algo se filtrase al
 * navegador con la clave pública, no podría leer ni una fila.
 *
 * El navegador nunca importa este módulo. Habla con `/api/*` y nada más.
 */
export function db(): Db {
  if (client) return client;

  assertServiceRole(env.serviceRoleKey);

  client = createClient<Database>(env.supabaseUrl, env.serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { "x-application-name": "onme" } },
  });

  return client;
}

/**
 * Comprueba que la clave configurada es de verdad la `service_role`.
 *
 * Existe por un fallo que costó caro: si aquí se pone la clave pública por
 * error, no hay ningún síntoma de credenciales. La petición se autentica,
 * Supabase responde 200 y devuelve una lista vacía, porque el RLS niega
 * todo. La aplicación lee "cero filas" y lo pinta como "esto no existe":
 * el local desaparece, las tarjetas dejan de existir y el panel se queda en
 * blanco, sin un solo error en los registros.
 *
 * Las dos claves son cadenas largas y contiguas en el panel de Supabase, y
 * se confunden con facilidad. Es mejor romper en el arranque con un mensaje
 * claro que servir un 404 mentiroso en cada pantalla.
 */
export function assertServiceRole(key: string): void {
  // Formato nuevo de Supabase: claves opacas con prefijo explícito.
  if (key.startsWith("sb_secret_")) return;
  if (key.startsWith("sb_publishable_")) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY contiene una clave publicable (sb_publishable_…). " +
        "Hace falta la clave secreta (sb_secret_…): con la pública el RLS deniega " +
        "todo y cada pantalla responde 404.",
    );
  }

  // Formato heredado: JWT con el rol en el cuerpo.
  const role = jwtRole(key);
  if (role === "service_role") return;

  throw new Error(
    role
      ? `SUPABASE_SERVICE_ROLE_KEY contiene una clave con rol "${role}", no "service_role". ` +
          "Con la clave pública el RLS deniega todo y cada pantalla responde 404. " +
          "Cópiala de Supabase → Settings → API Keys → service_role."
      : "SUPABASE_SERVICE_ROLE_KEY no tiene un formato reconocible de clave de Supabase.",
  );
}

/** Lee el `role` del cuerpo de un JWT sin validar la firma: solo diagnostica. */
function jwtRole(key: string): string | null {
  const payload = key.split(".")[1];
  if (!payload) return null;

  try {
    const json = Buffer.from(payload, "base64url").toString("utf8");
    const claims: unknown = JSON.parse(json);
    const role = (claims as { role?: unknown } | null)?.role;
    return typeof role === "string" ? role : null;
  } catch {
    return null;
  }
}
