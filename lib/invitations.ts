import { db } from "@/lib/db/client";
import type { InvitationRow, ShopRow } from "@/lib/db/types";
import { newInviteCode } from "@/lib/crypto";
import type { Locale } from "@/lib/i18n";

/** Estados de una invitación todavía sin usar -creada, enviada o abierta-, para listarlas en la app del cliente. */
export const ACTIVE_STATES = ["created", "sent", "opened"] as const;

/**
 * Crea una invitación.
 *
 * Sin tope de cupo activo: cada tarjeta completada dispara la suya, sin
 * límite de por vida ni de cuántas tiene abiertas a la vez — más
 * invitaciones en vuelo es más oportunidad de negocio, no un riesgo a
 * frenar.
 */
export async function createInvitation(opts: {
  shop: ShopRow;
  padrinoId: string;
  locale: Locale;
}): Promise<InvitationRow | null> {
  const { shop, padrinoId, locale } = opts;

  const expiresAt = new Date(
    Date.now() + shop.invite_ttl_days * 24 * 3_600_000,
  ).toISOString();

  // El código es corto para poder dictarlo, así que hay colisiones posibles.
  // Tres intentos bastan: el espacio es de 32^6 ≈ mil millones.
  for (let attempt = 0; attempt < 3; attempt++) {
    const { data, error } = await db()
      .from("invitations")
      .insert({
        shop_id: shop.id,
        padrino_id: padrinoId,
        code: newInviteCode(),
        state: "created",
        locale,
        expires_at: expiresAt,
      })
      .select("*")
      .single();

    if (!error && data) return data;
    // 23505 = unique_violation. Cualquier otro error no se reintenta.
    if (error && error.code !== "23505") return null;
  }

  return null;
}

/** Invitación reclamada y pendiente de canjear por este cliente. */
export async function claimedInvitationFor(
  customerId: string,
): Promise<InvitationRow | null> {
  const { data } = await db()
    .from("invitations")
    .select("*")
    .eq("claimed_by", customerId)
    .eq("state", "claimed")
    .maybeSingle();

  return data ?? null;
}

/**
 * Cuántas invitaciones ha creado este cliente en total, sea cual sea su
 * estado -caducada, canjeada, todavía en vuelo-. Es "a cuánta gente ha
 * invitado", no "cuántas tiene activas ahora mismo" -eso ya lo calcula
 * `loadCard` con `activeInvites`-, así que cuenta filas, no las carga.
 */
export async function countInvitationsSent(customerId: string): Promise<number> {
  const { count } = await db()
    .from("invitations")
    .select("id", { count: "exact", head: true })
    .eq("padrino_id", customerId);

  return count ?? 0;
}

/**
 * Clientes nuevos que llegaron por una invitación suya -se dieron de alta
 * con el código, sea cual sea el estado de la invitación después-.
 * `claimed_by` se fija una sola vez, al aceptar el café, y ya no se borra
 * aunque la invitación siga avanzando (a 'redeemed') o caduque de adorno,
 * así que contar filas con ese campo relleno basta.
 */
export async function countClaimedFromInvites(customerId: string): Promise<number> {
  const { count } = await db()
    .from("invitations")
    .select("id", { count: "exact", head: true })
    .eq("padrino_id", customerId)
    .not("claimed_by", "is", null);

  return count ?? 0;
}
