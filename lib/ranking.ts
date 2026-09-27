import { db } from "@/lib/db/client";

export type CustomerTier = "bronze" | "silver" | "gold";

export type CustomerRanking = {
  position: number;
  totalCustomers: number;
  tier: CustomerTier;
};

/**
 * Pesos del score de ranking: cuánto pesa un consumo -un sello real, ver
 * getVisitStats en scan-service.ts- frente a un cliente nuevo que llegó por
 * su invitación. Un referido vale más que una simple visita porque trae
 * negocio nuevo al local, no solo repite el suyo; 5 es un punto de partida
 * razonable, no una ciencia exacta -ajustar aquí si el dueño del local lo
 * pide, no hay más sitios donde tocar-.
 */
const CONSUMPTION_WEIGHT = 1;
const REFERRAL_WEIGHT = 5;

/** Percentiles de corte: el 20% de arriba es oro, el siguiente 30% plata, el resto bronce. */
const GOLD_PERCENTILE = 0.2;
const SILVER_PERCENTILE = 0.5;

function tierForPercentile(percentile: number): CustomerTier {
  if (percentile <= GOLD_PERCENTILE) return "gold";
  if (percentile <= SILVER_PERCENTILE) return "silver";
  return "bronze";
}

/**
 * Ranking de todos los clientes de un local, por consumo y por cuánta gente
 * nueva han traído. Se recalcula entero en cada llamada -nada se guarda-:
 * para el tamaño de un local piloto (cientos de clientes, no decenas de
 * miles de escaneos) tres consultas y un `sort` en memoria es más barato
 * que mantener una tabla derivada al día. Si el local crece mucho, esto es
 * lo primero que habría que mover a una vista materializada.
 */
export async function computeShopRanking(shopId: string): Promise<Map<string, CustomerRanking>> {
  const [{ data: customers }, { data: stamps }, { data: referrals }] = await Promise.all([
    db().from("customers").select("id").eq("shop_id", shopId),
    db().from("scans").select("customer_id").eq("shop_id", shopId).eq("kind", "stamp"),
    db()
      .from("invitations")
      .select("padrino_id")
      .eq("shop_id", shopId)
      .not("claimed_by", "is", null),
  ]);

  const consumptionByCustomer = new Map<string, number>();
  for (const row of stamps ?? []) {
    if (!row.customer_id) continue;
    consumptionByCustomer.set(row.customer_id, (consumptionByCustomer.get(row.customer_id) ?? 0) + 1);
  }

  const referralsByCustomer = new Map<string, number>();
  for (const row of referrals ?? []) {
    referralsByCustomer.set(row.padrino_id, (referralsByCustomer.get(row.padrino_id) ?? 0) + 1);
  }

  const scored = (customers ?? []).map((customer) => ({
    id: customer.id,
    score:
      (consumptionByCustomer.get(customer.id) ?? 0) * CONSUMPTION_WEIGHT +
      (referralsByCustomer.get(customer.id) ?? 0) * REFERRAL_WEIGHT,
  }));

  scored.sort((a, b) => b.score - a.score);

  const total = scored.length;
  const ranking = new Map<string, CustomerRanking>();
  scored.forEach((entry, index) => {
    const position = index + 1;
    ranking.set(entry.id, {
      position,
      totalCustomers: total,
      tier: tierForPercentile(total > 0 ? position / total : 1),
    });
  });

  return ranking;
}

/** Atajo para un único cliente -calcula el ranking del local entero igual, no hay forma más barata de saber su puesto-. */
export async function getCustomerRanking(
  shopId: string,
  customerId: string,
): Promise<CustomerRanking | null> {
  const ranking = await computeShopRanking(shopId);
  return ranking.get(customerId) ?? null;
}
