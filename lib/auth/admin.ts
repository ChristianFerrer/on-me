import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";
import { assertNoQueryError, db } from "@/lib/db/client";
import type { ShopRow } from "@/lib/db/types";
import { env } from "@/lib/env";

export const ADMIN_COOKIE = "onme_a";
const SESSION_DAYS = 7;

/**
 * Sesión de administración.
 *
 * Supabase Auth se usa **solo** para comprobar la contraseña, y se usa desde
 * el servidor: la clave anon nunca llega al navegador, que sigue sin hablar
 * con Supabase en ningún momento. Verificada la identidad, emitimos nuestra
 * propia cookie firmada con HMAC, así no hay que gestionar refresco de tokens
 * para un panel que abren una o dos personas.
 *
 * Revocar es inmediato: quitar la fila de `shop_members` corta el acceso en
 * la siguiente petición, porque la pertenencia se comprueba siempre contra
 * la base de datos y no se confía en el contenido de la cookie.
 */

function sign(payload: string): string {
  return createHmac("sha256", env.appSalt).update(payload).digest("hex");
}

export function issueAdminSession(userId: string): string {
  const expiresAt = Date.now() + SESSION_DAYS * 24 * 3_600_000;
  const payload = `${userId}.${expiresAt}`;
  return `${payload}.${sign(payload)}`;
}

function verifyAdminSession(value: string): string | null {
  const parts = value.split(".");
  if (parts.length !== 3) return null;

  const [userId, expiresAt, signature] = parts;
  const expected = sign(`${userId}.${expiresAt}`);

  const a = Buffer.from(signature, "utf8");
  const b = Buffer.from(expected, "utf8");
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  if (Number(expiresAt) < Date.now()) return null;

  return userId;
}

export type AdminContext = { userId: string; shop: ShopRow; role: string };

export async function getAdminContext(): Promise<AdminContext | null> {
  const jar = await cookies();
  const raw = jar.get(ADMIN_COOKIE)?.value;
  if (!raw) return null;

  const userId = verifyAdminSession(raw);
  if (!userId) return null;

  // La pertenencia se comprueba en cada petición, no se confía en la cookie.
  // Un error real aquí no es "no eres miembro": es "no puedo comprobarlo".
  const { data, error } = await db()
    .from("shop_members")
    .select("role, shops(*)")
    .eq("user_id", userId)
    .maybeSingle()
    .returns<{ role: string; shops: ShopRow | null }>();

  assertNoQueryError(error, "shop_members.user_id");
  if (!data?.shops) return null;

  return { userId, shop: data.shops, role: data.role };
}

/**
 * Comprueba email y contraseña contra Supabase Auth desde el servidor.
 * Devuelve el id de usuario, o null si las credenciales no valen.
 */
export async function verifyCredentials(
  email: string,
  password: string,
): Promise<string | null> {
  const anonKey = process.env.SUPABASE_ANON_KEY;
  if (!anonKey) {
    throw new Error(
      "Falta SUPABASE_ANON_KEY. Solo se usa en servidor, para comprobar la contraseña del panel.",
    );
  }

  const auth = createClient(env.supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await auth.auth.signInWithPassword({ email, password });
  if (error || !data.user) return null;

  // La sesión de Supabase no se conserva: solo nos interesaba la verificación.
  await auth.auth.signOut();

  return data.user.id;
}
