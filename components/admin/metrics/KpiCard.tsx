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
    <div className="metrics-card flex flex-col justify-center gap-1.5 px-[18px] py-[17px]">
      <p className="truncate text-[0.8125rem] font-medium text-chalk/60">{label}</p>
      <p
        className={cn(
          "numeral truncate text-[30px] font-medium tracking-[-0.045em]",
          value === null ? "text-chalk/35" : alarm ? "text-coral" : "text-chalk",
        )}
      >
        {value ?? insufficientLabel}
      </p>
      <p className="numeral truncate text-[0.75rem] text-chalk/35">{formula}</p>
    </div>
  );
}
