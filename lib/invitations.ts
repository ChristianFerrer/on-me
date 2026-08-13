import { db } from "@/lib/db/client";
import type { InvitationRow, ShopRow } from "@/lib/db/types";
import { newInviteCode } from "@/lib/crypto";
import type { Locale } from "@/lib/i18n";

/** Estados que ocupan cupo: creada, enviada o abierta pero sin usar. */
export const ACTIVE_STATES = ["created", "sent", "opened"] as const;

export async function activeInvitations(
  padrinoId: string,
): Promise<InvitationRow[]> {
  const { data } = await db()
    .from("invitations")
    .select("*")
    .eq("padrino_id", padrinoId)
    .in("state", [...ACTIVE_STATES])
    .order("created_at", { ascending: false });

  return data ?? [];
}

/**
 * Crea una invitación si el padrino tiene cupo.
 *
 * El cupo existe por el cliente de diez cafés al día que el dueño describió:
 * llenaría una tarjeta diaria y generaría treinta invitaciones al mes él
 * solo, saturando el barrio en dos semanas.
 *
 * Devuelve null si no hay cupo — no es un error, es el caso esperado.
 */
export async function createInvitation(opts: {
  shop: ShopRow;
  padrinoId: string;
  locale: Locale;
}): Promise<InvitationRow | null> {
  const { shop, padrinoId, locale } = opts;

  const active = await activeInvitations(padrinoId);
  if (active.length >= shop.max_active_invites) return null;

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
