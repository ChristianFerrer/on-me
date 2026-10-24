import { assertNoQueryError, db } from "@/lib/db/client";
import type { ArrivalRow } from "@/lib/db/types";
import { firstName } from "@/lib/scan-service";

/**
 * Llegadas: el cliente escanea el QR fijo de barra con su propio móvil y la
 * barra lo ve en su lista, sin que nadie coja un móvil -ver migración 0008-.
 *
 * Una llegada es un aviso, no un sello. El QR es estático y se puede
 * fotografiar, así que no prueba que el cliente esté delante: eso lo prueba
 * el barista, que solo atiende a quien ve. Por eso el aviso caduca rápido y
 * por eso lo único que hace es poner un nombre en la lista.
 */

/** Lo que dura un aviso en la lista de barra. Lo justo para una cola normal. */
export const ARRIVAL_TTL_MS = 2 * 60_000;

export type ArrivalStatus = "pending" | "handled" | "expired";

/** Lógica pura: estado de un aviso en un instante dado. */
export function arrivalStatus(
  row: Pick<ArrivalRow, "expires_at" | "handled_at">,
  now: number = Date.now(),
): ArrivalStatus {
  if (row.handled_at) return "handled";
  return Date.parse(row.expires_at) > now ? "pending" : "expired";
}

/** Lo que pinta la lista de barra por cada aviso vivo. */
export type ArrivalItem = {
  id: string;
  customerId: string;
  name: string;
  phoneLast4: string;
  stamps: number;
  goal: number;
  rewardsPending: number;
  /** Tiene una invitación reclamada sin canjear: se atiende por el flujo clásico, que es el que la canjea. */
  invited: boolean;
  /** Nunca ha tenido un sello: acaba de darse de alta. */
  isNew: boolean;
  createdAt: string;
};

/**
 * Registra que el cliente está en barra. Si ya tenía un aviso vivo, lo
 * alarga en vez de crear otro: reescanear porque no le atienden no debe
 * llenar la lista de duplicados.
 */
export async function registerArrival(shopId: string, customerId: string): Promise<ArrivalRow> {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + ARRIVAL_TTL_MS).toISOString();

  const { data: live, error: liveError } = await db()
    .from("arrivals")
    .select("*")
    .eq("customer_id", customerId)
    .is("handled_at", null)
    .gt("expires_at", now.toISOString())
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  assertNoQueryError(liveError, "arrivals.live");

  if (live) {
    const { data: refreshed, error } = await db()
      .from("arrivals")
      .update({ expires_at: expiresAt })
      .eq("id", live.id)
      .select("*")
      .single();

    assertNoQueryError(error, "arrivals.refresh");
    return refreshed ?? { ...live, expires_at: expiresAt };
  }

  const { data: created, error } = await db()
    .from("arrivals")
    .insert({ shop_id: shopId, customer_id: customerId, expires_at: expiresAt })
    .select("*")
    .single();

  assertNoQueryError(error, "arrivals.insert");
  if (!created) throw new Error("No se ha podido registrar la llegada");
  return created;
}

/**
 * Marca como atendidos los avisos vivos de un cliente. Se llama tras
 * cualquier sello o canje real -por la lista, por cámara o por búsqueda-:
 * si el barista acabó escaneando el móvil igualmente, el aviso también
 * desaparece de la lista.
 */
export async function resolveArrivals(shopId: string, customerId: string): Promise<void> {
  const now = new Date().toISOString();
  const { error } = await db()
    .from("arrivals")
    .update({ handled_at: now })
    .eq("shop_id", shopId)
    .eq("customer_id", customerId)
    .is("handled_at", null)
    .gt("expires_at", now);

  assertNoQueryError(error, "arrivals.resolve");
}

/** Estado de un aviso del propio cliente -la pantalla de espera lo sondea-. */
export async function getArrivalStatus(
  arrivalId: string,
  customerId: string,
): Promise<ArrivalStatus | null> {
  const { data, error } = await db()
    .from("arrivals")
    .select("expires_at, handled_at")
    .eq("id", arrivalId)
    .eq("customer_id", customerId)
    .maybeSingle();

  assertNoQueryError(error, "arrivals.status");
  return data ? arrivalStatus(data) : null;
}

type PendingRow = Pick<ArrivalRow, "id" | "customer_id" | "created_at"> & {
  customers: { name: string; phone_last4: string } | null;
};

/** Avisos vivos de un local, el más antiguo primero: es el orden de la cola. */
export async function listPendingArrivals(shop: {
  id: string;
  stamps_goal: number;
}): Promise<ArrivalItem[]> {
  // Embebido con `.returns<T>()` por lo mismo que lib/auth/device.ts:
  // nuestro `Database` no describe relaciones.
  const { data, error } = await db()
    .from("arrivals")
    .select("id, customer_id, created_at, customers(name, phone_last4)")
    .eq("shop_id", shop.id)
    .is("handled_at", null)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: true })
    .limit(20)
    .returns<PendingRow[]>();

  assertNoQueryError(error, "arrivals.pending");
  const rows = data ?? [];
  if (rows.length === 0) return [];

  const ids = rows.map((row) => row.customer_id);

  const [passes, invitations] = await Promise.all([
    db()
      .from("passes")
      .select("customer_id, stamps, cards_completed, reward_pending_count")
      .in("customer_id", ids),
    db().from("invitations").select("claimed_by").eq("state", "claimed").in("claimed_by", ids),
  ]);

  assertNoQueryError(passes.error, "arrivals.passes");
  assertNoQueryError(invitations.error, "arrivals.invitations");

  const passBy = new Map((passes.data ?? []).map((pass) => [pass.customer_id, pass]));
  const invited = new Set((invitations.data ?? []).map((invite) => invite.claimed_by));

  return rows.map((row) => {
    const pass = passBy.get(row.customer_id);
    return {
      id: row.id,
      customerId: row.customer_id,
      name: firstName(row.customers?.name ?? "—"),
      phoneLast4: row.customers?.phone_last4 ?? "",
      stamps: pass?.stamps ?? 0,
      goal: shop.stamps_goal,
      rewardsPending: pass?.reward_pending_count ?? 0,
      invited: invited.has(row.customer_id),
      isNew: (pass?.stamps ?? 0) === 0 && (pass?.cards_completed ?? 0) === 0,
      createdAt: row.created_at,
    };
  });
}
