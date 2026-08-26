"use client";

import { useId, useMemo } from "react";
import type { DailyPoint } from "@/lib/funnel";
import { wavePath } from "@/lib/sparkline";

const VIEW_W = 300;
const VIEW_H = 72;
const PAD_Y = 8;

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
  const { line, area } = useMemo(
    () => wavePath(values, { width: VIEW_W, height: VIEW_H, padY: PAD_Y }),
    [values],
  );
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
