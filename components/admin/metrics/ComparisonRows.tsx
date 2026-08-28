import { cn } from "@/lib/cn";

/**
 * Cuatro comparativas pareadas invitado/directo con su multiplicador: lima
 * si favorece al invitado, coral si no. Nunca se oculta un resultado
 * desfavorable -que el invitado complete menos tarjetas es información,
 * no un fallo que disimular-.
 *
 * Barras pareadas -spec §7.3-, no dos números sueltos alineados a la
 * derecha: cada fila tiene su propia escala local (máximo entre invitado y
 * directo), porque las cuatro comparativas usan unidades distintas -%,
 * sellos, días- y no tendría sentido compararlas contra un máximo global.
 */
export function ComparisonRows({
  rows,
  invitedLabel,
  directLabel,
  insufficientLabel,
}: {
  rows: {
    label: string;
    invited: number | null;
    direct: number | null;
    multiplier: number | null;
    format: (value: number) => string;
  }[];
  invitedLabel: string;
  directLabel: string;
  insufficientLabel: string;
}) {
  return (
    <ul className="flex flex-col gap-3">
      {rows.map((row) => {
        const localMax = Math.max(row.invited ?? 0, row.direct ?? 0, 1);
        const bars = [
          { key: "invited", label: invitedLabel, value: row.invited, color: "var(--color-lime)" },
          { key: "direct", label: directLabel, value: row.direct, color: "rgba(255,255,255,0.35)" },
        ];

        return (
          <li key={row.label} className="metrics-card flex flex-col gap-2.5 p-[18px]">
            <div className="flex items-baseline justify-between gap-3">
              <p className="min-w-0 text-[0.875rem] font-medium text-chalk/70">{row.label}</p>
              {row.multiplier !== null ? (
                <p
                  className={cn(
                    "numeral shrink-0 text-[0.9375rem] font-bold",
                    row.multiplier >= 1 ? "text-lime" : "text-coral",
                  )}
                >
                  ×{row.multiplier.toFixed(1)}
                </p>
              ) : null}
            </div>
            <div className="flex flex-col gap-1.5">
              {bars.map((bar) => (
                <div key={bar.key} className="flex items-center gap-2.5">
                  <span className="eyebrow w-14 shrink-0 truncate text-chalk/35">{bar.label}</span>
                  <div className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-white/8">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${bar.value !== null ? Math.max((bar.value / localMax) * 100, bar.value > 0 ? 2 : 0) : 0}%`,
                        background: bar.color,
                      }}
                    />
                  </div>
                  <span className="numeral shrink-0 whitespace-nowrap text-right text-[0.8125rem] font-semibold">
                    {bar.value !== null ? row.format(bar.value) : insufficientLabel}
                  </span>
                </div>
              ))}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
