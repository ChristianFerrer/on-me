"use client";

import { useId, useMemo } from "react";
import type { DailyPoint } from "@/lib/funnel";

const VIEW_W = 300;
const VIEW_H = 72;
const PAD_Y = 8;

/**
 * Convierte los puntos en una curva suave (Catmull-Rom a Bézier) en vez de
 * unir con líneas rectas: una serie diaria de un piloto pequeño es a saltos,
 * y una curva la lee como tendencia en vez de como sierra.
 */
function wavePath(values: number[]): { line: string; area: string } {
  const max = Math.max(...values, 1);
  const stepX = VIEW_W / Math.max(values.length - 1, 1);
  const points = values.map((value, index) => ({
    x: index * stepX,
    y: VIEW_H - PAD_Y - (value / max) * (VIEW_H - PAD_Y * 2),
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

  const area = `${line} L${points[points.length - 1].x},${VIEW_H} L0,${VIEW_H} Z`;
  return { line, area };
}

export function WaveChart({
  label,
  description,
  points,
  accent = "var(--color-lime)",
}: {
  label: string;
  description?: string;
  points: DailyPoint[];
  accent?: string;
}) {
  const gradientId = useId();
  const values = points.map((point) => point.value);
  const total = values.reduce((sum, value) => sum + value, 0);
  const { line, area } = useMemo(() => wavePath(values), [values]);
  const last = points.at(-1);

  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[0.875rem] font-medium text-chalk/65">{label}</span>
        <span className="numeral text-[0.9375rem] font-semibold">{total}</span>
      </div>
      {description ? <p className="mt-0.5 text-[0.75rem] leading-snug text-chalk/60">{description}</p> : null}

      <svg
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        preserveAspectRatio="none"
        className="mt-2 h-16 w-full"
        role="img"
        aria-label={`${label}: ${total} en los últimos ${points.length} días`}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={accent} stopOpacity="0.35" />
            <stop offset="100%" stopColor={accent} stopOpacity="0" />
          </linearGradient>
        </defs>
        {area ? <path d={area} fill={`url(#${gradientId})`} /> : null}
        {line ? (
          <path
            d={line}
            fill="none"
            stroke={accent}
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
        ) : null}
        {last ? (
          <circle
            cx={VIEW_W}
            cy={
              VIEW_H -
              PAD_Y -
              (last.value / Math.max(...values, 1)) * (VIEW_H - PAD_Y * 2)
            }
            r="3"
            fill={accent}
          />
        ) : null}
      </svg>
    </div>
  );
}
