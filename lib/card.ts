import { assertNoQueryError, db } from "@/lib/db/client";
import type { CustomerRow, InvitationRow, ShopRow } from "@/lib/db/types";
import { ACTIVE_STATES } from "@/lib/invitations";

export type CardData = {
  customer: CustomerRow;
  shop: ShopRow;
  stamps: number;
  cardsCompleted: number;
  /**
   * Cafés gratis de verdad disponibles para canjear ahora -`passes.reward_pending_count`-.
   * No es lo mismo que `cardsCompleted`: ese es el total de tarjetas completadas
   * en toda la vida del cliente, sube y no baja ni cuando canjea. Esto es lo
   * único que debe enseñarle la tarjeta como "cafés gratis esperándote".
   */
  rewardsPendingCount: number;
  /** Invitaciones creadas y todavía sin usar. */
  activeInvites: InvitationRow[];
  /**
   * Invitaciones a las que tiene derecho y aún no ha sacado. Se calcula como
   * tarjetas completadas menos invitaciones creadas en total: si al completar
   * la tarjeta tenía el cupo lleno, no se pierde el derecho, se aparca.
   */
  pendingGrants: number;
  canCreateInvite: boolean;
  /** Invitados suyos que volvieron y pagaron. */
  returnedGuests: number;
};

export async function loadCard(token: string): Promise<CardData | null> {
  // `data: null, error: null` es legítimo aquí: alguien sin cookie o con un
  // token viejo. Solo revienta si Supabase devolvió un error real.
  const { data: customer, error: customerError } = await db()
    .from("customers")
    .select("*")
    .eq("token", token)
    .maybeSingle();

  assertNoQueryError(customerError, "customers.token");
  if (!customer) return null;

  const [shopResult, passResult, invitesResult, attributionsResult] =
    await Promise.all([
      db().from("shops").select("*").eq("id", customer.shop_id).maybeSingle(),
      db()
        .from("passes")
        .select("stamps, cards_completed, reward_pending_count")
        .eq("customer_id", customer.id)
        .maybeSingle(),
      db()
        .from("invitations")
        .select("*")
        .eq("padrino_id", customer.id)
        .order("created_at", { ascending: false }),
      db()
        .from("attributions")
        .select("id")
        .eq("padrino_id", customer.id)
        .eq("state", "billable"),
    ]);

  assertNoQueryError(shopResult.error, `shops.id=${customer.shop_id}`);
  const shop = shopResult.data;
  if (!shop) return null;

  const invites = invitesResult.data ?? [];
  const activeInvites = invites.filter((invite) =>
    (ACTIVE_STATES as readonly string[]).includes(invite.state),
  );

  const cardsCompleted = passResult.data?.cards_completed ?? 0;
  const pendingGrants = Math.max(cardsCompleted - invites.length, 0);

  return {
    customer,
    shop,
    stamps: passResult.data?.stamps ?? 0,
    cardsCompleted,
    rewardsPendingCount: passResult.data?.reward_pending_count ?? 0,
    activeInvites,
    pendingGrants,
    canCreateInvite: pendingGrants > 0,
    returnedGuests: attributionsResult.data?.length ?? 0,
  };
}
