"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeftIcon, CompassIcon } from "@/components/ui/Icons";
import { SelectionSheet } from "@/components/universe/SelectionSheet";
import { cn } from "@/lib/cn";
import { bestPadrinoId, isExpiringSoon } from "@/lib/giftGraph/insights";
import { type Pan, panBy, pixelsToUnits, zoomAtPoint } from "@/lib/panZoom";
import { ESTABLISHMENT_RADIUS, layoutSaltos, type SaltosLayout } from "@/lib/giftGraph/saltosLayout";
import { STATE_BADGE_SKIN, STATE_LINE_COLOR, stateBadgeLabel } from "@/lib/giftGraph/stateBadge";
import { isTap, type PointerPoint } from "@/lib/giftGraph/tapGesture";
import type { GiftGraph, NodeState } from "@/lib/giftGraph/types";
import type { Dict, Locale } from "@/lib/i18n";

/** Zoom manual sobre el encuadre automático (pellizco, rueda): 1 = el encuadre tal cual. */
const MIN_SCALE = 0.6;
const MAX_SCALE = 4;
/** Por debajo de esto los nombres no se enseñan -evita el solapamiento con muchos nodos juntos. */
const LABEL_VISIBLE_SCALE = 1.45;
/** El arco del embudo siempre a este múltiplo del nodo más lejano: nunca más lejos. */
const ARC_RADIUS_FACTOR = 1.18;
/** Aire para el número de cada tramo del arco, más allá del propio arco. */
const ARC_LABEL_PAD = 20;
/** Cuánto del viewport (dimensión menor) ocupa el contenido al encuadrar. */
const FIT_FRACTION = 0.88;

/** Orden narrativo del arco perimetral: el camino feliz primero, las dos salidas negativas al final. */
const FUNNEL_ORDER: NodeState[] = ["sent", "opened", "window", "billable", "expired", "discarded"];

type PointerState = { x: number; y: number };
type XY = { x: number; y: number };

function nodeXY(point: { angle: number; ringRadius: number; depth: number }): XY {
  if (point.depth === 0) return { x: 0, y: 0 };
  return { x: point.ringRadius * Math.cos(point.angle), y: point.ringRadius * Math.sin(point.angle) };
}

/**
 * Curva Bézier cúbica: los puntos de control van al radio medio entre el
 * anillo del padre y el del hijo, cada uno en su propio ángulo -el mismo
 * truco que ya usaba lib/radialLayout.ts- para que la rama gire suave hacia
 * su hijo en vez de salir en línea recta desde el centro. Estática: se
 * calcula una vez por render a partir del layout, no en un bucle de animación.
 */
function linkPath(layout: SaltosLayout, positions: Map<string, XY>, fromId: string, toId: string): string | null {
  const from = layout.points.get(fromId);
  const to = layout.points.get(toId);
  const p0 = positions.get(fromId);
  const p1 = positions.get(toId);
  if (!from || !to || !p0 || !p1) return null;

  const midR = (from.ringRadius + to.ringRadius) / 2;
  // Desde el propio centro (radio 0) el ángulo del padre no significa nada:
  // el primer tramo sale recto, y ya curva a partir del segundo.
  const a0 = from.depth === 0 ? to.angle : from.angle;
  const a1 = to.angle;
  const c1 = { x: midR * Math.cos(a0), y: midR * Math.sin(a0) };
  const c2 = { x: midR * Math.cos(a1), y: midR * Math.sin(a1) };
  return `M${p0.x.toFixed(2)},${p0.y.toFixed(2)} C${c1.x.toFixed(2)},${c1.y.toFixed(2)} ${c2.x.toFixed(2)},${c2.y.toFixed(2)} ${p1.x.toFixed(2)},${p1.y.toFixed(2)}`;
}

function arcPath(a0: number, a1: number, r: number): string {
  const x0 = Math.cos(a0) * r,
    y0 = Math.sin(a0) * r,
    x1 = Math.cos(a1) * r,
    y1 = Math.sin(a1) * r;
  const largeArc = a1 - a0 > Math.PI ? 1 : 0;
  return `M${x0.toFixed(2)},${y0.toFixed(2)} A${r.toFixed(2)},${r.toFixed(2)} 0 ${largeArc} 1 ${x1.toFixed(2)},${y1.toFixed(2)}`;
}

function CountUpStat({ value, label, active }: { value: number; label: string; active: boolean }) {
  const [shown, setShown] = useState(0);

  useEffect(() => {
    if (!active) return; // sin animar: el render de abajo usa `value` directamente
    let raf = 0;
    const start = performance.now();
    const DURATION_MS = 800;
    function tick(now: number) {
      const t = Math.min(1, (now - start) / DURATION_MS);
      setShown(Math.round(value * (1 - (1 - t) ** 3)));
      if (t < 1) raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, active]);

  return (
    <div className="flex items-baseline justify-end gap-1.5">
      <span className="numeral text-[1.0625rem] font-medium tracking-tight">{active ? shown : value}</span>
      <span className="text-[0.5625rem] lowercase text-chalk/40">{label}</span>
    </div>
  );
}

/**
 * El mapa de saltos de verdad: constelación radial sobre el grafo real de
 * invitaciones/atribuciones, con los mismos tokens de diseño del resto del
 * panel. Posiciones y curvas se calculan una vez por render, directamente en
 * JSX -nada de refs ni de un bucle de animación de fondo-: el encuadre y las
 * líneas tienen que ser correctos ya en el primer pintado, sin depender de
 * que un efecto llegue a ejecutarse.
 */
export function SaltosMap({ graph, shopName, locale, t }: { graph: GiftGraph; shopName: string; locale: Locale; t: Dict }) {
  const layout = useMemo(() => layoutSaltos(graph.nodes, graph.edges, graph.establishment.id), [graph]);
  const byId = useMemo(() => new Map(graph.nodes.map((n) => [n.id, n])), [graph.nodes]);
  const parentOf = useMemo(() => new Map(graph.edges.map((e) => [e.to, e.from])), [graph.edges]);
  const bestPadrino = useMemo(() => bestPadrinoId(graph.nodes, graph.edges), [graph.nodes, graph.edges]);

  const positions = useMemo(() => {
    const map = new Map<string, XY>();
    for (const point of layout.points.values()) map.set(point.id, nodeXY(point));
    return map;
  }, [layout]);

  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    // Diferido a un microtask, no una llamada síncrona dentro del propio
    // efecto: evita el aviso de "cascading renders" del linter.
    queueMicrotask(() => setMounted(true));
  }, []);

  const [nowMs] = useState(() => Date.now());
  const expiringIds = useMemo(
    () => new Set(graph.nodes.filter((n) => isExpiringSoon(n.expiresAt, nowMs)).map((n) => n.id)),
    [graph.nodes, nowMs],
  );

  const hud = useMemo(() => {
    const realInvites = graph.edges.filter((e) => e.from !== graph.establishment.id);
    return {
      invites: realInvites.length,
      opened: graph.nodes.filter((n) => n.state === "opened").length,
      redeemed: graph.nodes.filter((n) => n.redeemedAt != null).length,
      billable: graph.nodes.filter((n) => n.state === "billable").length,
      maxHops: layout.maxDepth,
    };
  }, [graph, layout.maxDepth]);

  const funnelCounts = useMemo(() => {
    const counts = new Map(FUNNEL_ORDER.map((s) => [s, 0]));
    for (const n of graph.nodes) counts.set(n.state, (counts.get(n.state) ?? 0) + 1);
    return counts;
  }, [graph.nodes]);
  const funnelTotal = useMemo(() => [...funnelCounts.values()].reduce((a, b) => a + b, 0), [funnelCounts]);

  const customerCount = useMemo(() => graph.nodes.filter((n) => n.claimed).length, [graph.nodes]);

  // Encuadre automático: el radio del contenido -arco incluido, el elemento
  // más lejano de todos- ocupa el 88% de la dimensión menor del viewport.
  // Un viewBox cuadrado con "xMidYMid meet" ya reparte eso solo en cualquier
  // proporción de pantalla, así que no hace falta recalcular en el resize:
  // es una propiedad de cómo SVG escala un viewBox, no algo que dependa de
  // los píxeles reales del contenedor.
  const arcRadius = layout.maxNodeReach * ARC_RADIUS_FACTOR;
  const contentRadius = funnelTotal > 0 ? arcRadius + ARC_LABEL_PAD : layout.maxNodeReach + 24;
  const half = contentRadius / FIT_FRACTION;
  const size = half * 2;

  const [pan, setPan] = useState<Pan>({ x: 0, y: 0, scale: 1 });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [legendOpen, setLegendOpen] = useState(true);

  const ancestors = useMemo(() => {
    const set = new Set<string>();
    let cur = selectedId;
    let guard = 0;
    while (cur && guard++ < 64) {
      set.add(cur);
      cur = parentOf.get(cur) ?? null;
    }
    return set;
  }, [selectedId, parentOf]);

  const selectedNode = selectedId ? (byId.get(selectedId) ?? null) : null;
  const giftedByName = useMemo(() => {
    if (!selectedNode) return "";
    const parentId = parentOf.get(selectedNode.id);
    if (!parentId) return "";
    if (parentId === graph.establishment.id) return graph.establishment.name;
    return byId.get(parentId)?.name ?? "";
  }, [selectedNode, parentOf, byId, graph.establishment]);

  const svgRef = useRef<SVGSVGElement>(null);
  const pointers = useRef(new Map<number, PointerState>());
  const dragOrigin = useRef<{ pan: Pan; mid: PointerState; dist: number } | null>(null);
  const tapCandidate = useRef<{ pointerId: number; nodeId: string | null; down: PointerPoint } | null>(null);

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
      const targetEl = event.target as Element;
      const nodeEl = targetEl.closest?.("[data-node-id]");
      tapCandidate.current = {
        pointerId: event.pointerId,
        nodeId: nodeEl?.getAttribute("data-node-id") ?? null,
        down: { x: event.clientX, y: event.clientY, t: Date.now() },
      };
    } else if (pointers.current.size === 2) {
      tapCandidate.current = null;
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

      const pivot = viewPoint(startMid.x, startMid.y);
      const zoomed = zoomAtPoint(startPan, pivot.x, pivot.y, dist / Math.max(startDist, 1), MIN_SCALE, MAX_SCALE);
      const delta = deltaToView(mid.x - startMid.x, mid.y - startMid.y);
      setPan(panBy(zoomed, delta.x, delta.y));
    }
  }

  function endPointer(event: React.PointerEvent<SVGSVGElement>) {
    const pending = tapCandidate.current;
    pointers.current.delete(event.pointerId);

    if (pointers.current.size === 0) {
      dragOrigin.current = null;
      if (pending && pending.pointerId === event.pointerId) {
        const up: PointerPoint = { x: event.clientX, y: event.clientY, t: Date.now() };
        if (isTap(pending.down, up)) {
          if (pending.nodeId && pending.nodeId !== graph.establishment.id) setSelectedId(pending.nodeId);
          else if (!pending.nodeId) setSelectedId(null);
        }
      }
      tapCandidate.current = null;
    } else if (pointers.current.size === 1) {
      const [only] = [...pointers.current.entries()];
      dragOrigin.current = { pan, mid: { x: only[1].x, y: only[1].y }, dist: 0 };
    }
  }

  // React registra los listeners de wheel como pasivos: preventDefault() ahí no evita
  // el scroll nativo. Hace falta un listener nativo con { passive: false }.
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
    setSelectedId(null);
  }

  return (
    <div className="fixed inset-0 aurora-night text-chalk">
      <style>{`
        @keyframes saltos-hub-pulse { 0% { transform: scale(1); opacity: 0.5; } 100% { transform: scale(2.4); opacity: 0; } }
        @keyframes saltos-flow { to { stroke-dashoffset: -24; } }
        @keyframes saltos-alert-pulse { 0%, 100% { transform: scale(1); opacity: 0.2; } 50% { transform: scale(1.35); opacity: 0.7; } }
        .saltos-hub-pulse { transform-origin: center; transform-box: fill-box; animation: saltos-hub-pulse 3.6s cubic-bezier(0.2,0.6,0.4,1) infinite; }
        .saltos-dashed { stroke-dasharray: 3 3; animation: saltos-flow 3.4s linear infinite; }
        .saltos-alert-ring { transform-origin: center; transform-box: fill-box; animation: saltos-alert-pulse 1.9s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) {
          .saltos-hub-pulse, .saltos-dashed, .saltos-alert-ring { animation: none; }
        }
      `}</style>

      <svg
        ref={svgRef}
        viewBox={`${-half} ${-half} ${size} ${size}`}
        preserveAspectRatio="xMidYMid meet"
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
        <defs>
          <radialGradient id="saltos-hub-glow">
            <stop offset="0%" stopColor="var(--color-lime)" stopOpacity={0.5} />
            <stop offset="55%" stopColor="var(--color-lime)" stopOpacity={0.1} />
            <stop offset="100%" stopColor="var(--color-lime)" stopOpacity={0} />
          </radialGradient>
          <filter id="saltos-soft" x="-70%" y="-70%" width="240%" height="240%">
            <feGaussianBlur stdDeviation="3" />
          </filter>
        </defs>

        <g transform={`translate(${pan.x} ${pan.y}) scale(${pan.scale})`}>
          {Array.from(layout.ringRadiusByDepth.entries()).map(([depth, r]) => (
            <circle key={depth} cx={0} cy={0} r={r} fill="none" stroke="rgba(255,255,255,.07)" strokeDasharray="1 7" strokeLinecap="round" />
          ))}

          {funnelTotal > 0
            ? (() => {
                const GAP = 0.045;
                let cursor = -Math.PI / 2 + 0.06;
                const arcs: React.ReactNode[] = [];
                for (const state of FUNNEL_ORDER) {
                  const count = funnelCounts.get(state) ?? 0;
                  if (count === 0) continue;
                  const span = ((Math.PI * 2 - 0.3) * count) / funnelTotal;
                  const a1 = cursor + span - GAP;
                  const mid = (cursor + a1) / 2;
                  const labelR = arcRadius + 11;
                  arcs.push(
                    <path
                      key={state}
                      d={arcPath(cursor, a1, arcRadius)}
                      fill="none"
                      stroke={STATE_LINE_COLOR[state]}
                      strokeWidth={4.5}
                      strokeOpacity={0.85}
                      strokeLinecap="round"
                    />,
                    <text
                      key={`${state}-n`}
                      x={(Math.cos(mid) * labelR).toFixed(2)}
                      y={(Math.sin(mid) * labelR).toFixed(2)}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fontSize={9}
                      fontWeight={700}
                      fill={STATE_LINE_COLOR[state]}
                      fillOpacity={0.8}
                    >
                      {count}
                    </text>,
                  );
                  cursor = a1 + GAP;
                }
                return arcs;
              })()
            : null}

          <circle className="saltos-hub-pulse" cx={0} cy={0} r={ESTABLISHMENT_RADIUS} fill="none" stroke="var(--color-lime)" strokeWidth={2} />
          <circle
            className="saltos-hub-pulse"
            cx={0}
            cy={0}
            r={ESTABLISHMENT_RADIUS}
            fill="none"
            stroke="var(--color-lime)"
            strokeWidth={2}
            style={{ animationDelay: "1.8s" }}
          />

          {layout.links.map((link) => {
            const toNode = byId.get(link.toId);
            const alive = toNode?.state === "billable";
            const d = linkPath(layout, positions, link.fromId, link.toId);
            if (!d) return null;
            return (
              <path
                key={`${link.fromId}>${link.toId}`}
                d={d}
                fill="none"
                stroke={toNode ? STATE_LINE_COLOR[toNode.state] : "rgba(245,247,245,0.22)"}
                strokeOpacity={selectedId ? (ancestors.has(link.toId) ? 0.9 : 0.06) : alive ? 0.55 : 0.22}
                strokeWidth={selectedId && ancestors.has(link.toId) ? 2.2 : 1.4}
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
            );
          })}

          <g data-node-id={graph.establishment.id} className="cursor-pointer">
            <circle cx={0} cy={0} r={ESTABLISHMENT_RADIUS * 2.3} fill="url(#saltos-hub-glow)" />
            <circle cx={0} cy={0} r={ESTABLISHMENT_RADIUS} fill="var(--color-lime)" />
            <text y={-2} textAnchor="middle" dominantBaseline="middle" fontSize={13} fontWeight={800} fill="var(--color-ink)">
              {shopName}
            </text>
            <text y={13} textAnchor="middle" dominantBaseline="middle" fontSize={8} fontWeight={600} letterSpacing={0.6} fill="rgba(14,18,17,0.6)">
              {customerCount} {t.admin.attributions}
            </text>
          </g>

          {graph.nodes.map((node) => {
            const pt = layout.points.get(node.id);
            const pos = positions.get(node.id);
            if (!pt || !pos) return null;
            const isSelected = node.id === selectedId;
            const isAncestor = ancestors.has(node.id);
            const dimmed = selectedId != null && !isSelected && !isAncestor;
            // Sin identidad todavía -invitación sin reclamar-: siempre en
            // contorno, nunca relleno, y jamás con nombre a la vista.
            const isPending = !node.claimed;
            const isBest = node.id === bestPadrino;
            const isExpiringNode = expiringIds.has(node.id);
            const color = STATE_LINE_COLOR[node.state];
            const showLabel = node.claimed && (pan.scale >= LABEL_VISIBLE_SCALE || isSelected || isAncestor);

            return (
              <g
                key={node.id}
                data-node-id={node.id}
                className="cursor-pointer"
                opacity={dimmed ? 0.12 : 1}
                transform={`translate(${pos.x.toFixed(2)},${pos.y.toFixed(2)})`}
              >
                {isExpiringNode ? (
                  <circle className="saltos-alert-ring" r={pt.nodeRadius + 4} fill="none" stroke="var(--color-coral)" strokeWidth={1.2} />
                ) : null}
                {isBest ? <circle r={pt.nodeRadius * 2.1} fill="var(--color-amber)" fillOpacity={0.16} filter="url(#saltos-soft)" /> : null}

                {isPending ? (
                  <circle className="saltos-dashed" r={pt.nodeRadius} fill="none" stroke={color} strokeWidth={1.4} strokeOpacity={0.85} />
                ) : (
                  <>
                    <circle r={pt.nodeRadius * 1.8} fill={color} fillOpacity={0.13} filter="url(#saltos-soft)" />
                    <circle r={pt.nodeRadius} fill={color} />
                    <circle r={pt.nodeRadius} fill="none" stroke="rgba(255,255,255,.18)" strokeWidth={0.6} />
                  </>
                )}
                <circle r={Math.max(pt.nodeRadius + 7, 14)} fill="transparent" />

                {node.claimed ? (
                  <text
                    y={pt.nodeRadius + 10}
                    textAnchor="middle"
                    fontSize={9}
                    fontWeight={500}
                    fill="rgba(245,247,245,0.86)"
                    opacity={showLabel ? 1 : 0}
                    style={{ transition: "opacity 0.2s" }}
                  >
                    {node.name}
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

        <div className="pointer-events-none flex flex-col items-end gap-0.5 pt-1">
          <CountUpStat value={hud.invites} label={t.admin.sent} active={mounted} />
          <CountUpStat value={hud.opened} label={t.admin.opened} active={mounted} />
          <CountUpStat value={hud.redeemed} label={t.admin.redeemed} active={mounted} />
          <CountUpStat value={hud.billable} label={t.admin.attrBillable} active={mounted} />
          <CountUpStat value={hud.maxHops} label={t.admin.maxHops} active={mounted} />
        </div>
      </header>

      {legendOpen ? (
        <div className="glass-dark pointer-events-none fixed bottom-[7.5rem] left-3 z-20 max-w-[13rem] rounded-[var(--radius-card)] p-3.5">
          <p className="eyebrow text-chalk/40">{t.admin.saltosLegendTitle}</p>
          <div className="mt-2 flex flex-col gap-1.5">
            {FUNNEL_ORDER.map((state) => (
              <div key={state} className="flex items-center gap-2 text-[0.75rem] text-chalk/75">
                <span className={cn("size-2.5 shrink-0 rounded-full", STATE_BADGE_SKIN[state])} />
                <span className="min-w-0 flex-1 truncate">{stateBadgeLabel(state, t)}</span>
                <span className="numeral text-[0.6875rem] text-chalk/40">{funnelCounts.get(state) ?? 0}</span>
              </div>
            ))}
          </div>
          <div className="mt-3 flex items-end gap-2.5 border-t border-white/8 pt-2.5">
            <span className="block size-2 rounded-full bg-chalk/25" />
            <span className="block size-3.5 rounded-full bg-chalk/25" />
            <span className="block size-5 rounded-full bg-chalk/25" />
            <p className="text-[0.625rem] leading-tight text-chalk/40">{t.admin.saltosSizeLegend}</p>
          </div>
        </div>
      ) : null}

      <footer className="pointer-events-none fixed inset-x-0 bottom-0 flex flex-col items-center gap-3 px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
        {!selectedNode ? <p className="text-[0.75rem] text-chalk/40">{funnelTotal === 0 ? t.admin.referralMapEmpty : t.admin.referralMapHint}</p> : null}
        <div className="pointer-events-auto flex items-center gap-2">
          <button
            type="button"
            onClick={() => setLegendOpen((v) => !v)}
            aria-pressed={legendOpen}
            className={cn(
              "btn px-4 py-2.5 text-[0.8125rem]",
              legendOpen ? "bg-lime text-ink" : "glass-dark text-chalk",
            )}
          >
            {t.admin.legend}
          </button>
          <button type="button" onClick={resetView} aria-label={t.admin.resetView} className="btn glass-dark size-11 text-chalk">
            <CompassIcon className="size-5" />
          </button>
        </div>
      </footer>

      <SelectionSheet node={selectedNode} giftedByName={giftedByName} locale={locale} t={t} onClose={() => setSelectedId(null)} />
    </div>
  );
}
