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
 * navegador con la anon key, no podría leer ni una fila.
 *
 * El navegador nunca importa este módulo. Habla con `/api/*` y nada más.
 */
export function db(): Db {
  if (client) return client;

  client = createClient<Database>(env.supabaseUrl, env.serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { "x-application-name": "onme" } },
  });

  return client;
}
