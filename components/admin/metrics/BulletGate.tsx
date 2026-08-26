import { METRICS_LOSS } from "@/components/admin/metrics/palette";
import type { Gate } from "@/lib/attribution";
import { cn } from "@/lib/cn";
import { fill } from "@/lib/i18n";

/**
 * Las tres puertas, como bullet chart: barra de valor, marca vertical en el
 * objetivo, operandos y objetivo debajo. Mismo veredicto pass/below/muestra
 * insuficiente de siempre -"mantener las tres actuales"-, solo el dibujo
 * cambia de tarjeta de número grande a barra.
 */
export function BulletGate({
  gate,
  label,
  passesLabel,
  belowLabel,
  insufficientLabel,
  targetLabel,
  insufficientBodyLabel,
}: {
  gate: Gate;
  label: string;
  passesLabel: string;
  belowLabel: string;
  insufficientLabel: string;
  targetLabel: string;
  insufficientBodyLabel: string;
}) {
  const insufficient = gate.verdict === "insufficient_sample";
  const valuePct = gate.ratio !== null ? Math.min(gate.ratio * 100, 100) : 0;
  const targetPct = Math.min(gate.threshold * 100, 100);
  const barColor = insufficient
    ? "rgba(255,255,255,.18)"
    : gate.verdict === "pass"
      ? "var(--color-lime)"
      : METRICS_LOSS;

  return (
    <div className="metrics-card p-[18px]">
      <div className="flex items-center justify-between gap-3">
        <p className="eyebrow uppercase text-chalk/50">{gate.key}</p>
        <p
          className={cn(
            "eyebrow rounded-full px-2.5 py-1",
            insufficient
              ? "bg-white/8 text-chalk/50"
              : gate.verdict === "pass"
                ? "bg-lime/15 text-lime"
                : "bg-coral/15 text-coral",
          )}
        >
          {insufficient ? insufficientLabel : gate.verdict === "pass" ? passesLabel : belowLabel}
        </p>
      </div>

      <p className="mt-2 text-[0.875rem] text-chalk/60">{label}</p>

      <div className="relative mt-3 h-2.5 w-full overflow-hidden rounded-full bg-white/8">
        <div className="h-full rounded-full" style={{ width: `${valuePct}%`, background: barColor }} />
        <div className="absolute inset-y-0 w-px bg-white" style={{ left: `${targetPct}%` }} />
      </div>

      <p className="numeral mt-2.5 text-[0.75rem] text-chalk/40">
        {gate.numerator} ÷ {gate.denominator} · {fill(targetLabel, { n: Math.round(gate.threshold * 100) })}
        {insufficient
          ? ` · ${fill(insufficientBodyLabel, { n: gate.minSample, m: gate.denominator })}`
          : ""}
      </p>
    </div>
  );
}
