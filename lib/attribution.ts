/**
 * Motor de atribución. Lógica pura, testeable sin base de datos.
 *
 * Las cinco condiciones del Cliente Nuevo Verificado, todas obligatorias:
 *
 *   1. teléfono nunca visto antes en ese local
 *        -> lo garantiza el índice único (shop_id, phone_hash) y la
 *           detección de cliente existente en /api/invite/claim
 *   2. invitación trazable hasta un padrino con tarjeta completada
 *        -> lo garantiza que la invitación solo se crea al completar tarjeta
 *   3. canje escaneado por un dispositivo autorizado del local
 *        -> lo garantiza que la atribución nace de un scan con device_id
 *   4. segunda compra pagada con MÁS de 24 h de separación
 *   5. todo dentro de la ventana de retorno del local
 *
 * Este módulo decide las condiciones 4 y 5. Las tres primeras son estructurales:
 * si no se cumplen, la fila de `attributions` no llega a existir.
 *
 * Ante la duda, no se factura. Es preferible perder atribuciones legítimas a
 * tener una sola discusión con el dueño sobre si le estás cobrando de más.
 */

/** Separación mínima entre el canje y la segunda compra. */
export const RETURN_MIN_HOURS = 24;

const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;

export type ReturnCandidate = {
  id: string;
  createdAt: Date;
  /** Solo un sello prueba una compra pagada; un canje no prueba nada. */
  kind: string;
};

export type AttributionOutcome =
  | { state: "billable"; returnScanId: string; returnedAt: Date }
  | { state: "discarded"; reason: "window_closed" }
  | { state: "window" };

export type AttributionInput = {
  now: Date;
  redeemedAt: Date;
  returnWindowDays: number;
  /** Escaneos del ahijado posteriores al canje, en cualquier orden. */
  scans: ReturnCandidate[];
};

export function evaluateAttribution(input: AttributionInput): AttributionOutcome {
  const { now, redeemedAt, returnWindowDays, scans } = input;

  const earliestValid = new Date(redeemedAt.getTime() + RETURN_MIN_HOURS * HOUR_MS);
  const windowCloses = new Date(redeemedAt.getTime() + returnWindowDays * DAY_MS);

  const qualifying = scans
    .filter(
      (scan) =>
        // Condición 4: una compra pagada, no otro canje.
        scan.kind === "stamp" &&
        // Estrictamente MÁS de 24 h: volver a las 23:59 no cuenta.
        scan.createdAt.getTime() > earliestValid.getTime() &&
        // Condición 5: dentro de la ventana.
        scan.createdAt.getTime() <= windowCloses.getTime(),
    )
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

  const first = qualifying[0];
  if (first) {
    return {
      state: "billable",
      returnScanId: first.id,
      returnedAt: first.createdAt,
    };
  }

  // Sin retorno válido y con la ventana cerrada: se descarta y no se factura.
  if (now.getTime() > windowCloses.getTime()) {
    return { state: "discarded", reason: "window_closed" };
  }

  // Todavía puede volver.
  return { state: "window" };
}

// ------------------------------------------------------------------ puertas

export type GateVerdict = "pass" | "below" | "insufficient_sample";

export type Gate = {
  key: "p1" | "p2" | "p3";
  numerator: number;
  denominator: number;
  ratio: number | null;
  threshold: number;
  minSample: number;
  verdict: GateVerdict;
};

/**
 * Nunca mostrar un porcentaje como veredicto sin comprobar la muestra:
 * con 7 canjes, un 28,6% no significa nada.
 */
export function evaluateGate(
  key: Gate["key"],
  numerator: number,
  denominator: number,
  threshold: number,
  minSample: number,
): Gate {
  const ratio = denominator > 0 ? numerator / denominator : null;

  const verdict: GateVerdict =
    denominator < minSample
      ? "insufficient_sample"
      : ratio !== null && ratio >= threshold
        ? "pass"
        : "below";

  return { key, numerator, denominator, ratio, threshold, minSample, verdict };
}

export const GATE_CONFIG = {
  p1: { threshold: 0.4, minSample: 20 },
  p2: { threshold: 0.25, minSample: 20 },
  p3: { threshold: 0.3, minSample: 10 },
} as const;
