import { GATE_CONFIG, evaluateGate, type Gate } from "@/lib/attribution";
import { db } from "@/lib/db/client";

export type DailyPoint = { date: string; value: number };

export type FunnelData = {
  signups: number;
  cards: number;
  sent: number;
  opened: number;
  redeemed: number;
  returns: number;
  gates: { p1: Gate; p2: Gate; p3: Gate };
  ops: {
    /** Media de milisegundos de barra lista a resultado en pantalla. */
    avgScanMs: number | null;
    /** Proporción de sellos puestos a mano en vez de por cámara. */
    manualRate: number | null;
    expiredInvites: number;
    /** Escaneos de los últimos 7 días, para detectar abuso del dispositivo. */
    scansLast7Days: number;
  };
  /**
   * Series diarias para las gráficas de línea del panel. `cards` no tiene
   * serie propia: `passes.cards_completed` es un contador que se pisa en
   * cada actualización, no un registro de cuándo se completó cada tarjeta,
   * así que no hay forma de repartirlo por día sin una tabla de eventos
   * nueva.
   */
  series: {
    signups: DailyPoint[];
    scans: DailyPoint[];
    sent: DailyPoint[];
    opened: DailyPoint[];
    redeemed: DailyPoint[];
    returns: DailyPoint[];
  };
};

/** Escaneos recientes que se promedian. Basta para una media estable. */
const SCAN_SAMPLE = 500;

/** Ventana de las gráficas de línea: dos semanas, para ver la tendencia sin ahogarla en ruido. */
const SERIES_DAYS = 14;

export async function loadFunnel(shopId: string): Promise<FunnelData> {
  const weekAgo = new Date(Date.now() - 7 * 24 * 3_600_000).toISOString();
  const seriesSince = new Date(Date.now() - SERIES_DAYS * 24 * 3_600_000).toISOString();

  const [
    signups,
    cardsRows,
    sent,
    opened,
    redeemed,
    returns,
    expired,
    scanSample,
    recentScans,
    signupSeries,
    scanSeries,
    sentSeries,
    openedSeries,
    redeemedSeries,
    returnsSeries,
  ] = await Promise.all([
    countOf(counter("customers").eq("shop_id", shopId)),
    // Suma en memoria: en el piloto son cientos de filas, no millones.
    db()
      .from("passes")
      .select("cards_completed, customers!inner(shop_id)")
      .eq("customers.shop_id", shopId)
      .returns<{ cards_completed: number }[]>(),
    // "Enviadas" incluye todo lo que pasó de ahí: una invitación canjeada
    // se envió antes, aunque su estado actual ya no lo diga. Por eso se
    // comprueba `sent_at` -una marca de tiempo real que nunca se borra-, no
    // una lista de estados: una invitación que se envió y luego caducó o se
    // anuló (el destinatario ya era cliente) seguía contando como "sent" en
    // el estado actual, pero desaparecía de esta lista si el filtro era por
    // estado. `opened_at` de la siguiente consulta ya usaba el patrón
    // correcto; este debía ser igual.
    countOf(counter("invitations").eq("shop_id", shopId).not("sent_at", "is", null)),
    countOf(counter("invitations").eq("shop_id", shopId).not("opened_at", "is", null)),
    countOf(counter("invitations").eq("shop_id", shopId).eq("state", "redeemed")),
    countOf(counter("attributions").eq("shop_id", shopId).eq("state", "billable")),
    countOf(counter("invitations").eq("shop_id", shopId).eq("state", "expired")),
    db()
      .from("scans")
      .select("duration_ms, manual")
      .eq("shop_id", shopId)
      .eq("kind", "stamp")
      .order("created_at", { ascending: false })
      .limit(SCAN_SAMPLE)
      .returns<{ duration_ms: number | null; manual: boolean }[]>(),
    countOf(counter("scans").eq("shop_id", shopId).gte("created_at", weekAgo)),
    db()
      .from("customers")
      .select("created_at")
      .eq("shop_id", shopId)
      .gte("created_at", seriesSince)
      .returns<{ created_at: string }[]>(),
    db()
      .from("scans")
      .select("created_at")
      .eq("shop_id", shopId)
      .eq("kind", "stamp")
      .gte("created_at", seriesSince)
      .returns<{ created_at: string }[]>(),
    db()
      .from("invitations")
      .select("sent_at")
      .eq("shop_id", shopId)
      .not("sent_at", "is", null)
      .gte("sent_at", seriesSince)
      .returns<{ sent_at: string }[]>(),
    db()
      .from("invitations")
      .select("opened_at")
      .eq("shop_id", shopId)
      .not("opened_at", "is", null)
      .gte("opened_at", seriesSince)
      .returns<{ opened_at: string }[]>(),
    db()
      .from("invitations")
      .select("redeemed_at")
      .eq("shop_id", shopId)
      .not("redeemed_at", "is", null)
      .gte("redeemed_at", seriesSince)
      .returns<{ redeemed_at: string }[]>(),
    // Mismo filtro que el contador de `returns` -state billable-, no solo
    // "tiene fecha de retorno": una atribución puede volver y aun así no
    // ser facturable todavía si el propio criterio de negocio no se cumple.
    db()
      .from("attributions")
      .select("returned_at")
      .eq("shop_id", shopId)
      .eq("state", "billable")
      .not("returned_at", "is", null)
      .gte("returned_at", seriesSince)
      .returns<{ returned_at: string }[]>(),
  ]);

  const cards = (cardsRows.data ?? []).reduce(
    (total, row) => total + row.cards_completed,
    0,
  );

  const sample = scanSample.data ?? [];
  const timed = sample.filter((scan) => scan.duration_ms !== null);
  const avgScanMs = timed.length
    ? Math.round(
        timed.reduce((total, scan) => total + (scan.duration_ms ?? 0), 0) /
          timed.length,
      )
    : null;

  const manualRate = sample.length
    ? sample.filter((scan) => scan.manual).length / sample.length
    : null;

  return {
    signups,
    cards,
    sent,
    opened,
    redeemed,
    returns,
    gates: {
      p1: evaluateGate("p1", sent, cards, GATE_CONFIG.p1.threshold, GATE_CONFIG.p1.minSample),
      p2: evaluateGate("p2", redeemed, sent, GATE_CONFIG.p2.threshold, GATE_CONFIG.p2.minSample),
      p3: evaluateGate("p3", returns, redeemed, GATE_CONFIG.p3.threshold, GATE_CONFIG.p3.minSample),
    },
    ops: { avgScanMs, manualRate, expiredInvites: expired, scansLast7Days: recentScans },
    series: {
      signups: bucketDays(signupSeries.data ?? []),
      scans: bucketDays(scanSeries.data ?? []),
      sent: bucketDays(
        (sentSeries.data ?? []).map((row) => ({ created_at: row.sent_at })),
      ),
      opened: bucketDays(
        (openedSeries.data ?? []).map((row) => ({ created_at: row.opened_at })),
      ),
      redeemed: bucketDays(
        (redeemedSeries.data ?? []).map((row) => ({ created_at: row.redeemed_at })),
      ),
      returns: bucketDays(
        (returnsSeries.data ?? []).map((row) => ({ created_at: row.returned_at })),
      ),
    },
  };
}

/**
 * Cuenta filas por día sobre los últimos `SERIES_DAYS`, con los días sin
 * ninguna fila presentes a cero: la gráfica tiene que enseñar el hueco, no
 * saltárselo.
 */
function bucketDays(rows: { created_at: string }[]): DailyPoint[] {
  const buckets = new Map<string, number>();
  for (let i = SERIES_DAYS - 1; i >= 0; i--) {
    const day = new Date(Date.now() - i * 24 * 3_600_000).toISOString().slice(0, 10);
    buckets.set(day, 0);
  }

  for (const row of rows) {
    const key = row.created_at.slice(0, 10);
    if (buckets.has(key)) buckets.set(key, (buckets.get(key) ?? 0) + 1);
  }

  return [...buckets.entries()].map(([date, value]) => ({ date, value }));
}

/**
 * Resuelve una consulta `head: true` y devuelve solo el total.
 * Recibe la consulta ya construida para no tener que tipar el encadenado
 * genérico del constructor de Supabase.
 */
async function countOf(
  query: PromiseLike<{ count: number | null }>,
): Promise<number> {
  const { count } = await query;
  return count ?? 0;
}

/** Genérico sobre el nombre de tabla para que cada consulta conserve sus columnas. */
function counter<T extends "customers" | "invitations" | "attributions" | "scans">(
  table: T,
) {
  return db().from(table).select("*", { count: "exact", head: true });
}
