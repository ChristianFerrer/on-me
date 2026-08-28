/**
 * Distribución de sellos por hora del día -no una tendencia en el tiempo,
 * spec §0.2 prohíbe las líneas de tendencia-. Sin título propio: vive en su
 * propia celda de la rejilla, bajo un MetricsSectionHeader que ya dice de
 * qué trata -antes lo repetía aquí dentro también-.
 */
export function BarHistogram({ hourHistogram }: { hourHistogram: number[] }) {
  const max = Math.max(...hourHistogram, 1);

  return (
    <div>
      <div className="flex h-20 items-end gap-[2px]">
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
