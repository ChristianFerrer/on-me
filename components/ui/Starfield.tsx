"use client";

import { useMemo } from "react";

/**
 * Mismo lenguaje que el cielo de /admin/constelacion-sol -ángulo dorado
 * para repartir los puntos sin amontonarse, radio y opacidad que varían
 * por punto en vez de una rejilla pareja-, pero un componente propio y
 * más chico: ese starfield vive mezclado en un archivo de 2000 líneas
 * pensado para el mapa de constelación -con su propio bamboleo,
 * titileo, banda de la Vía Láctea-, nada de eso hace falta para un
 * fondo quieto detrás de la tarjeta de /c. `fill="currentColor"` en vez
 * de `var(--color-on-surface)`: aquí el color lo decide quien use el
 * componente -vía `className`-, no un token fijo al tema global.
 */
const STAR_COUNT = 110;

function starfield(vb: number) {
  const stars: { x: number; y: number; r: number; o: number }[] = [];
  for (let i = 0; i < STAR_COUNT; i++) {
    const angle = (i * 2.399963) % (2 * Math.PI); // ángulo dorado
    const radius = (((i * 53) % 97) / 97) * vb;
    const r = 0.5 + (((i * 31) % 17) / 16) * 1.5;
    const o = 0.06 + (((i * 19) % 23) / 22) * 0.3;
    stars.push({ x: Math.cos(angle) * radius, y: Math.sin(angle) * radius, r, o });
  }
  return stars;
}

export function Starfield({ className }: { className?: string }) {
  const vb = 200;
  const stars = useMemo(() => starfield(vb), []);

  return (
    <svg
      aria-hidden="true"
      className={className}
      viewBox={`${-vb} ${-vb} ${vb * 2} ${vb * 2}`}
      preserveAspectRatio="xMidYMid slice"
    >
      {stars.map((star, i) => (
        <circle key={i} cx={star.x.toFixed(2)} cy={star.y.toFixed(2)} r={star.r.toFixed(2)} fill="currentColor" fillOpacity={star.o.toFixed(2)} />
      ))}
    </svg>
  );
}
