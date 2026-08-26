/**
 * Semana de alta × semanas transcurridas, celda = % que sigue sellando.
 * Fondo lima con alpha proporcional. Celdas futuras -la cohorte todavía no
 * ha llegado a esa semana- en gris con guion, nunca 0%: no ha pasado
 * suficiente tiempo para saberlo, no es que nadie volviera.
 */
export function CohortGrid({
  cohorts,
  directLabel,
  invitedLabel,
  weekLabel,
  futureLabel,
}: {
  cohorts: {
    cohortStart: string;
    kind: "direct" | "invited";
    cohortSize: number;
    cellsPct: (number | null)[];
  }[];
  directLabel: string;
  invitedLabel: string;
  weekLabel: (n: number) => string;
  futureLabel: string;
}) {
  if (!cohorts.length) return null;
  const weeks = cohorts[0].cellsPct.length;

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[36rem] text-left text-[0.8125rem]">
        <thead>
          <tr className="text-chalk/40">
            <th className="px-2 py-2 font-medium" />
            {Array.from({ length: weeks }, (_, week) => (
              <th key={week} className="numeral px-1.5 py-2 text-center font-medium">
                {weekLabel(week)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {cohorts.map((row) => (
            <tr key={`${row.cohortStart}|${row.kind}`} className="border-t border-white/8">
              <td className="numeral whitespace-nowrap px-2 py-2 text-chalk/60">
                {row.cohortStart} · {row.kind === "direct" ? directLabel : invitedLabel} ({row.cohortSize})
              </td>
              {row.cellsPct.map((pct, week) => (
                <td key={week} className="px-1.5 py-2 text-center">
                  {pct === null ? (
                    <span className="text-chalk/25">{futureLabel}</span>
                  ) : (
                    <span
                      className="numeral inline-flex size-8 items-center justify-center rounded-md text-[0.75rem] font-semibold"
                      style={{
                        background: `rgba(214,243,76,${Math.max(pct, 4) / 100})`,
                        color: pct > 50 ? "#0e1211" : "var(--color-chalk)",
                      }}
                    >
                      {Math.round(pct)}
                    </span>
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
