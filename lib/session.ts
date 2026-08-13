import { cookies } from "next/headers";
import { env } from "./env";

/**
 * Cookies de OnMe. Ninguna es una sesión de usuario en el sentido clásico:
 *
 *   onme_c  identidad del cliente. Al portador, igual que una tarjeta de
 *           cartón. Su valor es el token del cliente, que llega una sola vez
 *           por la URL y a partir de ahí desaparece de la barra de direcciones.
 *
 *   onme_d  sesión del dispositivo de barra. NO es el device token: es un
 *           token de sesión distinto, revocable desde el panel y guardado
 *           hasheado en la base de datos. El device token original solo se
 *           usa una vez, para dar de alta el dispositivo.
 */
export const CUSTOMER_COOKIE = "onme_c";
export const DEVICE_COOKIE = "onme_d";

const YEAR_SECONDS = 60 * 60 * 24 * 365;
const NINETY_DAYS_SECONDS = 60 * 60 * 24 * 90;

function baseOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: env.isProduction,
    path: "/",
  };
}

export async function readCustomerToken(): Promise<string | null> {
  const jar = await cookies();
  return jar.get(CUSTOMER_COOKIE)?.value ?? null;
}

export async function readDeviceSessionToken(): Promise<string | null> {
  const jar = await cookies();
  return jar.get(DEVICE_COOKIE)?.value ?? null;
}

/**
 * Estas dos escriben en el `cookies()` de la petición actual, así que solo
 * pueden llamarse desde un Route Handler o una Server Action — nunca desde
 * un Server Component, que en Next es de solo lectura.
 */
export async function writeCustomerCookie(token: string): Promise<void> {
  const jar = await cookies();
  jar.set(CUSTOMER_COOKIE, token, { ...baseOptions(), maxAge: YEAR_SECONDS });
}

export async function writeDeviceCookie(sessionToken: string): Promise<void> {
  const jar = await cookies();
  jar.set(DEVICE_COOKIE, sessionToken, {
    ...baseOptions(),
    maxAge: NINETY_DAYS_SECONDS,
  });
}

export async function clearDeviceCookie(): Promise<void> {
  const jar = await cookies();
  jar.delete(DEVICE_COOKIE);
}
