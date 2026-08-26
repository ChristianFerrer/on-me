/**
 * Curva suave (Catmull-Rom a Bézier) para las gráficas de línea del panel,
 * grandes o pequeñas: una serie diaria de un piloto pequeño es a saltos, y
 * una curva la lee como tendencia en vez de como sierra.
 */
export function wavePath(
  values: number[],
  { width, height, padY }: { width: number; height: number; padY: number },
): { line: string; area: string } {
  const max = Math.max(...values, 1);
  const stepX = width / Math.max(values.length - 1, 1);
  const points = values.map((value, index) => ({
    x: index * stepX,
    y: height - padY - (value / max) * (height - padY * 2),
  }));

  if (points.length < 2) {
    const [only] = points;
    return { line: only ? `M${only.x},${only.y}` : "", area: "" };
  }

  let line = `M${points[0].x},${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] ?? points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] ?? p2;
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    line += ` C${c1x},${c1y} ${c2x},${c2y} ${p2.x},${p2.y}`;
  }

  const area = `${line} L${points[points.length - 1].x},${height} L0,${height} Z`;
  return { line, area };
}
