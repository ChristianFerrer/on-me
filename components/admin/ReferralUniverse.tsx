"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowLeftIcon, CompassIcon } from "@/components/ui/Icons";
import type { Dict } from "@/lib/i18n";
import { type Pan, panBy, pixelsToUnits, zoomAtPoint } from "@/lib/panZoom";
import { layoutRadialTree } from "@/lib/radialLayout";
import type { ReferralNode } from "@/lib/referralTree";

const LABEL_PAD = 90;
/** Aire de sobra alrededor del árbol, para que haya sitio a donde explorar. */
const PAN_ROOM = 260;
const RING_WIDTH = 138;
const MIN_SCALE = 0.5;
const MAX_SCALE = 3.5;

type PointerState = { x: number; y: number };

/**
 * El mapa de saltos a pantalla completa: arrastrable y con zoom, como un
 * universo que se explora en vez de una tarjeta que se lee de un vistazo.
 *
 * El viewBox del SVG nunca cambia —es un cuadrado fijo alrededor del local—
 * así que la conversión de píxel de pantalla a unidad del mapa es constante
 * (`k`, más abajo) y no depende del zoom actual: eso es lo que hace simple
 * arrastrar y hacer zoom con el punto exacto bajo el dedo o el cursor.
 */
export function ReferralUniverse({
  roots,
  shopName,
  t,
}: {
  roots: ReferralNode[];
  shopName: string;
  t: Dict;
}) {
  const { nodes, edges, extent, maxDepth } = layoutRadialTree(roots);
  const half = extent + LABEL_PAD + PAN_ROOM;
  const size = half * 2;
  const shop = nodes[0];

  const svgRef = useRef<SVGSVGElement>(null);
  const [pan, setPan] = useState<Pan>({ x: 0, y: 0, scale: 1 });

  const pointers = useRef(new Map<number, PointerState>());
  const dragOrigin = useRef<{ pan: Pan; mid: PointerState; dist: number } | null>(null);

  /** Un punto de pantalla a unidades del mapa. Constante: no depende de pan/zoom. */
  function viewPoint(clientX: number, clientY: number) {
    const rect = svgRef.current!.getBoundingClientRect();
    const base = Math.min(rect.width, rect.height);
    return {
      x: pixelsToUnits(clientX - rect.left - rect.width / 2, base, size),
      y: pixelsToUnits(clientY - rect.top - rect.height / 2, base, size),
    };
  }

  function deltaToView(dx: number, dy: number) {
    const rect = svgRef.current!.getBoundingClientRect();
    const base = Math.min(rect.width, rect.height);
    return { x: pixelsToUnits(dx, base, size), y: pixelsToUnits(dy, base, size) };
  }

  function onPointerDown(event: React.PointerEvent<SVGSVGElement>) {
    event.currentTarget.setPointerCapture(event.pointerId);
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });

    if (pointers.current.size === 1) {
      dragOrigin.current = { pan, mid: { x: event.clientX, y: event.clientY }, dist: 0 };
    } else if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      dragOrigin.current = {
        pan,
        mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
        dist: Math.hypot(a.x - b.x, a.y - b.y),
      };
    }
  }

  function onPointerMove(event: React.PointerEvent<SVGSVGElement>) {
    if (!pointers.current.has(event.pointerId) || !svgRef.current) return;
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (!dragOrigin.current) return;

    if (pointers.current.size === 1) {
      const { pan: startPan, mid } = dragOrigin.current;
      const delta = deltaToView(event.clientX - mid.x, event.clientY - mid.y);
      setPan(panBy(startPan, delta.x, delta.y));
      return;
    }

    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      const { pan: startPan, mid: startMid, dist: startDist } = dragOrigin.current;

      // Escala respecto al centro donde empezó el pellizco, y luego se
      // desplaza lo que se hayan movido los dedos juntos: dos gestos en uno.
      const pivot = viewPoint(startMid.x, startMid.y);
      const zoomed = zoomAtPoint(
        startPan,
        pivot.x,
        pivot.y,
        dist / Math.max(startDist, 1),
        MIN_SCALE,
        MAX_SCALE,
      );
      const delta = deltaToView(mid.x - startMid.x, mid.y - startMid.y);
      setPan(panBy(zoomed, delta.x, delta.y));
    }
  }

  function endPointer(event: React.PointerEvent<SVGSVGElement>) {
    pointers.current.delete(event.pointerId);
    if (pointers.current.size === 0) dragOrigin.current = null;
    else if (pointers.current.size === 1) {
      const [only] = [...pointers.current.entries()];
      dragOrigin.current = { pan, mid: { x: only[1].x, y: only[1].y }, dist: 0 };
    }
  }

  // React registra los listeners de wheel como pasivos: preventDefault() ahí
  // no evita el scroll/zoom nativo de la página. Hace falta un listener
  // nativo con { passive: false } para poder interceptar el gesto de verdad.
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;

    function onWheel(event: WheelEvent) {
      event.preventDefault();
      const factor = Math.exp(-event.deltaY * 0.0015);
      const point = viewPoint(event.clientX, event.clientY);
      setPan((prev) => zoomAtPoint(prev, point.x, point.y, factor, MIN_SCALE, MAX_SCALE));
    }

    svg.addEventListener("wheel", onWheel, { passive: false });
    return () => svg.removeEventListener("wheel", onWheel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function resetView() {
    setPan({ x: 0, y: 0, scale: 1 });
  }

  return (
    <div className="fixed inset-0 aurora-night text-chalk">
      <svg
        ref={svgRef}
        viewBox={`${-half} ${-half} ${size} ${size}`}
        className="h-dvh w-full touch-none select-none"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endPointer}
        onPointerCancel={endPointer}
        onPointerLeave={endPointer}
        onDoubleClick={resetView}
        role="img"
        aria-label={t.admin.referralMap}
      >
        <style>{`
          @keyframes rm-pulse {
            0% { r: ${shop.radius}px; opacity: 0.5; }
            100% { r: ${shop.radius + extent * 0.6}px; opacity: 0; }
          }
          @keyframes rm-flow { to { stroke-dashoffset: -24; } }
          @keyframes rm-breathe { 0%, 100% { opacity: 1; } 50% { opacity: 0.45; } }
          .rm-pulse { animation: rm-pulse 3.6s cubic-bezier(0.2, 0.6, 0.4, 1) infinite; }
          .rm-edge { stroke-dasharray: 3 9; animation: rm-flow 2.4s linear infinite; }
          .rm-ring { animation: rm-breathe 6s ease-in-out infinite; }
        `}</style>

        <g transform={`translate(${pan.x} ${pan.y}) scale(${pan.scale})`}>
          {Array.from({ length: maxDepth }, (_, index) => {
            const depth = index + 1;
            return (
              <circle
                key={depth}
                className="rm-ring"
                cx={0}
                cy={0}
                r={depth * RING_WIDTH}
                fill="none"
                stroke={depth % 2 === 1 ? "rgba(245,247,245,0.035)" : "rgba(245,247,245,0.06)"}
                strokeWidth={RING_WIDTH}
                style={{ animationDelay: `${depth * 0.5}s` }}
              />
            );
          })}

          <circle className="rm-pulse" cx={0} cy={0} fill="none" stroke="var(--color-lime)" strokeWidth="2" />
          <circle
            className="rm-pulse"
            cx={0}
            cy={0}
            fill="none"
            stroke="var(--color-lime)"
            strokeWidth="2"
            style={{ animationDelay: "1.8s" }}
          />

          {edges.map((edge, index) => (
            <path
              key={index}
              className="rm-edge"
              d={`M${edge.x0},${edge.y0} C${edge.cx1},${edge.cy1} ${edge.cx2},${edge.cy2} ${edge.x1},${edge.y1}`}
              fill="none"
              stroke={edge.billable ? "var(--color-lime)" : "rgba(245,247,245,0.22)"}
              strokeWidth="1.75"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
          ))}

          {nodes.map((node) => {
            const isShop = node.id === "shop";
            const label = isShop ? shopName : node.name;
            const filled = isShop || node.billable;
            const textColor = filled ? "var(--color-ink)" : "var(--color-chalk)";

            return (
              <g key={node.id}>
                <circle
                  cx={node.x}
                  cy={node.y}
                  r={node.radius}
                  fill={filled ? "var(--color-lime)" : "var(--color-ink-2)"}
                  stroke={filled ? "none" : "rgba(245,247,245,0.25)"}
                  strokeWidth={filled ? 0 : 1.25}
                />
                <text
                  x={node.x}
                  y={node.y}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontSize={isShop ? 14 : 11}
                  fontWeight={isShop ? 700 : 600}
                  fill={textColor}
                >
                  {label}
                </text>
                {node.descendants > 0 ? (
                  <text
                    x={node.x}
                    y={node.y + node.radius + 15}
                    textAnchor="middle"
                    fontSize="10"
                    fontWeight="600"
                    fill="rgba(245,247,245,0.45)"
                  >
                    {node.descendants}
                  </text>
                ) : null}
              </g>
            );
          })}
        </g>
      </svg>

      <header className="pointer-events-none fixed inset-x-0 top-0 flex items-start justify-between gap-3 px-5 pt-[max(1rem,env(safe-area-inset-top))]">
        <Link
          href="/admin/atribuciones"
          prefetch={false}
          className="btn glass-dark pointer-events-auto gap-1.5 px-4 py-2.5 text-[0.875rem] text-chalk"
        >
          <ArrowLeftIcon className="size-4" />
          {t.common.back}
        </Link>
        <button
          type="button"
          onClick={resetView}
          aria-label={t.admin.resetView}
          className="btn glass-dark pointer-events-auto size-11 text-chalk"
        >
          <CompassIcon className="size-5" />
        </button>
      </header>

      <footer className="pointer-events-none fixed inset-x-0 bottom-0 flex flex-col items-center gap-3 px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] text-center">
        <p className="text-[0.75rem] text-chalk/40">{t.admin.referralMapHint}</p>
        <div className="glass-dark flex items-center gap-5 rounded-full px-5 py-2.5 text-[0.75rem] text-chalk/60">
          <span className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-lime" />
            {t.admin.attrBillable}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-ink-2 ring-1 ring-inset ring-chalk/25" />
            {t.admin.referralMapPending}
          </span>
        </div>
      </footer>
    </div>
  );
}
