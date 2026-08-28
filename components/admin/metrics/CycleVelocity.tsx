/** Escala común fija -spec §7.4-: 30 días, no la ventana de retorno del
 * local -que puede ser mayor o menor según el negocio-, para que las cuatro
 * barras sean comparables entre sí sin que cambien de tamaño relativo cada
 * vez que alguien ajusta la ventana en la configuración. */
const SCALE_DAYS = 30;

/**
 * Cuatro barras sobre la misma escala de 0 a 30 días: la ventana de retorno
 * del local es la cuarta barra, en gris, de referencia -para leer las otras
 * tres contra ella-, pero ya no define la escala.
 */
export function CycleVelocity({
  steps,
  windowDays,
  windowLabel,
  formatDays,
}: {
  steps: { label: string; days: number | null; alarm?: boolean }[];
  windowDays: number;
  windowLabel: string;
  formatDays: (days: number) => string;
}) {
  const bars = [
    ...steps,
    { label: windowLabel, days: windowDays, isWindow: true as const },
  ];

  return (
    <div className="flex flex-col gap-4">
      {bars.map((bar) => {
        const pct = bar.days !== null ? Math.min((bar.days / SCALE_DAYS) * 100, 100) : 0;
        const isWindow = "isWindow" in bar && bar.isWindow;
        return (
          <div key={bar.label}>
            <div className="flex items-baseline justify-between gap-3">
              <span
                className={
                  "text-[0.875rem] font-medium " +
                  ("alarm" in bar && bar.alarm ? "text-amber" : isWindow ? "text-chalk/40" : "text-chalk/70")
                }
              >
                {bar.label}
              </span>
              <span className="numeral text-[0.875rem] text-chalk/50">
                {bar.days !== null ? formatDays(Math.round(bar.days)) : "—"}
              </span>
            </div>
            <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-white/8">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${pct}%`,
                  background: isWindow
                    ? "rgba(255,255,255,.25)"
                    : "alarm" in bar && bar.alarm
                      ? "var(--color-amber)"
                      : "var(--color-lime)",
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
