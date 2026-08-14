import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";
import type { Database } from "./types";

export type Db = SupabaseClient<Database>;

/** Forma mínima de un error de PostgREST: lo que hace falta para diagnosticar. */
type QueryError = { message: string; code?: string | null };

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

/**
 * Separa "no hay filas" (un resultado legítimo: `maybeSingle()` sin match
 * devuelve `data: null, error: null`) de "Supabase devolvió un error" (clave
 * revocada, proyecto equivocado, límite de conexiones, timeout…).
 *
 * Nace del mismo fallo que `assertServiceRole`, un nivel más abajo: en cada
 * `const { data } = await db()...; if (!data) notFound()` de la aplicación,
 * un error real de la API se leía exactamente igual que "esto no existe".
 * El local desaparecía, las tarjetas dejaban de existir, y en los registros
 * no había ni una línea que lo explicara — porque nadie miraba `error`.
 *
 * Recibe `error` suelto y no el resultado completo a propósito: el tipo que
 * devuelve supabase-js es una unión discriminada entre la rama de éxito y la
 * de error, y pedirle a TypeScript que infiera `T` desde esa unión dentro de
 * un solo parámetro degenera en `never`. Separado, no hay nada que inferir.
 *
 * Se usa en los puntos de entrada de cada superficie (alta, tarjeta,
 * invitación, dispositivo, admin): donde un 404 silencioso cuesta más caro,
 * porque es lo primero que ve un cliente real escaneando un QR en la barra.
 *
 *   const { data: shop, error } = await db().from("shops")...maybeSingle();
 *   assertNoQueryError(error, `shops.slug=${slug}`);
 *   if (!shop) notFound();   // ahora sí es "no existe" de verdad
 */
export function assertNoQueryError(error: QueryError | null, context: string): void {
  if (!error) return;

  throw new Error(
    `Supabase devolvió un error en "${context}": ${error.message} ` +
      `(código ${error.code ?? "desconocido"}). No es "no existe": es un ` +
      "fallo real — revisa NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY.",
  );
}
