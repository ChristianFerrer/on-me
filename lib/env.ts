/**
 * Variables de entorno, leídas de forma perezosa.
 *
 * Perezosa a propósito: `next build` no debe fallar por no tener las claves
 * de producción a mano, pero cualquier ruta que las necesite tiene que
 * reventar con un mensaje claro en vez de mandar `undefined` a Supabase.
 *
 * La `anon key` no aparece aquí. Si algún día hace falta, es que hay un
 * error de arquitectura: el navegador nunca habla con Supabase.
 */

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Falta la variable de entorno ${name}. Revisa .env.local o la configuración de Vercel.`,
    );
  }
  return value;
}

export const env = {
  get supabaseUrl(): string {
    return required("NEXT_PUBLIC_SUPABASE_URL");
  },
  get serviceRoleKey(): string {
    return required("SUPABASE_SERVICE_ROLE_KEY");
  },
  /** Sal del hash de teléfono. Rotarla invalida todos los phone_hash. */
  get appSalt(): string {
    return required("APP_SALT");
  },
  get cronSecret(): string {
    return required("CRON_SECRET");
  },
  get baseUrl(): string {
    return (
      process.env.NEXT_PUBLIC_BASE_URL?.replace(/\/$/, "") ??
      "http://localhost:3000"
    );
  },
  get isProduction(): boolean {
    return process.env.NODE_ENV === "production";
  },
};
