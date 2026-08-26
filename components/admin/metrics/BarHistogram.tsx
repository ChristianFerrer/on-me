/** Distribución de sellos por hora del día -no una tendencia en el tiempo, spec §0.2 prohíbe las líneas de tendencia-. */
export function BarHistogram({ hourHistogram, label }: { hourHistogram: number[]; label: string }) {
  const max = Math.max(...hourHistogram, 1);

  return (
    <div>
      <p className="eyebrow text-chalk/40">{label}</p>
      <div className="mt-3 flex h-20 items-end gap-[2px]">
        {hourHistogram.map((count, hour) => (
          <div
            key={hour}
            title={`${hour}:00 · ${count}`}
            className="flex-1 rounded-t-sm bg-lime/70"
            style={{ height: `${Math.max((count / max) * 100, count > 0 ? 4 : 1)}%` }}
          />
        ))}
      </div>
    </div>
  );
}
