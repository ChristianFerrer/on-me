import { evaluateAttribution } from "@/lib/attribution";
import { db } from "@/lib/db/client";
import type { ShopRow } from "@/lib/db/types";
import { applyBonus } from "@/lib/scan";

export type SweepReport = {
  expiredInvitations: number;
  evaluated: number;
  billable: number;
  discarded: number;
  bonusesPaid: number;
};

/**
 * Barrido diario de atribuciones.
 *
 * Dos trabajos: caducar invitaciones que nadie usó y resolver las
 * atribuciones que siguen en ventana. Es idempotente — puede correr dos
 * veces el mismo día sin pagar dos bonus — porque solo toca filas en estado
 * `window` y el paso a `billable` va en la misma escritura condicionada.
 */
export async function runAttributionSweep(now = new Date()): Promise<SweepReport> {
  const report: SweepReport = {
    expiredInvitations: 0,
    evaluated: 0,
    billable: 0,
    discarded: 0,
    bonusesPaid: 0,
  };

  // ------------------------------------------- invitaciones sin reclamar
  const { data: expired } = await db()
    .from("invitations")
    .update({ state: "expired" })
    .in("state", ["created", "sent", "opened"])
    .lt("expires_at", now.toISOString())
    .select("id");

  report.expiredInvitations = expired?.length ?? 0;

  // ------------------------------------------------ atribuciones abiertas
  const { data: open } = await db()
    .from("attributions")
    .select("id, shop_id, padrino_id, ahijado_id, redeemed_at, bonus_paid")
    .eq("state", "window");

  if (!open?.length) return report;

  const shops = await loadShops([...new Set(open.map((row) => row.shop_id))]);

  for (const attribution of open) {
    const shop = shops.get(attribution.shop_id);
    if (!shop) continue;

    report.evaluated += 1;

    const { data: scans } = await db()
      .from("scans")
      .select("id, kind, created_at")
      .eq("customer_id", attribution.ahijado_id)
      .gt("created_at", attribution.redeemed_at)
      .order("created_at", { ascending: true });

    const outcome = evaluateAttribution({
      now,
      redeemedAt: new Date(attribution.redeemed_at),
      returnWindowDays: shop.return_window_days,
      scans: (scans ?? []).map((scan) => ({
        id: scan.id,
        kind: scan.kind,
        createdAt: new Date(scan.created_at),
      })),
    });

    if (outcome.state === "window") continue;

    if (outcome.state === "discarded") {
      await db()
        .from("attributions")
        .update({ state: "discarded" })
        .eq("id", attribution.id)
        .eq("state", "window");
      report.discarded += 1;
      continue;
    }

    // La condición sobre `state` es la que garantiza el "exactamente una vez":
    // si otro barrido se adelantó, esta escritura no afecta a ninguna fila.
    const { data: claimed } = await db()
      .from("attributions")
      .update({
        state: "billable",
        billable: true,
        returned_at: outcome.returnedAt.toISOString(),
        return_scan_id: outcome.returnScanId,
        bonus_paid: true,
      })
      .eq("id", attribution.id)
      .eq("state", "window")
      .select("id");

    if (!claimed?.length) continue;

    report.billable += 1;

    if (!attribution.bonus_paid && (await payBonus(attribution.padrino_id, shop))) {
      report.bonusesPaid += 1;
    }
  }

  return report;
}

async function loadShops(ids: string[]): Promise<Map<string, ShopRow>> {
  const { data } = await db().from("shops").select("*").in("id", ids);
  return new Map((data ?? []).map((shop) => [shop.id, shop]));
}

/** Los sellos de bonus al padrino, con las mismas reglas que un sello normal. */
async function payBonus(padrinoId: string, shop: ShopRow): Promise<boolean> {
  const { data: pass } = await db()
    .from("passes")
    .select("id, stamps, cards_completed, reward_pending")
    .eq("customer_id", padrinoId)
    .maybeSingle();

  if (!pass) return false;

  const next = applyBonus(
    {
      stamps: pass.stamps,
      cardsCompleted: pass.cards_completed,
      rewardPending: pass.reward_pending,
    },
    shop.bonus_stamps,
    shop.stamps_goal,
  );

  await db()
    .from("passes")
    .update({
      stamps: next.stamps,
      cards_completed: next.cardsCompleted,
      reward_pending: next.rewardPending,
    })
    .eq("id", pass.id);

  return true;
}
