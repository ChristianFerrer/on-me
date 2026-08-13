import type { Gate } from "@/lib/attribution";
import { cn } from "@/lib/cn";
import { fill, type Dict } from "@/lib/i18n";

type AdminDict = Dict["admin"];

const STATUS = {
  pass: "bg-lime text-ink",
  below: "bg-coral text-ink",
  insufficient_sample: "bg-white/8 text-chalk/50",
} as const;

/**
 * Una de las tres puertas del piloto.
 *
 * Con muestra insuficiente el porcentaje se apaga y no se emite veredicto.
 * Con 7 canjes, un 28,6% no significa nada, y decidir con ese número es peor
 * que no tenerlo.
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
  const short = gate.verdict === "insufficient_sample";

  const verdictLabel =
    gate.verdict === "pass"
      ? t.passes
      : gate.verdict === "below"
        ? t.below
        : t.insufficient;

  const percent =
    gate.ratio === null ? "—" : `${Math.round(gate.ratio * 1000) / 10}%`;

  return (
    <article className="rounded-[var(--radius-card)] bg-ink p-6">
      <div className="flex items-start justify-between gap-3">
        <p className="eyebrow uppercase text-chalk/35">{gate.key}</p>
        <p
          className={cn(
            "eyebrow rounded-full px-2.5 py-1",
            STATUS[gate.verdict],
          )}
        >
          {verdictLabel}
        </p>
      </div>

      <p
        className={cn(
          "display-tight numeral mt-5 text-[2.75rem]",
          short ? "text-chalk/30" : "text-chalk",
        )}
      >
        {percent}
      </p>

      <p className="mt-2 text-[0.875rem] leading-snug text-chalk/60">{label}</p>

      <p className="numeral mt-4 text-[0.8125rem] text-chalk/35">
        {gate.numerator}/{gate.denominator} ·{" "}
        {fill(t.target, { n: Math.round(gate.threshold * 100) })}
        {short ? ` · ${fill(t.insufficientBody, { n: gate.minSample, m: gate.denominator })}` : ""}
      </p>
    </article>
  );
}
