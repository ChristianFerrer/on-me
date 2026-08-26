import type { Gate } from "@/lib/attribution";
import { evaluateGate, GATE_CONFIG } from "@/lib/attribution";
import { assertNoQueryError, db } from "@/lib/db/client";
import type { CustomerRow, InvitationRow, PassRow, ScanRow } from "@/lib/db/types";
import { computeReferralDepth, findChainRoots } from "@/lib/giftGraph/referralDepth";
import { median } from "@/lib/median";
import { firstName } from "@/lib/scan-service";

/**
 * Capa de datos de /admin/metricas, según la especificación acordada.
 *
 * Vocabulario canónico -mapeado 1:1 a lo que ya existe, sin inventar un
 * estado paralelo-:
 *   alta_directa       = customers.source === "qr" sin invitación (NodeState "direct")
 *   alta_invitada      = customers.source === "invitation"        (NodeState "claimed" hasta que canjea)
 *   recurrente_ganado  = attributions.state === "billable"         (NodeState "billable")
 *   en_ventana         = attributions.state === "window"           (NodeState "window")
 *   sin_retorno        = attributions.state === "discarded"        (NodeState "discarded")
 *
 * Ventana de recurrencia: `shop.return_window_days` -la misma que ya usa el
 * motor de atribuciones real (lib/attribution.ts)-, no un 30 fijo aparte:
 * si un local cambia su ventana, esta página y la constelación tienen que
 * seguir dando el mismo número para lo mismo (Regla 0.1).
 *
 * Umbral de muestra: ninguna razón con denominador < MIN_SAMPLE emite valor.
 */
export const MIN_SAMPLE = 8;

export type MetricsRange = "7d" | "30d" | "all";

/** null = muestra insuficiente. */
export type Ratio = { value: number | null; numerator: number; denominator: number };

function ratio(numerator: number, denominator: number): Ratio {
  return {
    value: denominator < MIN_SAMPLE ? null : numerator / denominator,
    numerator,
    denominator,
  };
}

function rangeSince(range: MetricsRange, now: number): string | null {
  if (range === "all") return null;
  const days = range === "7d" ? 7 : 30;
  return new Date(now - days * 24 * 3_600_000).toISOString();
}

export type WaffleGroupKey =
  | "unopened_alive"
  | "expired_unopened"
  | "opened_unredeemed"
  | "expired_after_open"
  | "redeemed_window"
  | "redeemed_no_return"
  | "stayed";

const WAFFLE_GROUP_ORDER: WaffleGroupKey[] = [
  "unopened_alive",
  "expired_unopened",
  "opened_unredeemed",
  "expired_after_open",
  "redeemed_window",
  "redeemed_no_return",
  "stayed",
];

export type CascadeStep = {
  key: string;
  value: number;
  drop: number | null;
  reasonKey: string;
};

export type VelocityStep = { key: string; days: number | null };

export type ComparisonRow = {
  key: string;
  invited: number | null;
  direct: number | null;
  /** > 1 favorece al invitado, < 1 favorece al directo. null si falta cualquiera de los dos lados. */
  multiplier: number | null;
};

export type CohortRow = {
  cohortStart: string;
  kind: "direct" | "invited";
  cohortSize: number;
  /** Un valor por cada semana transcurrida desde el alta de la cohorte. null = todavía no ha llegado esa semana (futuro), no 0%. */
  cellsPct: (number | null)[];
};

export type PadrinoRow = {
  id: string;
  name: string;
  invited: number;
  opened: number;
  redeemed: number;
  stayed: number;
  status: "active" | "dormant" | "off";
};

export type TodoLists = {
  oneStampAway: { id: string; name: string }[];
  dormantToReactivate: { id: string; name: string; lastSeenDays: number }[];
  readyToInviteUnused: { id: string; name: string }[];
  expiringSoon: { id: string; padrinoName: string; hoursLeft: number }[];
  referrersToReview: { id: string; name: string }[];
};

export type MetricsPageData = {
  range: MetricsRange;
  integrity: {
    invitesExceedCards: boolean;
    redeemsExceedOpened: boolean;
    returnsExceedRedeems: boolean;
  };
  totals: {
    signups: number;
    directSignups: number;
    invitedSignups: number;
    cards: number;
    sent: number;
    opened: number;
    redeemed: number;
    stayed: number; // recurrente_ganado
    inWindow: number;
    noReturn: number; // sin_retorno
  };
  producesCustomers: {
    coffeesPerStayed: Ratio; // canjes / recurrentes
    giftPerformance: Ratio; // recurrentes / canjes
    newPer10Cards: number | null;
    stayedPer10Cards: number | null;
  };
  cascade: CascadeStep[];
  waffle: {
    total: number;
    groups: { key: WaffleGroupKey; count: number; pct: number }[];
    coffeesConsumed: number;
  };
  gates: { p1: Gate; p2: Gate; p3: Gate };
  velocity: {
    steps: VelocityStep[]; // invite→open, open→redeem, redeem→2nd
    windowDays: number;
    alarmThirdStep: boolean;
  };
  comparison: ComparisonRow[];
  cohorts: CohortRow[];
  engine: {
    cardsWithInvite: Ratio;
    padrinosRepeat: Ratio;
    invitesPerPadrino: number | null;
    depthTwoPlusShare: Ratio;
  };
  baseHealth: {
    active: number;
    dormant: number;
    off: number;
    reactivationRate: Ratio;
  };
  padrinos: PadrinoRow[];
  todo: TodoLists;
  barSignals: {
    hourHistogram: number[];
    avgScanMs: number | null;
    manualRate: number | null;
    maxDepth: number;
    redeemStreakDays: number;
    totalScans: number;
    expiredInvites: number;
  };
};

export async function loadMetricsPage(
  shopId: string,
  returnWindowDays: number,
  range: MetricsRange,
): Promise<MetricsPageData> {
  const now = Date.now();
  const since = rangeSince(range, now);

  const [
    { data: customersData, error: custErr },
    { data: passesData, error: passErr },
    { data: invitationsData, error: invErr },
    { data: attributionsData, error: attrErr },
    { data: scansData, error: scanErr },
  ] = await Promise.all([
    db().from("customers").select("*").eq("shop_id", shopId),
    db()
      .from("passes")
      .select("customer_id, stamps, cards_completed, updated_at, customers!inner(shop_id)")
      .eq("customers.shop_id", shopId)
      .returns<(Pick<PassRow, "customer_id" | "stamps" | "cards_completed" | "updated_at">)[]>(),
    db().from("invitations").select("*").eq("shop_id", shopId),
    db().from("attributions").select("*").eq("shop_id", shopId),
    db().from("scans").select("*").eq("shop_id", shopId),
  ]);
  assertNoQueryError(custErr, `customers.shop_id=${shopId}`);
  assertNoQueryError(passErr, `passes.shop_id=${shopId}`);
  assertNoQueryError(invErr, `invitations.shop_id=${shopId}`);
  assertNoQueryError(attrErr, `attributions.shop_id=${shopId}`);
  assertNoQueryError(scanErr, `scans.shop_id=${shopId}`);

  const allCustomers = customersData ?? [];
  const allPasses = passesData ?? [];
  const allInvitations = invitationsData ?? [];
  const allAttributions = attributionsData ?? [];
  const allScans = scansData ?? [];

  // El periodo filtra por cuándo pasó cada cosa, no por cuándo se dio de
  // alta el cliente: una invitación enviada esta semana por un padrino
  // antiguo sigue contando en "invitaciones enviadas del periodo".
  const inRange = (iso: string | null) => !since || (iso !== null && iso >= since);

  const customers = since ? allCustomers.filter((c) => inRange(c.created_at)) : allCustomers;
  const invitations = since ? allInvitations.filter((i) => inRange(i.created_at)) : allInvitations;
  const attributions = since
    ? allAttributions.filter((a) => inRange(a.redeemed_at))
    : allAttributions;

  const passByCustomer = new Map(allPasses.map((p) => [p.customer_id, p]));
  const attrByAhijado = new Map(allAttributions.map((a) => [a.ahijado_id, a]));
  const nameOf = (id: string) => firstName(allCustomers.find((c) => c.id === id)?.name ?? "—");

  // ---------------------------------------------------------------- totales
  const directSignups = customers.filter((c) => c.source === "qr").length;
  const invitedSignups = customers.filter((c) => c.source === "invitation").length;
  const cards = allPasses.reduce((sum, p) => sum + p.cards_completed, 0);
  const sent = invitations.filter((i) => i.sent_at).length;
  const opened = invitations.filter((i) => i.opened_at).length;
  const redeemed = invitations.filter((i) => i.state === "redeemed").length;
  const stayed = attributions.filter((a) => a.state === "billable").length;
  const inWindow = attributions.filter((a) => a.state === "window").length;
  const noReturn = attributions.filter((a) => a.state === "discarded").length;

  const totals = {
    signups: customers.length,
    directSignups,
    invitedSignups,
    cards,
    sent,
    opened,
    redeemed,
    stayed,
    inWindow,
    noReturn,
  };

  // -------------------------------------------------------------- integridad
  const integrity = {
    invitesExceedCards: sent > cards,
    redeemsExceedOpened: redeemed > opened,
    returnsExceedRedeems: stayed > redeemed,
  };

  // ------------------------------------------------------ produce clientes
  const producesCustomers = {
    coffeesPerStayed: ratio(redeemed, stayed),
    giftPerformance: ratio(stayed, redeemed),
    newPer10Cards: cards >= MIN_SAMPLE ? (invitedSignups / cards) * 10 : null,
    stayedPer10Cards: cards >= MIN_SAMPLE ? (stayed / cards) * 10 : null,
  };

  // -------------------------------------------------------------- cascada
  const cascade: CascadeStep[] = [
    { key: "signups", value: totals.signups, drop: null, reasonKey: "cascadeSignupsReason" },
    { key: "cards", value: cards, drop: totals.signups - cards, reasonKey: "cascadeCardsReason" },
    { key: "sent", value: sent, drop: null, reasonKey: "cascadeSentReason" },
    { key: "opened", value: opened, drop: sent - opened, reasonKey: "cascadeOpenedReason" },
    { key: "redeemed", value: redeemed, drop: opened - redeemed, reasonKey: "cascadeRedeemedReason" },
    { key: "stayed", value: stayed, drop: redeemed - stayed, reasonKey: "cascadeStayedReason" },
  ];

  // --------------------------------------------------------------- waffle
  function waffleGroupOf(inv: InvitationRow): WaffleGroupKey {
    const attr = attrByAhijado.get(inv.claimed_by ?? "");
    if (inv.state === "redeemed" || attr) {
      if (attr?.state === "billable") return "stayed";
      if (attr?.state === "discarded") return "redeemed_no_return";
      return "redeemed_window";
    }
    if (inv.state === "expired" || inv.state === "void") {
      return inv.opened_at ? "expired_after_open" : "expired_unopened";
    }
    if (inv.state === "opened" || inv.state === "claimed") return "opened_unredeemed";
    return "unopened_alive"; // created | sent
  }

  const waffleCounts = new Map<WaffleGroupKey, number>(WAFFLE_GROUP_ORDER.map((k) => [k, 0]));
  for (const inv of invitations) {
    const key = waffleGroupOf(inv);
    waffleCounts.set(key, (waffleCounts.get(key) ?? 0) + 1);
  }
  const waffleTotal = invitations.length;
  const waffle = {
    total: waffleTotal,
    groups: WAFFLE_GROUP_ORDER.map((key) => ({
      key,
      count: waffleCounts.get(key) ?? 0,
      pct: waffleTotal > 0 ? ((waffleCounts.get(key) ?? 0) / waffleTotal) * 100 : 0,
    })),
    coffeesConsumed: redeemed,
  };

  // ------------------------------------------------------------- 3 puertas
  const gates = {
    p1: evaluateGate("p1", sent, cards, GATE_CONFIG.p1.threshold, GATE_CONFIG.p1.minSample),
    p2: evaluateGate("p2", redeemed, sent, GATE_CONFIG.p2.threshold, GATE_CONFIG.p2.minSample),
    p3: evaluateGate("p3", stayed, redeemed, GATE_CONFIG.p3.threshold, GATE_CONFIG.p3.minSample),
  };

  // --------------------------------------------------------- velocidad ciclo
  const scansByCustomer = new Map<string, ScanRow[]>();
  for (const s of allScans) {
    if (!s.customer_id) continue;
    const list = scansByCustomer.get(s.customer_id);
    if (list) list.push(s);
    else scansByCustomer.set(s.customer_id, [s]);
  }

  const inviteToOpenDays = invitations
    .filter((i) => i.opened_at)
    .map((i) => daysBetween(i.created_at, i.opened_at as string));
  const openToRedeemDays = invitations
    .filter((i) => i.opened_at && i.redeemed_at)
    .map((i) => daysBetween(i.opened_at as string, i.redeemed_at as string));

  const redeemToSecondDays: number[] = [];
  for (const inv of invitations) {
    if (!inv.claimed_by || !inv.redeemed_at) continue;
    const guestScans = scansByCustomer.get(inv.claimed_by) ?? [];
    const firstAfter = guestScans
      .filter((s) => s.kind === "stamp" && s.created_at > (inv.redeemed_at as string))
      .sort((a, b) => a.created_at.localeCompare(b.created_at))[0];
    if (firstAfter) redeemToSecondDays.push(daysBetween(inv.redeemed_at, firstAfter.created_at));
  }

  const velocitySteps: VelocityStep[] = [
    { key: "inviteToOpen", days: median(inviteToOpenDays) },
    { key: "openToRedeem", days: median(openToRedeemDays) },
    { key: "redeemToSecond", days: median(redeemToSecondDays) },
  ];
  const velocity = {
    steps: velocitySteps,
    windowDays: returnWindowDays,
    alarmThirdStep: (velocitySteps[2].days ?? 0) > 20,
  };

  // -------------------------------------------------- invitado vs directo
  const invitedCustomers = customers.filter((c) => c.source === "invitation");
  const directCustomers = customers.filter((c) => c.source === "qr");

  function stampsInFirstMonth(customerId: string, signupIso: string): number {
    const cutoff = new Date(new Date(signupIso).getTime() + 30 * 24 * 3_600_000).toISOString();
    return (scansByCustomer.get(customerId) ?? []).filter(
      (s) => s.kind === "stamp" && s.created_at >= signupIso && s.created_at <= cutoff,
    ).length;
  }

  function stillStampingAt30(customerId: string, signupIso: string): boolean {
    const dayFrom = new Date(new Date(signupIso).getTime() + 23 * 24 * 3_600_000).toISOString();
    const dayTo = new Date(new Date(signupIso).getTime() + 37 * 24 * 3_600_000).toISOString();
    return (scansByCustomer.get(customerId) ?? []).some(
      (s) => s.kind === "stamp" && s.created_at >= dayFrom && s.created_at <= dayTo,
    );
  }

  function daysToSecondVisit(customerId: string): number | null {
    const stamps = (scansByCustomer.get(customerId) ?? [])
      .filter((s) => s.kind === "stamp")
      .sort((a, b) => a.created_at.localeCompare(b.created_at));
    if (stamps.length < 2) return null;
    return daysBetween(stamps[0].created_at, stamps[1].created_at);
  }

  function completedFirstCard(customerId: string): boolean {
    return (passByCustomer.get(customerId)?.cards_completed ?? 0) >= 1;
  }

  function cohortRate(pool: CustomerRow[], test: (c: CustomerRow) => boolean): number | null {
    if (pool.length < MIN_SAMPLE) return null;
    return (pool.filter(test).length / pool.length) * 100;
  }

  function cohortMedian(pool: CustomerRow[], value: (c: CustomerRow) => number | null): number | null {
    if (pool.length < MIN_SAMPLE) return null;
    const values = pool.map(value).filter((v): v is number => v !== null);
    return median(values);
  }

  const comparison: ComparisonRow[] = [
    {
      key: "stampingAt30",
      invited: cohortRate(invitedCustomers, (c) => stillStampingAt30(c.id, c.created_at)),
      direct: cohortRate(directCustomers, (c) => stillStampingAt30(c.id, c.created_at)),
      multiplier: null,
    },
    {
      key: "stampsFirstMonth",
      invited: cohortMedian(invitedCustomers, (c) => stampsInFirstMonth(c.id, c.created_at)),
      direct: cohortMedian(directCustomers, (c) => stampsInFirstMonth(c.id, c.created_at)),
      multiplier: null,
    },
    {
      key: "daysToSecondVisit",
      invited: cohortMedian(invitedCustomers, (c) => daysToSecondVisit(c.id)),
      direct: cohortMedian(directCustomers, (c) => daysToSecondVisit(c.id)),
      multiplier: null,
    },
    {
      key: "completesFirstCard",
      invited: cohortRate(invitedCustomers, (c) => completedFirstCard(c.id)),
      direct: cohortRate(directCustomers, (c) => completedFirstCard(c.id)),
      multiplier: null,
    },
  ];
  for (const row of comparison) {
    row.multiplier = row.invited !== null && row.direct !== null && row.direct !== 0
      ? row.invited / row.direct
      : null;
  }

  // ------------------------------------------------------------- cohortes
  const COHORT_WEEKS = 8;
  function weekStart(iso: string): string {
    const d = new Date(iso);
    const day = d.getUTCDay();
    const monday = new Date(d);
    monday.setUTCDate(d.getUTCDate() - ((day + 6) % 7));
    monday.setUTCHours(0, 0, 0, 0);
    return monday.toISOString().slice(0, 10);
  }

  // Qué cohortes se ven sí depende del rango -criterio de aceptación 5-,
  // aunque para juzgar si una cohorte "sigue activa" haga falta mirar sus
  // sellos aunque caigan fuera de ese rango (scansByCustomer, más abajo,
  // viene de allScans a propósito).
  const cohortBuckets = new Map<string, CustomerRow[]>();
  for (const c of customers) {
    const key = `${weekStart(c.created_at)}|${c.source === "qr" ? "direct" : "invited"}`;
    const list = cohortBuckets.get(key);
    if (list) list.push(c);
    else cohortBuckets.set(key, [c]);
  }

  const cohorts: CohortRow[] = [...cohortBuckets.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .slice(0, 10)
    .map(([key, pool]) => {
      const [cohortStart, kind] = key.split("|") as [string, "direct" | "invited"];
      const cohortStartMs = new Date(cohortStart).getTime();
      const weeksElapsed = Math.floor((now - cohortStartMs) / (7 * 24 * 3_600_000));
      const cellsPct = Array.from({ length: COHORT_WEEKS }, (_, week) => {
        if (week > weeksElapsed) return null; // el futuro no es 0%, es un guion
        if (pool.length < MIN_SAMPLE) return null;
        const from = new Date(cohortStartMs + week * 7 * 24 * 3_600_000).toISOString();
        const to = new Date(cohortStartMs + (week + 1) * 7 * 24 * 3_600_000).toISOString();
        const stillActive = pool.filter((c) =>
          (scansByCustomer.get(c.id) ?? []).some((s) => s.kind === "stamp" && s.created_at >= from && s.created_at < to),
        ).length;
        return (stillActive / pool.length) * 100;
      });
      return { cohortStart, kind, cohortSize: pool.length, cellsPct };
    });

  // -------------------------------------------------- ¿se sostiene solo?
  const invitationsByPadrino = new Map<string, InvitationRow[]>();
  for (const inv of allInvitations) {
    const list = invitationsByPadrino.get(inv.padrino_id);
    if (list) list.push(inv);
    else invitationsByPadrino.set(inv.padrino_id, [inv]);
  }
  const padrinoIds = [...invitationsByPadrino.keys()];

  let cardsWithInviteSum = 0;
  let padrinosWithTwoPlus = 0;
  for (const padrinoId of padrinoIds) {
    const invited = invitationsByPadrino.get(padrinoId)?.length ?? 0;
    const completedCards = passByCustomer.get(padrinoId)?.cards_completed ?? 0;
    cardsWithInviteSum += Math.min(invited, completedCards);
    if (invited >= 2) padrinosWithTwoPlus += 1;
  }

  const { depthById } = (() => {
    const allCustomerIds = allCustomers.map((c) => c.id);
    const chainRoots = findChainRoots(allCustomerIds, allInvitations);
    const childrenOf = new Map<string, string[]>();
    for (const inv of allInvitations) {
      if (!inv.claimed_by) continue;
      childrenOf.set(inv.padrino_id, [...(childrenOf.get(inv.padrino_id) ?? []), inv.claimed_by]);
    }
    return { depthById: computeReferralDepth(chainRoots, childrenOf) };
  })();

  const invitedWithDepth = customers.filter((c) => c.source === "invitation");
  const depthTwoPlus = invitedWithDepth.filter((c) => (depthById.get(c.id)?.depth ?? 1) >= 2).length;

  const engine = {
    cardsWithInvite: ratio(cardsWithInviteSum, cards),
    padrinosRepeat: ratio(padrinosWithTwoPlus, padrinoIds.length),
    invitesPerPadrino: median(padrinoIds.map((id) => invitationsByPadrino.get(id)?.length ?? 0)),
    depthTwoPlusShare: ratio(depthTwoPlus, invitedWithDepth.length),
  };

  // ------------------------------------------------------------- salud base
  const ACTIVE_DAYS = 30;
  const DORMANT_MAX_DAYS = 45;

  function lastStampDaysAgo(customerId: string): number | null {
    const stamps = (scansByCustomer.get(customerId) ?? []).filter((s) => s.kind === "stamp");
    if (!stamps.length) return null;
    const last = stamps.reduce((max, s) => (s.created_at > max ? s.created_at : max), stamps[0].created_at);
    return Math.floor((now - new Date(last).getTime()) / (24 * 3_600_000));
  }

  function lifecycleOf(customerId: string): "active" | "dormant" | "off" | "new" {
    const daysAgo = lastStampDaysAgo(customerId);
    if (daysAgo === null) return "new"; // nunca ha sellado -alta reciente sin visita todavía-
    if (daysAgo <= ACTIVE_DAYS) return "active";
    if (daysAgo <= DORMANT_MAX_DAYS) return "dormant";
    return "off";
  }

  let active = 0;
  let dormant = 0;
  let off = 0;
  for (const c of allCustomers) {
    const state = lifecycleOf(c.id);
    if (state === "active") active += 1;
    else if (state === "dormant") dormant += 1;
    else if (state === "off") off += 1;
  }

  // Dormidos de "hace un periodo" -misma duración que el periodo actual,
  // justo antes de él- que ya volvieron a sellar dentro del periodo actual.
  const periodMs = since ? now - new Date(since).getTime() : 90 * 24 * 3_600_000;
  const priorPeriodEnd = since ?? new Date(now - periodMs).toISOString();
  const priorPeriodStart = new Date(new Date(priorPeriodEnd).getTime() - periodMs).toISOString();
  const dormantLastPeriod = allCustomers.filter((c) => {
    const stamps = (scansByCustomer.get(c.id) ?? []).filter((s) => s.kind === "stamp");
    const lastBeforeCutoff = stamps
      .filter((s) => s.created_at < priorPeriodEnd)
      .sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
    if (!lastBeforeCutoff) return false;
    return lastBeforeCutoff.created_at >= priorPeriodStart;
  });
  const reactivated = dormantLastPeriod.filter((c) =>
    (scansByCustomer.get(c.id) ?? []).some((s) => s.kind === "stamp" && s.created_at >= priorPeriodEnd),
  );

  const baseHealth = {
    active,
    dormant,
    off,
    reactivationRate: ratio(reactivated.length, dormantLastPeriod.length),
  };

  // -------------------------------------------------------------- padrinos
  const padrinos: PadrinoRow[] = padrinoIds
    .map((id) => {
      const invited = invitationsByPadrino.get(id) ?? [];
      const openedCount = invited.filter((i) => i.opened_at).length;
      const redeemedCount = invited.filter((i) => i.state === "redeemed").length;
      const stayedCount = invited.filter((i) => i.claimed_by && attrByAhijado.get(i.claimed_by)?.state === "billable").length;
      const lifecycle = lifecycleOf(id);
      return {
        id,
        name: nameOf(id),
        invited: invited.length,
        opened: openedCount,
        redeemed: redeemedCount,
        stayed: stayedCount,
        status: lifecycle === "new" ? "off" as const : lifecycle,
      };
    })
    .sort((a, b) => b.stayed - a.stayed)
    .slice(0, 10);

  // ------------------------------------------------------------ qué hacer hoy
  const oneStampAway = allCustomers
    .filter((c) => {
      const p = passByCustomer.get(c.id);
      return p && p.stamps === 9;
    })
    .map((c) => ({ id: c.id, name: nameOf(c.id) }));

  const dormantToReactivate = allCustomers
    .map((c) => ({ c, daysAgo: lastStampDaysAgo(c.id) }))
    .filter(
      (row): row is { c: CustomerRow; daysAgo: number } =>
        row.daysAgo !== null && row.daysAgo >= 15 && row.daysAgo <= 45,
    )
    .map(({ c, daysAgo }) => ({ id: c.id, name: nameOf(c.id), lastSeenDays: daysAgo }));

  const readyToInviteUnused = allCustomers
    .filter((c) => {
      const p = passByCustomer.get(c.id);
      const invited = invitationsByPadrino.get(c.id)?.length ?? 0;
      return (p?.cards_completed ?? 0) > invited;
    })
    .map((c) => ({ id: c.id, name: nameOf(c.id) }));

  const expiringSoon = allInvitations
    .filter((i) => (i.state === "sent" || i.state === "opened") && new Date(i.expires_at).getTime() - now <= 48 * 3_600_000 && new Date(i.expires_at).getTime() > now)
    .map((i) => ({
      id: i.id,
      padrinoName: nameOf(i.padrino_id),
      hoursLeft: Math.max(0, Math.round((new Date(i.expires_at).getTime() - now) / 3_600_000)),
    }));

  // Padrinos a revisar: >=2 invitados que canjearon y ninguno volvió -señal
  // a revisar, no una acusación: con dos cafés en juego es indistinguible
  // del fraude sin más contexto, así que la interfaz solo dice "a revisar".
  const referrersToReview = padrinoIds
    .filter((id) => {
      const invited = invitationsByPadrino.get(id) ?? [];
      const redeemedGuests = invited.filter((i) => i.claimed_by && attrByAhijado.has(i.claimed_by));
      return (
        redeemedGuests.length >= 2 &&
        redeemedGuests.every((i) => attrByAhijado.get(i.claimed_by as string)?.state !== "billable")
      );
    })
    .map((id) => ({ id, name: nameOf(id) }));

  const todo: TodoLists = {
    oneStampAway,
    dormantToReactivate,
    readyToInviteUnused,
    expiringSoon,
    referrersToReview,
  };

  // ------------------------------------------------------------ señales de barra
  const stampScans = allScans.filter((s) => s.kind === "stamp" && inRange(s.created_at));
  const hourHistogram = new Array(24).fill(0) as number[];
  for (const s of stampScans) hourHistogram[new Date(s.created_at).getUTCHours()] += 1;

  const timedScans = stampScans.filter((s) => s.duration_ms !== null);
  const avgScanMs = timedScans.length
    ? Math.round(timedScans.reduce((sum, s) => sum + (s.duration_ms ?? 0), 0) / timedScans.length)
    : null;
  const manualRate = stampScans.length
    ? stampScans.filter((s) => s.manual).length / stampScans.length
    : null;

  const maxDepth = [...depthById.values()].reduce((max, d) => Math.max(max, d.depth), 0);

  // Racha de días consecutivos -hasta hoy- con al menos un canje.
  let redeemStreakDays = 0;
  {
    const redeemDays = new Set(
      allInvitations.filter((i) => i.redeemed_at).map((i) => (i.redeemed_at as string).slice(0, 10)),
    );
    for (let d = 0; d < 365; d++) {
      const day = new Date(now - d * 24 * 3_600_000).toISOString().slice(0, 10);
      if (!redeemDays.has(day)) break;
      redeemStreakDays += 1;
    }
  }

  const barSignals = {
    hourHistogram,
    avgScanMs,
    manualRate,
    maxDepth,
    redeemStreakDays,
    totalScans: stampScans.length,
    expiredInvites: invitations.filter((i) => i.state === "expired").length,
  };

  return {
    range,
    integrity,
    totals,
    producesCustomers,
    cascade,
    waffle,
    gates,
    velocity,
    comparison,
    cohorts,
    engine,
    baseHealth,
    padrinos,
    todo,
    barSignals,
  };
}

function daysBetween(fromIso: string, toIso: string): number {
  return (new Date(toIso).getTime() - new Date(fromIso).getTime()) / (24 * 3_600_000);
}
