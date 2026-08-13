"use client";

import { cn } from "@/lib/cn";
import { fill, type Dict } from "@/lib/i18n";
import type { ScanResponse } from "@/lib/scan";

type BaristaDict = Dict["barista"];

/** Milisegundos que el resultado permanece en pantalla antes de cerrarse solo. */
export const AUTOCLOSE_MS = 2000;

const SKIN: Record<ScanResponse["kind"], string> = {
  stamp: "verdict-jade",
  redeem_reward: "verdict-saffron",
  redeem_invitation: "verdict-cobalt",
  duplicate: "verdict-smoke",
  invalid: "verdict-tomato",
};

/**
 * El resultado de un escaneo, a pantalla completa y en una sola tinta.
 *
 * Se diseña para leerse de reojo, a dos metros, con una cola detrás: el
 * barista no lee, reconoce un color. El texto está para el caso raro.
 */
export function Verdict({
  result,
  t,
  onClose,
  onConfirm,
  busy,
}: {
  result: ScanResponse;
  t: BaristaDict;
  onClose: () => void;
  onConfirm?: () => void;
  busy?: boolean;
}) {
  const needsConfirm =
    (result.kind === "redeem_reward" || result.kind === "redeem_invitation") &&
    result.pending;

  const skin =
    result.kind === "stamp" && result.cardCompleted
      ? "verdict-saffron"
      : SKIN[result.kind];

  return (
    <div
      className={cn("verdict anim-flood grain grain-light select-none-hard", skin)}
      role="alert"
      aria-live="assertive"
      onClick={needsConfirm ? undefined : onClose}
    >
      <span
        aria-hidden
        className="halftone halftone-lg anim-drift pointer-events-none absolute -right-16 -top-16 size-72 rounded-full"
      />

      <div className="flex flex-1 flex-col justify-center px-7 pb-8 pt-[max(2rem,env(safe-area-inset-top))]">
        <Body result={result} t={t} />
      </div>

      {needsConfirm && onConfirm ? (
        <div className="px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className="btn-press w-full rounded-2xl border-2 border-ink bg-ink px-6 py-6 text-[1.35rem] font-bold text-paper shadow-[6px_6px_0_0_rgba(23,17,13,0.35)] disabled:opacity-60"
          >
            {busy ? t.results.rewardConfirm : t.confirm}
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="✕"
            className="overline mt-4 w-full py-2 opacity-70"
          >
            ✕
          </button>
        </div>
      ) : (
        <div className="h-1.5 w-full bg-black/15">
          <div
            className="drain h-full w-full bg-black/40"
            style={{ ["--drain" as string]: `${AUTOCLOSE_MS}ms` }}
          />
        </div>
      )}
    </div>
  );
}

/**
 * Titular del veredicto. Se mide en `cqw` contra la propia pantalla de
 * resultado, así que un nombre largo encoge en vez de salirse por el lado.
 */
const HEADLINE =
  "display-tight hyphens-auto break-words text-[clamp(2.4rem,13cqw,4.6rem)]";

function Body({ result, t }: { result: ScanResponse; t: BaristaDict }) {
  switch (result.kind) {
    case "stamp":
      return (
        <>
          <p className="overline opacity-75">
            {fill(t.results.stampFor, { name: result.name })}
          </p>
          <h1 className={cn(HEADLINE, "mt-3")}>
            {result.cardCompleted
              ? t.results.rewardTitle
              : fill(t.results.stampTitle, { n: result.stamps, goal: result.goal })}
          </h1>
          <Dots filled={result.stamps} goal={result.goal} />
          {result.cardCompleted ? (
            <p className="mt-5 text-[1.25rem] font-semibold">
              {fill(t.results.rewardBody, { name: result.name })}
            </p>
          ) : result.stamps === result.goal - 1 ? (
            <p className="mt-5 text-[1.25rem] font-semibold">{t.results.lastOne}</p>
          ) : null}
        </>
      );

    // El titular es siempre la acción, nunca la frase larga: lo que el
    // barista tiene que reconocer a dos metros es "café gratis", y el nombre
    // solo le hace falta cuando ya se ha acercado.
    case "redeem_reward":
      return (
        <>
          <h1 className={HEADLINE}>{t.results.rewardTitle}</h1>
          <p className="mt-4 text-[1.25rem] font-semibold opacity-90">
            {fill(t.results.rewardBody, { name: result.name })}
          </p>
          <p className="mt-6 text-[1.3rem] font-semibold">
            {result.pending ? t.results.rewardConfirm : "✓"}
          </p>
        </>
      );

    case "redeem_invitation":
      return (
        <>
          <h1 className={HEADLINE}>{t.results.inviteTitle}</h1>
          <p className="mt-4 text-[1.25rem] font-semibold opacity-90">
            {fill(t.results.inviteBody, {
              name: result.name,
              padrino: result.padrino,
            })}
          </p>
          <p className="mt-6 text-[1.3rem] font-semibold">
            {result.pending ? t.results.inviteConfirm : "✓"}
          </p>
        </>
      );

    case "duplicate":
      return (
        <>
          <h1 className={HEADLINE}>{t.results.duplicateTitle}</h1>
          <p className="numeral mt-4 text-[1.35rem]">
            {fill(t.results.duplicateBody, { n: Math.max(result.minutesAgo, 1) })}
          </p>
        </>
      );

    case "invalid":
      return (
        <>
          <h1 className={HEADLINE}>{t.results.invalidTitle}</h1>
          <p className="mt-4 text-[1.25rem] font-semibold">
            {result.reason === "other_shop"
              ? t.results.invalidOtherShop
              : t.results.invalidUnknown}
          </p>
        </>
      );
  }
}

/** Los sellos, grandes y sin detalle: a dos metros solo se ven bultos. */
function Dots({ filled, goal }: { filled: number; goal: number }) {
  return (
    <ul className="mt-7 flex flex-wrap gap-2">
      {Array.from({ length: goal }, (_, i) => (
        <li
          key={i}
          className={cn(
            "size-5 rounded-full border-2 border-current",
            i < filled ? "bg-current" : "opacity-35",
          )}
        />
      ))}
    </ul>
  );
}
