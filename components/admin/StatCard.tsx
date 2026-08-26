"use client";

import { useId, useMemo } from "react";
import type { DailyPoint } from "@/lib/funnel";
import { wavePath } from "@/lib/sparkline";

const VIEW_W = 160;
const VIEW_H = 40;
const PAD_Y = 4;

/**
 * Una métrica del embudo, en tarjeta: número grande arriba, su propia
 * mini-gráfica de 14 días debajo -en vez de una fila más en una lista larga-,
 * para aprovechar el ancho que sobra en escritorio. Solo escritorio: en
 * móvil la lista de FunnelBars sigue siendo más legible que una cuadrícula
 * de tarjetas pequeñas.
 */
export function StatCard({
  label,
  value,
  points,
  accent = "var(--color-lime)",
}: {
  label: string;
  value: number;
  /** Sin serie -p.ej. tarjetas completadas, que no tiene un registro diario- la tarjeta se queda solo con el número. */
  points?: DailyPoint[];
  accent?: string;
}) {
  const gradientId = useId();
  const { line, area } = useMemo(() => {
    const values = points?.map((point) => point.value) ?? [];
    return values.length
      ? wavePath(values, { width: VIEW_W, height: VIEW_H, padY: PAD_Y })
      : { line: "", area: "" };
  }, [points]);

  return (
    <div className="glass-dark p-5">
      <p className="text-[0.8125rem] font-medium text-chalk/60">{label}</p>
      <p className="numeral mt-2 text-[1.625rem] font-semibold">{value}</p>

      {points ? (
        <svg
          viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
          preserveAspectRatio="none"
          className="mt-3 h-9 w-full"
          role="img"
          aria-label={`${label}: tendencia de los últimos ${points.length} días`}
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
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
          ) : null}
        </svg>
      ) : null}
    </div>
  );
}
