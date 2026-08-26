/**
 * Cuatro comparativas pareadas invitado/directo con su multiplicador: lima
 * si favorece al invitado, coral si no. Nunca se oculta un resultado
 * desfavorable -que el invitado complete menos tarjetas es información,
 * no un fallo que disimular-.
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
      {rows.map((row) => (
        <li
          key={row.label}
          className="metrics-card flex flex-col gap-3 p-[18px] sm:flex-row sm:items-center sm:gap-5"
        >
          <p className="min-w-0 text-[0.875rem] font-medium text-chalk/70 sm:flex-1">{row.label}</p>
          <div className="flex items-center gap-5">
            <div className="shrink-0 text-right">
              <p className="eyebrow text-chalk/35">{invitedLabel}</p>
              <p className="numeral mt-1 text-[1.125rem] font-semibold">
                {row.invited !== null ? row.format(row.invited) : insufficientLabel}
              </p>
            </div>
            <div className="shrink-0 text-right">
              <p className="eyebrow text-chalk/35">{directLabel}</p>
              <p className="numeral mt-1 text-[1.125rem] font-semibold">
                {row.direct !== null ? row.format(row.direct) : insufficientLabel}
              </p>
            </div>
            {row.multiplier !== null ? (
              <p
                className={
                  "numeral shrink-0 text-[1.0625rem] font-bold " +
                  (row.multiplier >= 1 ? "text-lime" : "text-coral")
                }
              >
                ×{row.multiplier.toFixed(1)}
              </p>
            ) : null}
          </div>
        </li>
      ))}
    </ul>
  );
}
