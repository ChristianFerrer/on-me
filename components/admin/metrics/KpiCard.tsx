import { cn } from "@/lib/cn";

/**
 * Número + fórmula visible, la unidad básica de esta página: el dueño tiene
 * que poder verificar cualquier cifra sin preguntar, así que la fórmula con
 * los operandos reales viaja siempre pegada al número, nunca en un tooltip.
 */
export function KpiCard({
  label,
  value,
  formula,
  insufficientLabel,
  alarm,
}: {
  label: string;
  /** null = muestra insuficiente. */
  value: string | null;
  formula: string;
  insufficientLabel: string;
  alarm?: boolean;
}) {
  return (
    <div className="metrics-card p-[18px]">
      <p className="text-[0.8125rem] font-medium text-chalk/60">{label}</p>
      <p
        className={cn(
          "numeral mt-2 text-[1.625rem] font-semibold",
          value === null ? "text-chalk/35" : alarm ? "text-coral" : "text-chalk",
        )}
      >
        {value ?? insufficientLabel}
      </p>
      <p className="numeral mt-1.5 text-[0.75rem] text-chalk/35">{formula}</p>
    </div>
  );
}
