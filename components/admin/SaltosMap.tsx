"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeftIcon, CompassIcon } from "@/components/ui/Icons";
import { SelectionSheet } from "@/components/universe/SelectionSheet";
import { cn } from "@/lib/cn";
import { hash01 } from "@/lib/giftGraph/organicMotion";
import { bestPadrinoId, isExpiringSoon } from "@/lib/giftGraph/insights";
import { type Pan, panBy, pixelsToUnits, zoomAtPoint } from "@/lib/panZoom";
import { computeFitScale, ESTABLISHMENT_RADIUS, layoutSaltos, RING_STEP } from "@/lib/giftGraph/saltosLayout";
import { STATE_BADGE_SKIN, STATE_LINE_COLOR, stateBadgeLabel } from "@/lib/giftGraph/stateBadge";
import { isTap, type PointerPoint } from "@/lib/giftGraph/tapGesture";
import type { GiftGraph, NodeState } from "@/lib/giftGraph/types";
import type { Dict, Locale } from "@/lib/i18n";

const LABEL_PAD = 64;
const PAN_ROOM = 200;
const MIN_SCALE = 0.5;
const MAX_SCALE = 3.5;
const LABEL_VISIBLE_SCALE = 1.3;

/** rad/s: una vuelta completa cada ~13 minutos, apenas perceptible. */
const ROTATE_SPEED = 0.008;
const ROTATE_RESUME_DELAY_SEC = 2.6;
const WOBBLE_AMPLITUDE = 6;
const EXPIRING_PULSE_SPEED = 3.4;
/** Cuántas cadenas vivas (que llegan a facturable) reciben una partícula viajera. */
const MAX_ALIVE_PULSES = 10;

/** Orden narrativo del arco perimetral: el camino feliz primero, las dos salidas negativas al final. */
const FUNNEL_ORDER: NodeState[] = ["sent", "opened", "window", "billable", "expired", "discarded"];

type PointerState = { x: number; y: number };
type LiveXY = { x: number; y: number };

/** Vaivén radial suave, propio de cada nodo -periodo y fase por hash, nunca Math.random(). */
function wobbleOffset(id: string, elapsedSec: number): number {
  const freq = 0.05 + hash01(`${id}:freq`) * 0.04;
  const phase = hash01(`${id}:phase`) * Math.PI * 2;
  return Math.sin(elapsedSec * Math.PI * 2 * freq + phase) * WOBBLE_AMPLITUDE;
}

function liveXY(angle: number, ringRadius: number, depth: number, id: string, rotation: number, elapsedSec: number, reducedMotion: boolean): LiveXY {
  if (depth === 0) return { x: 0, y: 0 };
  const a = angle + rotation;
  const r = ringRadius + (reducedMotion ? 0 : wobbleOffset(id, elapsedSec));
  return { x: r * Math.cos(a), y: r * Math.sin(a) };
}

/** Bezier cúbica evaluada a mano: la misma curva que dibuja el link, para que la partícula viaje exactamente encima. */
function bezierPoint(p0: LiveXY, c1: LiveXY, c2: LiveXY, p1: LiveXY, t: number): LiveXY {
  const u = 1 - t;
  const a = u * u * u,
    b = 3 * u * u * t,
    c = 3 * u * t * t,
    d = t * t * t;
  return {
    x: a * p0.x + b * c1.x + c * c2.x + d * p1.x,
    y: a * p0.y + b * c1.y + c * c2.y + d * p1.y,
  };
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
 * panel. Layout, codificación por estado e interacciones (pan/zoom, toque
 * para seleccionar, leyenda plegable) calcados de la especificación visual;
 * los datos y colores salen de aquí, no de una paleta inventada.
 */
export function SaltosMap({ graph, shopName, locale, t }: { graph: GiftGraph; shopName: string; locale: Locale; t: Dict }) {
  const [reducedMotion] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    // Diferido a un microtask, no una llamada síncrona dentro del propio
    // efecto: evita el aviso de "cascading renders" del linter.
    queueMicrotask(() => setMounted(true));
  }, []);

  const layout = useMemo(() => layoutSaltos(graph.nodes, graph.edges, graph.establishment.id), [graph]);
  const byId = useMemo(() => new Map(graph.nodes.map((n) => [n.id, n])), [graph.nodes]);
  const parentOf = useMemo(() => new Map(graph.edges.map((e) => [e.to, e.from])), [graph.edges]);
  const bestPadrino = useMemo(() => bestPadrinoId(graph.nodes, graph.edges), [graph.nodes, graph.edges]);

  const [nowMs] = useState(() => Date.now());
  const expiringIds = useMemo(
    () => new Set(graph.nodes.filter((n) => isExpiringSoon(n.expiresAt, nowMs)).map((n) => n.id)),
    [graph.nodes, nowMs],
  );

  // Cadenas vivas: aristas cuyo hijo ya es facturable, con partícula viajera. Un tope
  // razonable, no por esconder datos -todo nodo/arista se pinta igual- sino porque un
  // enjambre de puntos no se lee mejor que unos pocos.
  const alivePulses = useMemo(() => {
    const billableIds = new Set(graph.nodes.filter((n) => n.state === "billable").map((n) => n.id));
    return graph.edges.filter((e) => billableIds.has(e.to)).slice(0, MAX_ALIVE_PULSES);
  }, [graph.nodes, graph.edges]);

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

  const customerCount = useMemo(() => graph.nodes.filter((n) => !n.id.startsWith("inv:")).length, [graph.nodes]);

  const half = layout.extent + LABEL_PAD + PAN_ROOM;
  const size = half * 2;
  const funnelRadius = layout.extent + 34;
  const fitScale = computeFitScale(layout.extent, half, MIN_SCALE, MAX_SCALE);

  const [pan, setPan] = useState<Pan>(() => ({ x: 0, y: 0, scale: fitScale }));
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
  const nodeRefs = useRef(new Map<string, SVGGElement>());
  const linkRefs = useRef(new Map<string, SVGPathElement>());
  const particleRefs = useRef(new Map<string, SVGCircleElement>());
  const pulseRefs = useRef(new Map<string, SVGCircleElement>());
  const livePos = useRef(new Map<string, LiveXY>());

  const rotRef = useRef(0);
  const sinceInteractionRef = useRef(ROTATE_RESUME_DELAY_SEC);
  const clockRef = useRef(0);
  const pulsePhaseRef = useRef(new Map(alivePulses.map((e) => [`${e.from}>${e.to}`, hash01(`${e.from}>${e.to}`)])));

  const pointers = useRef(new Map<number, PointerState>());
  const dragOrigin = useRef<{ pan: Pan; mid: PointerState; dist: number } | null>(null);
  const tapCandidate = useRef<{ pointerId: number; nodeId: string | null; down: PointerPoint } | null>(null);
  const [interacting, setInteracting] = useState(false);

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
    setInteracting(true);

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
      sinceInteractionRef.current = 0;
      setInteracting(false);
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
      sinceInteractionRef.current = 0;
    }
    svg.addEventListener("wheel", onWheel, { passive: false });
    return () => svg.removeEventListener("wheel", onWheel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Bucle de animación: rotación ambiental lentísima, vaivén propio por nodo y la
  // partícula que recorre las cadenas ya facturables. Todo por refs -nunca setState
  // por frame- para no repintar React sesenta veces por segundo.
  useEffect(() => {
    let raf = 0;
    let last = performance.now();

    function tick(now: number) {
      const deltaSec = Math.min(0.05, (now - last) / 1000);
      last = now;
      clockRef.current += deltaSec;
      sinceInteractionRef.current += deltaSec;

      if (!reducedMotion && !interacting && sinceInteractionRef.current > ROTATE_RESUME_DELAY_SEC) {
        rotRef.current += ROTATE_SPEED * deltaSec;
      }

      for (const pt of layout.points.values()) {
        const xy = liveXY(pt.angle, pt.ringRadius, pt.depth, pt.id, rotRef.current, clockRef.current, reducedMotion);
        livePos.current.set(pt.id, xy);
        const g = nodeRefs.current.get(pt.id);
        if (g) g.setAttribute("transform", `translate(${xy.x.toFixed(2)},${xy.y.toFixed(2)})`);
      }

      for (const link of layout.links) {
        const key = `${link.fromId}>${link.toId}`;
        const path = linkRefs.current.get(key);
        if (!path) continue;
        const from = layout.points.get(link.fromId);
        const to = layout.points.get(link.toId);
        const p0 = livePos.current.get(link.fromId);
        const p1 = livePos.current.get(link.toId);
        if (!from || !to || !p0 || !p1) continue;

        const midR = (from.ringRadius + to.ringRadius) / 2;
        const a0 = from.depth === 0 ? to.angle + rotRef.current : from.angle + rotRef.current;
        const a1 = to.angle + rotRef.current;
        const c1 = { x: midR * Math.cos(a0), y: midR * Math.sin(a0) };
        const c2 = { x: midR * Math.cos(a1), y: midR * Math.sin(a1) };
        path.setAttribute(
          "d",
          `M${p0.x.toFixed(2)},${p0.y.toFixed(2)} C${c1.x.toFixed(2)},${c1.y.toFixed(2)} ${c2.x.toFixed(2)},${c2.y.toFixed(2)} ${p1.x.toFixed(2)},${p1.y.toFixed(2)}`,
        );

        const dot = particleRefs.current.get(key);
        if (dot && !reducedMotion) {
          let phase = pulsePhaseRef.current.get(key) ?? 0;
          phase += deltaSec * 0.11;
          if (phase > 1) phase -= 1;
          pulsePhaseRef.current.set(key, phase);
          const along = bezierPoint(p0, c1, c2, p1, phase);
          dot.setAttribute("cx", along.x.toFixed(2));
          dot.setAttribute("cy", along.y.toFixed(2));
          dot.setAttribute("opacity", (Math.sin(phase * Math.PI) * 0.85).toFixed(2));
        }
      }

      if (!reducedMotion) {
        for (const id of expiringIds) {
          const ring = pulseRefs.current.get(id);
          const pt = layout.points.get(id);
          if (!ring || !pt) continue;
          const pulse = 0.5 + 0.5 * Math.sin(clockRef.current * EXPIRING_PULSE_SPEED);
          ring.setAttribute("r", (pt.nodeRadius + 3 + pulse * 7).toFixed(2));
          ring.setAttribute("opacity", (0.15 + pulse * 0.5).toFixed(2));
        }
      }

      raf = requestAnimationFrame(tick);
    }

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [layout, reducedMotion, interacting, expiringIds]);

  function resetView() {
    setPan({ x: 0, y: 0, scale: fitScale });
    setSelectedId(null);
  }

  return (
    <div className="fixed inset-0 aurora-night text-chalk">
      <style>{`
        @keyframes saltos-pulse { 0% { r: ${ESTABLISHMENT_RADIUS}px; opacity: 0.5; } 100% { r: ${ESTABLISHMENT_RADIUS + layout.extent * 0.55}px; opacity: 0; } }
        @keyframes saltos-flow { to { stroke-dashoffset: -24; } }
        @keyframes saltos-breathe { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
        .saltos-hub-pulse { animation: saltos-pulse 3.6s cubic-bezier(0.2,0.6,0.4,1) infinite; }
        .saltos-dashed { stroke-dasharray: 3 3; animation: saltos-flow 3.4s linear infinite; }
        .saltos-ring { animation: saltos-breathe 6s ease-in-out infinite; }
        ${reducedMotion ? ".saltos-hub-pulse,.saltos-dashed,.saltos-ring{animation:none}" : ""}
      `}</style>

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
          {Array.from({ length: layout.maxDepth }, (_, index) => {
            const depth = index + 1;
            return (
              <circle
                key={depth}
                className="saltos-ring"
                cx={0}
                cy={0}
                r={depth * RING_STEP}
                fill="none"
                stroke={depth % 2 === 1 ? "rgba(245,247,245,0.035)" : "rgba(245,247,245,0.06)"}
                strokeWidth={RING_STEP}
                style={{ animationDelay: `${depth * 0.5}s` }}
              />
            );
          })}

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
                  const labelR = funnelRadius + 11;
                  arcs.push(
                    <path
                      key={state}
                      d={arcPath(cursor, a1, funnelRadius)}
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

          <circle className="saltos-hub-pulse" cx={0} cy={0} fill="none" stroke="var(--color-lime)" strokeWidth={2} />
          <circle
            className="saltos-hub-pulse"
            cx={0}
            cy={0}
            fill="none"
            stroke="var(--color-lime)"
            strokeWidth={2}
            style={{ animationDelay: "1.8s" }}
          />

          {layout.links.map((link) => {
            const toNode = byId.get(link.toId);
            const alive = toNode?.state === "billable";
            return (
              <path
                key={`${link.fromId}>${link.toId}`}
                ref={(el) => {
                  if (el) linkRefs.current.set(`${link.fromId}>${link.toId}`, el);
                  else linkRefs.current.delete(`${link.fromId}>${link.toId}`);
                }}
                fill="none"
                stroke={toNode ? STATE_LINE_COLOR[toNode.state] : "rgba(245,247,245,0.22)"}
                strokeOpacity={selectedId ? (ancestors.has(link.toId) ? 0.9 : 0.06) : alive ? 0.55 : 0.22}
                strokeWidth={selectedId && ancestors.has(link.toId) ? 2.2 : 1.4}
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
            );
          })}

          {alivePulses.map((edge) => {
            const key = `${edge.from}>${edge.to}`;
            return (
              <circle
                key={key}
                ref={(el) => {
                  if (el) particleRefs.current.set(key, el);
                  else particleRefs.current.delete(key);
                }}
                r={2.1}
                fill="var(--color-chalk)"
                opacity={0}
              />
            );
          })}

          <g
            data-node-id={graph.establishment.id}
            ref={(el) => {
              if (el) nodeRefs.current.set(graph.establishment.id, el);
              else nodeRefs.current.delete(graph.establishment.id);
            }}
            className="cursor-pointer"
          >
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
            if (!pt) return null;
            const isSelected = node.id === selectedId;
            const isAncestor = ancestors.has(node.id);
            const dimmed = selectedId != null && !isSelected && !isAncestor;
            const isPending = node.state === "sent";
            const isBest = node.id === bestPadrino;
            const isExpiringNode = expiringIds.has(node.id);
            const color = STATE_LINE_COLOR[node.state];
            const showLabel = pan.scale >= LABEL_VISIBLE_SCALE || isSelected || isAncestor;

            return (
              <g
                key={node.id}
                data-node-id={node.id}
                ref={(el) => {
                  if (el) nodeRefs.current.set(node.id, el);
                  else nodeRefs.current.delete(node.id);
                }}
                className="cursor-pointer"
                opacity={dimmed ? 0.12 : 1}
              >
                {isExpiringNode ? (
                  <circle
                    ref={(el) => {
                      if (el) pulseRefs.current.set(node.id, el);
                      else pulseRefs.current.delete(node.id);
                    }}
                    r={pt.nodeRadius + 4}
                    fill="none"
                    stroke="var(--color-coral)"
                    strokeWidth={1.2}
                  />
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
