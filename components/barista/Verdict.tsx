"use client";

import { cn } from "@/lib/cn";
import { fill, type Dict } from "@/lib/i18n";
import type { ScanResponse } from "@/lib/scan";

type BaristaDict = Dict["barista"];

/** Milisegundos que el resultado permanece en pantalla antes de cerrarse solo. */
export const AUTOCLOSE_MS = 2000;

const SKIN: Record<ScanResponse["kind"], string> = {
  stamp: "verdict-lime",
  redeem_reward: "verdict-amber",
  redeem_invitation: "verdict-azure",
  duplicate: "verdict-slate",
  invalid: "verdict-coral",
};

/**
 * El resultado de un escaneo, a pantalla completa y en un solo color.
 *
 * Es el único sitio del producto donde el minimalismo se detiene: el barista
 * no lee, reconoce un color, con cola detrás y a dos metros. El texto está
 * para el caso raro.
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

  return (
    <div
      className={cn("verdict anim-flood select-none-hard", SKIN[result.kind])}
      role="alert"
      aria-live="assertive"
      onClick={needsConfirm ? undefined : onClose}
    >
      <div className="flex flex-1 flex-col justify-center px-8 pb-10 pt-[max(2.5rem,env(safe-area-inset-top))]">
        <Body result={result} t={t} />
      </div>

      {needsConfirm && onConfirm ? (
        <div className="flex flex-col gap-2 px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className="btn w-full bg-ink px-6 py-6 text-[1.1875rem] text-chalk disabled:opacity-50"
          >
            {t.confirm}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="btn w-full px-6 py-4 text-[0.9375rem] opacity-55"
          >
            {t.cancel}
          </button>
        </div>
      ) : (
        <div className="h-0.5 w-full bg-current/15">
          <div
            className="drain h-full w-full bg-current/45"
            style={{ ["--drain" as string]: `${AUTOCLOSE_MS}ms` }}
          />
        </div>
      )}
    </div>
  );
}

/**
 * Titular del veredicto, medido en `cqw` contra la propia pantalla: un
 * nombre largo encoge en vez de salirse por el lado.
 */
const HEADLINE =
  "display-tight hyphens-auto break-words text-[clamp(2.5rem,14cqw,4.75rem)]";

const SUB = "mt-4 text-[1.1875rem] font-medium leading-snug opacity-70";

function Body({ result, t }: { result: ScanResponse; t: BaristaDict }) {
  switch (result.kind) {
    case "stamp":
      return (
        <>
          <p className="eyebrow opacity-55">
            {fill(t.results.stampFor, { name: result.name })}
          </p>
          <h1 className={cn(HEADLINE, "mt-4")}>
            {result.cardCompleted
              ? t.results.rewardTitle
              : fill(t.results.stampTitle, { n: result.stamps, goal: result.goal })}
          </h1>
          <Dots filled={result.stamps} goal={result.goal} />
          {result.cardCompleted ? (
            <p className={SUB}>{fill(t.results.rewardBody, { name: result.name })}</p>
          ) : result.stamps === result.goal - 1 ? (
            <p className={SUB}>{t.results.lastOne}</p>
          ) : null}
        </>
      );

    // El titular es siempre la acción, nunca la frase larga: lo que hay que
    // reconocer a dos metros es "café gratis"; el nombre hace falta después.
    case "redeem_reward":
      return (
        <>
          <h1 className={HEADLINE}>{t.results.rewardTitle}</h1>
          <p className={SUB}>{fill(t.results.rewardBody, { name: result.name })}</p>
        </>
      );

    case "redeem_invitation":
      return (
        <>
          <h1 className={HEADLINE}>{t.results.inviteTitle}</h1>
          <p className={SUB}>
            {fill(t.results.inviteBody, {
              name: result.name,
              padrino: result.padrino,
            })}
          </p>
        </>
      );

    case "duplicate":
      return (
        <>
          <h1 className={HEADLINE}>{t.results.duplicateTitle}</h1>
          <p className={cn(SUB, "numeral")}>
            {fill(t.results.duplicateBody, { n: Math.max(result.minutesAgo, 1) })}
          </p>
        </>
      );

    case "invalid":
      return (
        <>
          <h1 className={HEADLINE}>{t.results.invalidTitle}</h1>
          <p className={SUB}>
            {result.reason === "other_shop"
              ? t.results.invalidOtherShop
              : t.results.invalidUnknown}
          </p>
        </>
      );
  }
}

/** Los sellos, sin detalle: a dos metros solo se ven bultos. */
function Dots({ filled, goal }: { filled: number; goal: number }) {
  return (
    <ul className="mt-8 flex items-center gap-2">
      {Array.from({ length: goal }, (_, i) => (
        <li
          key={i}
          className={cn(
            "aspect-square min-w-0 flex-1 rounded-full",
            i < filled ? "bg-current" : "border border-current/30",
          )}
        />
      ))}
    </ul>
  );
}
