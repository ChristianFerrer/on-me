/**
 * Variables de entorno, leídas de forma perezosa.
 *
 * Perezosa a propósito: `next build` no debe fallar por no tener las claves
 * de producción a mano, pero cualquier ruta que las necesite tiene que
 * reventar con un mensaje claro en vez de mandar `undefined` a Supabase.
 *
 * La `anon key` de servidor (`SUPABASE_ANON_KEY`, usada en verifyCredentials)
 * no aparece aquí a propósito: el navegador no habla con Supabase para el
 * login normal. La única excepción es ResetPasswordForm.tsx, que lee
 * `NEXT_PUBLIC_SUPABASE_URL`/`NEXT_PUBLIC_SUPABASE_ANON_KEY` directamente
 * -no desde aquí-: el propio flujo de recuperación de contraseña de
 * Supabase Auth exige que sea el navegador quien complete la sesión de
 * recuperación, no hay forma de hacerlo entero en servidor sin conocer de
 * antemano el tipo de flujo (implícito vs PKCE) configurado en el proyecto.
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
  /**
   * Se acepta con y sin prefijo público. No necesita ser pública —el
   * navegador nunca habla con Supabase— pero `NEXT_PUBLIC_SUPABASE_URL` es
   * lo que pone por defecto el panel de Supabase y no merece la pena pelearse.
   */
  get supabaseUrl(): string {
    return (
      process.env.SUPABASE_URL ?? required("NEXT_PUBLIC_SUPABASE_URL")
    );
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
