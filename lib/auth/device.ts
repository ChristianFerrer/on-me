import { db } from "@/lib/db/client";
import type { DeviceRow, ShopRow } from "@/lib/db/types";
import { hashWithSalt } from "@/lib/crypto";
import { readDeviceSessionToken } from "@/lib/session";

export type DeviceContext = {
  sessionId: string;
  device: DeviceRow;
  shop: ShopRow;
};

type SessionWithDevice = {
  id: string;
  revoked_at: string | null;
  devices: (DeviceRow & { shops: ShopRow | null }) | null;
};

/**
 * Resuelve la sesión de barra a partir de la cookie.
 *
 * Lo que NO viaja aquí es el device token original. Ese solo se usa una vez,
 * al abrir `/s/<token>`, y desde entonces la URL está limpia: en un iPad
 * compartido cualquier cliente puede fotografiar la barra de direcciones
 * mientras le sellan, y ese enlace acuña sellos.
 *
 * La sesión se guarda hasheada y se puede revocar desde el panel.
 */
export async function getDeviceContext(): Promise<DeviceContext | null> {
  const sessionToken = await readDeviceSessionToken();
  if (!sessionToken) return null;

  // Una sola consulta anidada en vez de tres: esto está en el camino crítico
  // de cada escaneo. El tipo se declara a mano con `.returns<T>()` porque
  // nuestro `Database` no describe las relaciones y supabase-js no puede
  // inferir la forma del `select` embebido.
  const { data, error } = await db()
    .from("device_sessions")
    .select("id, revoked_at, devices(*, shops(*))")
    .eq("token_hash", hashWithSalt(sessionToken))
    .maybeSingle()
    .returns<SessionWithDevice>();

  if (error || !data || data.revoked_at) return null;

  const device = data.devices;
  if (!device || !device.active || !device.shops) return null;

  const { shops, ...deviceRow } = device;

  return { sessionId: data.id, device: deviceRow, shop: shops };
}

/** Marca actividad del dispositivo. Sin await en la ruta: no bloquea el escaneo. */
export async function touchDeviceSession(sessionId: string): Promise<void> {
  await db()
    .from("device_sessions")
    .update({ last_seen_at: new Date().toISOString() })
    .eq("id", sessionId);
}

/**
 * Comprueba el PIN de las acciones que regalan producto.
 *
 * Si el local todavía no ha fijado PIN, no se bloquea la barra: el piloto
 * tiene que poder empezar el primer día. El panel avisa de que falta.
 */
export function checkPin(device: DeviceRow, pin: string | undefined): boolean {
  if (!device.pin_hash) return true;
  if (!pin) return false;
  return device.pin_hash === hashWithSalt(pin);
}

export function pinRequired(device: DeviceRow): boolean {
  return device.pin_hash !== null;
}
