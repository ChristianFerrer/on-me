import { assertNoQueryError, db } from "@/lib/db/client";

export type DeviceListItem = {
  id: string;
  name: string;
  /** Plano a propósito: es la llave de alta y solo la ve el panel autenticado. */
  token: string;
  hasPin: boolean;
  createdAt: string;
  lastSeenAt: string | null;
  /** Hay una fila en `device_sessions` sin revocar: alguien puede escanear ahora mismo. */
  hasActiveSession: boolean;
};

export async function loadDevices(shopId: string): Promise<DeviceListItem[]> {
  const { data: devices, error } = await db()
    .from("devices")
    .select("id, name, token, pin_hash, created_at")
    .eq("shop_id", shopId)
    .order("created_at", { ascending: true });

  assertNoQueryError(error, `devices.shop_id=${shopId}`);
  const rows = devices ?? [];
  if (rows.length === 0) return [];

  const { data: sessions, error: sessionsError } = await db()
    .from("device_sessions")
    .select("device_id, last_seen_at")
    .in(
      "device_id",
      rows.map((row) => row.id),
    )
    .is("revoked_at", null);

  assertNoQueryError(sessionsError, "device_sessions.active");

  // Varias sesiones sin revocar por dispositivo son legítimas —el mismo iPad
  // reabierto tras borrar caché—, así que solo interesa la más reciente.
  const latestByDevice = new Map<string, string>();
  for (const session of sessions ?? []) {
    const current = latestByDevice.get(session.device_id);
    if (!current || session.last_seen_at > current) {
      latestByDevice.set(session.device_id, session.last_seen_at);
    }
  }

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    token: row.token,
    hasPin: row.pin_hash !== null,
    createdAt: row.created_at,
    lastSeenAt: latestByDevice.get(row.id) ?? null,
    hasActiveSession: latestByDevice.has(row.id),
  }));
}
