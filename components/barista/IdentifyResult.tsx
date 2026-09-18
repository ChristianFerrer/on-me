"use client";

import { cn } from "@/lib/cn";
import { fill, plural, type Dict } from "@/lib/i18n";
import type { IdentifyApplyResult } from "@/lib/identify-service";
import { AUTOCLOSE_MS } from "./Verdict";

type BaristaDict = Dict["barista"];

const SKIN: Record<IdentifyApplyResult["kind"], string> = {
  applied: "verdict-lime",
  invalid: "verdict-coral",
};

const HEADLINE = "display-tight hyphens-auto break-words text-[clamp(2.5rem,14cqw,4.75rem)]";
const SUB = "mt-4 text-[1.1875rem] font-medium leading-snug opacity-70";

/**
 * Pantalla final del flujo identificador -mismo lenguaje visual que
 * Verdict.tsx, un color a pantalla completa reconocible a dos metros-,
 * pero su propio componente: lo que aquí se cuenta -sellos, canje, cuántos
 * quedan pendientes- no existe en el flujo clásico. El cierre automático
 * ya lo programa useIdentifyFlow.ts, aquí solo se pinta.
 */
export function IdentifyResult({
  result,
  t,
  onClose,
}: {
  result: IdentifyApplyResult;
  t: BaristaDict;
  onClose: () => void;
}) {
  return (
    <div
      className={cn("verdict anim-flood select-none-hard", SKIN[result.kind])}
      role="alert"
      aria-live="assertive"
      onClick={onClose}
    >
      <div className="flex flex-1 flex-col justify-center px-8 pb-10 pt-[max(2.5rem,env(safe-area-inset-top))]">
        <Body result={result} t={t} />
      </div>

      <div className="mx-auto flex w-full max-w-[26rem] flex-col gap-3 px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onClose();
          }}
          className="btn w-full bg-ink px-6 py-6 text-[1.1875rem] text-chalk"
        >
          {t.backToScanner}
        </button>
        <div className="h-0.5 w-full bg-current/15">
          <div
            className="drain h-full w-full bg-current/45"
            style={{ ["--drain" as string]: `${AUTOCLOSE_MS}ms` }}
          />
        </div>
      </div>
    </div>
  );
}

function Body({ result, t }: { result: IdentifyApplyResult; t: BaristaDict }) {
  switch (result.kind) {
    case "applied":
      return (
        <>
          <p className="eyebrow opacity-55">
            {fill(t.results.stampFor, { name: result.name })}
          </p>
          <h1 className={cn(HEADLINE, "mt-4")}>
            {fill(t.results.stampTitle, { n: result.stamps, goal: result.goal })}
          </h1>
          <Dots filled={result.stamps} goal={result.goal} />
          {result.added > 0 ? (
            <p className="numeral mt-3 text-[1.0625rem] font-bold opacity-80">
              {plural(
                result.added,
                t.results.stampAddedOne,
                fill(t.results.stampAddedMany, { n: result.added }),
              )}
            </p>
          ) : null}
          {result.redeemed > 0 ? (
            <p className="numeral mt-1 text-[1.0625rem] font-bold opacity-80">
              {plural(
                result.redeemed,
                t.identifyRedeemedOne,
                fill(t.identifyRedeemedMany, { n: result.redeemed }),
              )}
            </p>
          ) : null}
          {result.rewardsRemaining > 0 ? (
            <p className={SUB}>
              {plural(
                result.rewardsRemaining,
                t.identifyRewardsRemainingOne,
                fill(t.identifyRewardsRemainingMany, { n: result.rewardsRemaining }),
              )}
            </p>
          ) : null}
        </>
      );

    case "invalid":
      return (
        <>
          <h1 className={HEADLINE}>{t.results.invalidTitle}</h1>
          <p className={SUB}>
            {result.reason === "other_shop"
              ? t.results.invalidOtherShop
              : result.reason === "network"
                ? t.results.invalidNetwork
                : result.reason === "device"
                  ? t.results.invalidDevice
                  : t.results.invalidUnknown}
          </p>
        </>
      );
  }
}

/** Los sellos, sin detalle: a dos metros solo se ven bultos. Copia deliberada de la de Verdict.tsx -no compartida-. */
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
