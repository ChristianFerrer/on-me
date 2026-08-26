/**
 * Cuatro barras sobre la misma escala -la ventana de retorno del local-: la
 * ventana en sí es la cuarta barra, en gris, para que las otras tres se
 * lean contra su tamaño real, no contra un máximo arbitrario.
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
        const pct = bar.days !== null ? Math.min((bar.days / windowDays) * 100, 100) : 0;
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
