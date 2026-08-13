import type { Gate } from "@/lib/attribution";
import { cn } from "@/lib/cn";
import { fill, type Dict } from "@/lib/i18n";

type AdminDict = Dict["admin"];

const SKIN = {
  pass: "bg-jade text-ink",
  below: "bg-tomato text-paper",
  insufficient_sample: "bg-paper-deep text-ink",
} as const;

/**
 * Una de las tres puertas del piloto.
 *
 * Con muestra insuficiente el porcentaje se enseña en gris y sin veredicto,
 * nunca como resultado. Con 7 canjes, un 28,6% no significa nada, y tomar
 * una decisión con ese número es peor que no tener el número.
 */
export function GateCard({
  gate,
  label,
  t,
}: {
  gate: Gate;
  label: string;
  t: AdminDict;
}) {
  const verdictLabel =
    gate.verdict === "pass"
      ? t.passes
      : gate.verdict === "below"
        ? t.below
        : t.insufficient;

  const percent =
    gate.ratio === null ? "—" : `${Math.round(gate.ratio * 1000) / 10}%`;

  return (
    <article
      className={cn(
        "riso relative overflow-hidden rounded-[var(--radius-card)] border-2 border-ink p-5",
        SKIN[gate.verdict],
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="overline uppercase opacity-70">{gate.key}</p>
        <p
          className={cn(
            "overline rounded-full border-2 border-current px-2.5 py-1",
            gate.verdict === "insufficient_sample" && "opacity-60",
          )}
        >
          {verdictLabel}
        </p>
      </div>

      <p
        className={cn(
          "display-tight numeral mt-3 text-[3.2rem]",
          gate.verdict === "insufficient_sample" && "opacity-40",
        )}
      >
        {percent}
      </p>

      <p className="mt-1 text-[0.9rem] font-semibold leading-snug">{label}</p>

      <p className="numeral mt-3 text-[0.82rem] opacity-75">
        {gate.numerator}/{gate.denominator} ·{" "}
        {fill(t.target, { n: Math.round(gate.threshold * 100) })}
      </p>

      {gate.verdict === "insufficient_sample" ? (
        <p className="numeral mt-1 text-[0.82rem] opacity-75">
          {fill(t.insufficientBody, { n: gate.minSample, m: gate.denominator })}
        </p>
      ) : null}
    </article>
  );
}
