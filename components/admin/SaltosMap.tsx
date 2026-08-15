"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeftIcon, CompassIcon } from "@/components/ui/Icons";
import { SaltosSheet } from "@/components/admin/SaltosSheet";
import { cn } from "@/lib/cn";
import { bestPadrinoId, isExpiringSoon } from "@/lib/giftGraph/insights";
import { type Pan, panBy, pixelsToUnits, zoomAtPoint } from "@/lib/panZoom";
import { ESTABLISHMENT_RADIUS, layoutSaltos, type SaltosLayout, type SaltosPoint } from "@/lib/giftGraph/saltosLayout";
import { STATE_LINE_COLOR, stateBadgeLabel } from "@/lib/giftGraph/stateBadge";
import { isTap, type PointerPoint } from "@/lib/giftGraph/tapGesture";
import type { GiftGraph, Node, NodeState } from "@/lib/giftGraph/types";
import { ordinalHop, type Dict, type Locale } from "@/lib/i18n";

/** Zoom manual sobre el encuadre automático (pellizco, rueda): 1 = el encuadre tal cual. */
const MIN_SCALE = 0.55;
const MAX_SCALE = 4.5;
/** Por debajo de esto los nombres no se enseñan -evita el solapamiento con muchos nodos juntos. */
const LABEL_VISIBLE_SCALE = 1.45;
/** Margen fijo entre el arco del embudo (el elemento más lejano) y el borde del viewBox. */
const VIEWBOX_PADDING = 30;
/** Toque vs. arrastre: umbrales propios de esta vista -no los del universo 3D-. */
const TAP_MAX_DISTANCE_PX = 8;
const TAP_MAX_DURATION_MS = 400;

/** Radianes por frame de la rotación de fondo, y cuánto tarda en reanudarse tras soltar. */
const ROTATION_PER_FRAME = 0.00019;
const ROTATION_RESUME_DELAY_MS = 2600;
/** Amplitud del bamboleo radial de cada nodo, en unidades del viewBox. */
const WOBBLE_AMPLITUDE = 2.2;
/** Avance por frame del punto que recorre las cadenas con canje reciente, y su radio. */
const PULSE_STEP = 0.0035;
const PULSE_DOT_R = 1.9;
/** Ventana de "canje reciente" para disparar el pulso: la misma que usa el negocio para el retorno. */
const RECENT_REDEMPTION_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Efecto "escena espacial": el fondo de estrellas se desplaza con la
 * inclinación del móvil -o con el cursor en escritorio, que no tiene
 * giroscopio- dando sensación de profundidad, como el fondo animado del
 * springboard de iOS. Solo toca la capa decorativa de estrellas, nunca la
 * constelación interactiva: mover el grafo con el gesto habría interferido
 * con el propio toque/pellizco que ya usa esos mismos dedos.
 *
 * El desplazamiento máximo es una fracción del viewBox -no un número fijo
 * de unidades-: en un grafo pequeño (viewBox chico) un valor fijo ya se
 * notaba, pero en uno grande el mismo desplazamiento absoluto se perdía
 * de lo pequeño que se veía en proporción. Con un porcentaje, el efecto
 * se nota igual de bien sin importar cuántos saltos tenga la constelación.
 */
const PARALLAX_SHIFT_FRACTION = 0.09;
const PARALLAX_MIN_SHIFT = 20;
const PARALLAX_MAX_SHIFT = 90;
const PARALLAX_EASE = 0.12;
const PARALLAX_TILT_RANGE_DEG = 20;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Orden narrativo del arco perimetral, del peor al mejor en sentido horario:
 * enviada → caducada → abierta → en ventana → facturable. "discarded" no
 * aparece en la especificación -no tiene hueco en ese embudo de 5 estados-
 * pero los nodos descartados existen de verdad, así que se enseñan igual,
 * al final del arco, en vez de desaparecer en silencio.
 */
const FUNNEL_ORDER: NodeState[] = ["sent", "expired", "opened", "window", "billable", "discarded"];

/**
 * Colores propios de esta vista, no del embudo compartido
 * (lib/giftGraph/stateBadge.ts): la especificación de la constelación pide
 * "abierta" en ámbar -distinto del azul que usan /admin/atribuciones y el
 * universo 3D-. Overrides solo aquí; STATE_LINE_COLOR/STATE_BADGE_SKIN de
 * stateBadge.ts se quedan como están para no desincronizar el embudo real.
 *
 * Los seis estados en tonos bien distintos entre sí: enviada en verde
 * (mint), caducada en coral, abierta en ámbar, en ventana en azure,
 * facturable en lima, descartada en gris (slate, el neutro del proyecto).
 *
 * Sin distinción especial por profundidad: todos los nodos de "1er
 * salto" son clientes originales sin padrino propio en el modelo de
 * datos real, así que siempre están en estado "en ventana" -pintarlos
 * aparte hacía que los nodos junto al núcleo nunca se vieran del azure
 * que le corresponde a ese estado en el resto del mapa.
 */
const SALTOS_STATE_COLOR: Record<NodeState, string> = {
  ...STATE_LINE_COLOR,
  sent: "var(--color-mint)",
  opened: "var(--color-amber)",
  window: "var(--color-azure)",
  discarded: "var(--color-slate)",
};

function saltosNodeColor(node: Node): string {
  return SALTOS_STATE_COLOR[node.state];
}

/**
 * Jerarquía visual, no solo de color: este es el mapa que el dueño del
 * local quiere dejar abierto en un monitor y ver crecer día a día, así
 * que "facturable" -dinero ganado de verdad- tiene que ganar peso visual
 * a medida que hay más, y las dos salidas negativas (caducada,
 * descartada) tienen que retirarse en vez de competir por la atención:
 * si compiten con el mismo peso que lo bueno, el conjunto se siente como
 * ruido de seis colores en vez de como progreso.
 */
const SALTOS_POSITIVE_STATE: NodeState = "billable";
const SALTOS_MUTED_STATES = new Set<NodeState>(["expired", "discarded"]);

type PointerState = { x: number; y: number };
type XY = { x: number; y: number };

/** Semillas del bamboleo: por índice de aparición, no por hash -así lo pide la especificación. */
function wobbleFreq(index: number): number {
  return 0.3 + ((index * 37) % 13) / 28;
}
function wobblePhase(index: number): number {
  return index * 1.87;
}

function nodeXY(point: { angle: number; ringRadius: number; depth: number }): XY {
  if (point.depth === 0) return { x: 0, y: 0 };
  return { x: point.ringRadius * Math.cos(point.angle), y: point.ringRadius * Math.sin(point.angle) };
}

/** Misma posición que nodeXY, pero con la rotación de fondo y el bamboleo del nodo ya aplicados. */
function animatedXY(point: SaltosPoint, rotation: number, nowMs: number): XY {
  if (point.depth === 0) return { x: 0, y: 0 };
  const wobble = Math.sin((nowMs / 1000) * wobbleFreq(point.index) + wobblePhase(point.index)) * WOBBLE_AMPLITUDE;
  const r = point.ringRadius + wobble;
  const angle = point.angle + rotation;
  return { x: r * Math.cos(angle), y: r * Math.sin(angle) };
}

/**
 * Curva Bézier cúbica: los puntos de control van al radio medio entre el
 * anillo del padre y el del hijo, cada uno en su propio ángulo, para que la
 * rama gire suave hacia su hijo en vez de salir en línea recta desde el
 * centro. `rotation` es 0 para el primer pintado estático -la base que
 * siempre es correcta, se mueva o no el JS- y el ángulo de fondo real
 * cuando la anima el bucle de rAF.
 */
function linkPath(layout: SaltosLayout, rotation: number, nowMs: number, fromId: string, toId: string): string | null {
  const from = layout.points.get(fromId);
  const to = layout.points.get(toId);
  if (!from || !to) return null;

  const p0 = animatedXY(from, rotation, nowMs);
  const p1 = animatedXY(to, rotation, nowMs);
  const midR = (from.ringRadius + to.ringRadius) / 2;
  // Desde el propio centro (radio 0) el ángulo del padre no significa nada:
  // el primer tramo sale recto, y ya curva a partir del segundo.
  const a0 = (from.depth === 0 ? to.angle : from.angle) + rotation;
  const a1 = to.angle + rotation;
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

/** 130 puntos deterministas -sin Math.random(), igual que el resto del repo- fuera del grupo de zoom. */
function starfield(vb: number): { x: number; y: number; r: number; o: number }[] {
  const stars = [];
  for (let i = 0; i < 130; i++) {
    const angle = (i * 2.399963) % (2 * Math.PI); // ángulo dorado: reparte 130 puntos sin amontonarse
    const radius = 60 + ((i * 53) % 97) / 97 * (vb * 1.05 - 60);
    const r = 0.2 + ((i * 31) % 17) / 16 * 0.9;
    const o = 0.04 + ((i * 19) % 23) / 22 * 0.28;
    stars.push({ x: Math.cos(angle) * radius, y: Math.sin(angle) * radius, r, o });
  }
  return stars;
}

function CountUpStat({ value, label, active, delayMs = 0 }: { value: number; label: string; active: boolean; delayMs?: number }) {
  const [shown, setShown] = useState(0);

  useEffect(() => {
    if (!active) return; // sin animar: el render de abajo usa `value` directamente
    let raf = 0;
    let timeout = 0;
    const DURATION_MS = 800;
    function start() {
      const startedAt = performance.now();
      function tick(now: number) {
        const t = Math.min(1, (now - startedAt) / DURATION_MS);
        setShown(Math.round(value * (1 - (1 - t) ** 3)));
        if (t < 1) raf = requestAnimationFrame(tick);
      }
      raf = requestAnimationFrame(tick);
    }
    timeout = window.setTimeout(start, delayMs);
    return () => {
      window.clearTimeout(timeout);
      cancelAnimationFrame(raf);
    };
  }, [value, active, delayMs]);

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
 * panel. El primer pintado -posiciones y curvas- se calcula una vez por
 * render, directamente en JSX, sin refs ni rAF: tiene que ser correcto ya
 * en el primer frame, sin depender de que el JS de movimiento llegue a
 * arrancar. Encima de esa base, un único bucle de rAF mueve el grupo de
 * nodos y enlaces -rotación de fondo, bamboleo por nodo, pulso de
 * canjes recientes- escribiendo atributos DOM directamente vía refs, para
 * no forzar un re-render de React en cada frame.
 */
export function SaltosMap({
  graph,
  shopName,
  stampsGoal,
  locale,
  t,
}: {
  graph: GiftGraph;
  shopName: string;
  stampsGoal: number;
  locale: Locale;
  t: Dict;
}) {
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

  /** Los enlaces de toda cadena -hub incluido- que cuelga de un canje de los últimos 30 días: por ahí viaja el pulso. */
  const pulseLinkKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const node of graph.nodes) {
      if (!node.redeemedAt) continue;
      if (nowMs - new Date(node.redeemedAt).getTime() > RECENT_REDEMPTION_MS) continue;
      let cur = node.id;
      let guard = 0;
      while (guard++ < 64) {
        const parent = parentOf.get(cur);
        if (!parent) break;
        keys.add(`${parent}>${cur}`);
        cur = parent;
      }
    }
    return keys;
  }, [graph.nodes, parentOf, nowMs]);

  const funnelCounts = useMemo(() => {
    const counts = new Map(FUNNEL_ORDER.map((s) => [s, 0]));
    for (const n of graph.nodes) counts.set(n.state, (counts.get(n.state) ?? 0) + 1);
    return counts;
  }, [graph.nodes]);
  const funnelTotal = useMemo(() => [...funnelCounts.values()].reduce((a, b) => a + b, 0), [funnelCounts]);

  // El HUD sale de la misma cuenta que la leyenda -funnelCounts, por
  // estado actual de cada nodo del grafo-, no del histórico de
  // /admin/embudo: son preguntas distintas ("cuántas se han enviado
  // alguna vez" vs. "cuántas están AHORA en ese punto del camino"), y
  // enseñar las dos con la misma etiqueta y valores distintos en la
  // misma pantalla se leía como un dato roto. Con la misma fuente que la
  // leyenda, HUD y leyenda nunca pueden discreparse.
  const hud = {
    sent: funnelCounts.get("sent") ?? 0,
    opened: funnelCounts.get("opened") ?? 0,
    redeemed: graph.nodes.filter((n) => n.redeemedAt != null).length,
    billable: funnelCounts.get("billable") ?? 0,
    maxHops: layout.maxDepth,
  };

  const customerCount = useMemo(() => graph.nodes.filter((n) => n.claimed).length, [graph.nodes]);

  // Encuadre automático: el viewBox es el arco del embudo -el elemento más
  // lejano de todos, layout.arcRadius- más un margen fijo. Un viewBox
  // cuadrado con "xMidYMid meet" ya reparte eso solo en cualquier proporción
  // de pantalla, así que no hace falta recalcular en el resize: es una
  // propiedad de cómo SVG escala un viewBox, no algo que dependa de los
  // píxeles reales del contenedor -ni tampoco de la rotación de fondo, que
  // gira dentro de ese margen sin llegar nunca a asomar fuera de él.
  const arcRadius = layout.arcRadius;
  const half = arcRadius + VIEWBOX_PADDING;
  const size = half * 2;
  const stars = useMemo(() => starfield(half), [half]);

  const [pan, setPan] = useState<Pan>({ x: 0, y: 0, scale: 1 });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [legendOpen, setLegendOpen] = useState(true);
  const [touched, setTouched] = useState(false);

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

  // Refs para el bucle de rAF: se escriben atributos DOM directamente en
  // cada frame -rotación y bamboleo-, sin pasar por setState ni volver a
  // renderizar React 60 veces por segundo.
  const nodeRefs = useRef(new Map<string, SVGGElement>());
  const linkRefs = useRef(new Map<string, SVGPathElement>());
  const pulseDotRefs = useRef(new Map<string, SVGCircleElement>());
  const rotationRef = useRef(0);
  const pausedRef = useRef(false);
  const resumeTimer = useRef<number | null>(null);

  // Paralaje del fondo de estrellas: objetivo -lo que dice el sensor/ratón
  // ahora mismo- y valor ya suavizado -lo que de verdad se pinta-, para que
  // el ruido del giroscopio no tiemble.
  const starGroupRef = useRef<SVGGElement>(null);
  const tiltTargetRef = useRef({ x: 0, y: 0 });
  const tiltRef = useRef({ x: 0, y: 0 });
  const orientationBaselineRef = useRef<{ beta: number; gamma: number } | null>(null);
  const orientationAttachedRef = useRef(false);
  const orientationRequestedRef = useRef(false);

  const parallaxShift = clamp(half * PARALLAX_SHIFT_FRACTION, PARALLAX_MIN_SHIFT, PARALLAX_MAX_SHIFT);

  function handleOrientation(event: DeviceOrientationEvent) {
    if (event.beta == null || event.gamma == null) return;
    // Calibra contra la primera lectura: da igual el ángulo con el que se
    // sostenga el móvil al entrar, el paralaje parte siempre de cero.
    orientationBaselineRef.current ??= { beta: event.beta, gamma: event.gamma };
    const base = orientationBaselineRef.current;
    const dGamma = clamp(event.gamma - base.gamma, -PARALLAX_TILT_RANGE_DEG, PARALLAX_TILT_RANGE_DEG);
    const dBeta = clamp(event.beta - base.beta, -PARALLAX_TILT_RANGE_DEG, PARALLAX_TILT_RANGE_DEG);
    tiltTargetRef.current = {
      x: (dGamma / PARALLAX_TILT_RANGE_DEG) * parallaxShift,
      y: (dBeta / PARALLAX_TILT_RANGE_DEG) * parallaxShift,
    };
  }

  function attachOrientation() {
    if (orientationAttachedRef.current) return;
    orientationAttachedRef.current = true;
    window.addEventListener("deviceorientation", handleOrientation);
  }

  /** iOS 13+ exige un gesto real del usuario para pedir permiso del giroscopio: se llama desde el primer toque. */
  function requestOrientationIfNeeded() {
    if (orientationRequestedRef.current) return;
    orientationRequestedRef.current = true;
    const RequestableDeviceOrientationEvent = window.DeviceOrientationEvent as unknown as {
      requestPermission?: () => Promise<"granted" | "denied">;
    };
    if (typeof RequestableDeviceOrientationEvent?.requestPermission === "function") {
      RequestableDeviceOrientationEvent.requestPermission()
        .then((state) => {
          if (state === "granted") attachOrientation();
        })
        .catch(() => {});
    }
  }

  function pauseMotion() {
    pausedRef.current = true;
    if (resumeTimer.current != null) window.clearTimeout(resumeTimer.current);
  }
  function scheduleResumeMotion() {
    if (resumeTimer.current != null) window.clearTimeout(resumeTimer.current);
    resumeTimer.current = window.setTimeout(() => {
      pausedRef.current = false;
    }, ROTATION_RESUME_DELAY_MS);
  }

  useEffect(() => {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion) return; // sin rotación, sin bamboleo, sin pulsos, sin paralaje: el pintado estático ya es el resultado final
    let raf = 0;
    let pulseT = 0;

    // Giroscopio: si el navegador no exige permiso explícito -todo menos
    // iOS 13+- se puede escuchar ya mismo. En iOS hace falta un toque real
    // del usuario, así que ahí espera a requestOrientationIfNeeded().
    const RequestableDeviceOrientationEvent = window.DeviceOrientationEvent as unknown as {
      requestPermission?: () => Promise<string>;
    } | undefined;
    if (RequestableDeviceOrientationEvent && typeof RequestableDeviceOrientationEvent.requestPermission !== "function") {
      attachOrientation();
    }

    // Ratón en escritorio -sin giroscopio-: mismo efecto, pero solo cuando
    // no se está arrastrando o pellizcando, para no competir con el pan.
    function onMouseMove(event: MouseEvent) {
      if (pointers.current.size > 0) return;
      const nx = clamp((event.clientX - window.innerWidth / 2) / (window.innerWidth / 2), -1, 1);
      const ny = clamp((event.clientY - window.innerHeight / 2) / (window.innerHeight / 2), -1, 1);
      tiltTargetRef.current = { x: nx * parallaxShift, y: ny * parallaxShift };
    }
    window.addEventListener("mousemove", onMouseMove);

    function tick() {
      raf = requestAnimationFrame(tick);
      if (!pausedRef.current) rotationRef.current += ROTATION_PER_FRAME;
      const rotation = rotationRef.current;
      const now = performance.now();

      for (const point of layout.points.values()) {
        if (point.depth === 0) continue;
        const el = nodeRefs.current.get(point.id);
        if (!el) continue;
        const { x, y } = animatedXY(point, rotation, now);
        el.setAttribute("transform", `translate(${x.toFixed(2)},${y.toFixed(2)})`);
      }

      for (const link of layout.links) {
        const key = `${link.fromId}>${link.toId}`;
        const pathEl = linkRefs.current.get(key);
        if (!pathEl) continue;
        const d = linkPath(layout, rotation, now, link.fromId, link.toId);
        if (d) pathEl.setAttribute("d", d);
      }

      pulseT = (pulseT + PULSE_STEP) % 1;
      const pulseOpacity = Math.sin(pulseT * Math.PI) * 0.85;
      for (const [key, dotEl] of pulseDotRefs.current) {
        const pathEl = linkRefs.current.get(key);
        if (!pathEl || !dotEl) continue;
        const length = pathEl.getTotalLength();
        const point = pathEl.getPointAtLength(length * pulseT);
        dotEl.setAttribute("cx", point.x.toFixed(2));
        dotEl.setAttribute("cy", point.y.toFixed(2));
        dotEl.setAttribute("fill-opacity", pulseOpacity.toFixed(3));
      }

      const tilt = tiltRef.current;
      const target = tiltTargetRef.current;
      tilt.x += (target.x - tilt.x) * PARALLAX_EASE;
      tilt.y += (target.y - tilt.y) * PARALLAX_EASE;
      starGroupRef.current?.setAttribute("transform", `translate(${tilt.x.toFixed(2)},${tilt.y.toFixed(2)})`);
    }

    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      if (resumeTimer.current != null) window.clearTimeout(resumeTimer.current);
      window.removeEventListener("mousemove", onMouseMove);
      if (orientationAttachedRef.current) window.removeEventListener("deviceorientation", handleOrientation);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layout]);

  function viewPoint(clientX: number, clientY: number) {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const rect = svg.getBoundingClientRect();
    const base = Math.min(rect.width, rect.height);
    return {
      x: pixelsToUnits(clientX - rect.left - rect.width / 2, base, size),
      y: pixelsToUnits(clientY - rect.top - rect.height / 2, base, size),
    };
  }
  function deltaToView(dx: number, dy: number) {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const rect = svg.getBoundingClientRect();
    const base = Math.min(rect.width, rect.height);
    return { x: pixelsToUnits(dx, base, size), y: pixelsToUnits(dy, base, size) };
  }

  /** Punto medio y distancia entre los dos primeros punteros activos -siempre los mismos dos mientras no cambien-. */
  function pinchAnchor(): { mid: PointerState; dist: number } {
    const [a, b] = [...pointers.current.values()];
    return { mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, dist: Math.hypot(a.x - b.x, a.y - b.y) };
  }

  function onPointerDown(event: React.PointerEvent<SVGSVGElement>) {
    try {
      // El navegador puede haber invalidado ya este puntero -un
      // tap/suelta muy rápidos, un gesto que el sistema interrumpió a
      // media pulsación- justo antes de que este handler llegue a
      // ejecutarse: setPointerCapture lanza NotFoundError en ese caso.
      // Sin este try/catch, esa excepción abortaba el resto de la
      // función y dejaba pointers.current a medio actualizar -la
      // "gestión de dedos" empezaba a desincronizarse desde ahí.
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // Sigue sin captura: el pan/pellizco funciona igual mientras el
      // dedo no salga del propio SVG, que es el caso normal.
    }
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    setTouched(true);
    pauseMotion();
    requestOrientationIfNeeded();

    if (pointers.current.size === 1) {
      dragOrigin.current = { pan, mid: { x: event.clientX, y: event.clientY }, dist: 0 };
      const targetEl = event.target as Element;
      const nodeEl = targetEl.closest?.("[data-node-id]");
      tapCandidate.current = {
        pointerId: event.pointerId,
        nodeId: nodeEl?.getAttribute("data-node-id") ?? null,
        down: { x: event.clientX, y: event.clientY, t: Date.now() },
      };
    } else {
      // Dos dedos o más: siempre reancla al pan actual con los dos primeros
      // punteros activos. Así, si aparece un tercer contacto -la palma
      // apoyada, un dedo de más- el pellizco no se queda "colgado" con un
      // ancla que ya no corresponde a los dedos que de verdad se mueven;
      // cada dedo nuevo simplemente empieza un pellizco fresco desde donde
      // está la vista ahora mismo.
      tapCandidate.current = null;
      dragOrigin.current = { pan, ...pinchAnchor() };
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

    if (pointers.current.size >= 2) {
      const { mid, dist } = pinchAnchor();
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
      scheduleResumeMotion();
      if (pending && pending.pointerId === event.pointerId) {
        const up: PointerPoint = { x: event.clientX, y: event.clientY, t: Date.now() };
        if (isTap(pending.down, up, TAP_MAX_DISTANCE_PX, TAP_MAX_DURATION_MS)) {
          if (pending.nodeId && pending.nodeId !== graph.establishment.id) setSelectedId(pending.nodeId);
          else if (!pending.nodeId) setSelectedId(null);
        }
      }
      tapCandidate.current = null;
    } else if (pointers.current.size === 1) {
      const [only] = [...pointers.current.entries()];
      dragOrigin.current = { pan, mid: { x: only[1].x, y: only[1].y }, dist: 0 };
    } else {
      // Quedan 2+ dedos -se soltó uno de tres o más-: reancla el pellizco a
      // los que siguen tocando, por la misma razón que en onPointerDown.
      dragOrigin.current = { pan, ...pinchAnchor() };
    }
  }

  /**
   * Red de seguridad: si el navegador nunca llega a avisar de que un dedo
   * se soltó -una interrupción del sistema a media gesto, el móvil se
   * bloquea un instante, un pointercancel que no llega-, ese puntero se
   * queda fantasma en `pointers.current` para siempre. Desde ahí, cada
   * futuro toque cuenta uno de más: un solo dedo se lee como pellizco, y
   * el gesto entero deja de responder bien -justo el "se bloquea" que
   * reporta el problema. Se limpia entero ante cualquier señal de que la
   * gestión normal de punteros pudo fallar.
   */
  function resetGesture() {
    pointers.current.clear();
    dragOrigin.current = null;
    tapCandidate.current = null;
    scheduleResumeMotion();
  }

  // React registra los listeners de wheel como pasivos: preventDefault() ahí no evita
  // el scroll nativo. Hace falta un listener nativo con { passive: false }.
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    function onWheel(event: WheelEvent) {
      event.preventDefault();
      const factor = Math.exp(-event.deltaY * 0.0016);
      const point = viewPoint(event.clientX, event.clientY);
      setPan((prev) => zoomAtPoint(prev, point.x, point.y, factor, MIN_SCALE, MAX_SCALE));
    }
    svg.addEventListener("wheel", onWheel, { passive: false });
    return () => svg.removeEventListener("wheel", onWheel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Otra parte de la misma red de seguridad: cambiar de app, recibir una
  // llamada o que el sistema pida el foco a media pellizco puede interrumpir
  // el gesto sin que el navegador llegue a avisar por pointerup/pointercancel.
  useEffect(() => {
    function onVisibilityChange() {
      if (document.hidden) resetGesture();
    }
    window.addEventListener("blur", resetGesture);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.removeEventListener("blur", resetGesture);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function resetView() {
    setPan({ x: 0, y: 0, scale: 1 });
    setSelectedId(null);
  }

  return (
    <div className="fixed inset-0 aurora-night text-chalk">
      {/* Capa de grano: sin ella el degradado nocturno se bandea en pantallas OLED. */}
      <svg className="pointer-events-none fixed inset-0 z-10 h-full w-full opacity-[0.15]" aria-hidden="true">
        <filter id="saltos-grain">
          <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves={3} stitchTiles="stitch" />
        </filter>
        <rect width="100%" height="100%" filter="url(#saltos-grain)" />
      </svg>

      <style>{`
        @keyframes saltos-hub-pulse { 0% { transform: scale(1); opacity: 0.5; } 100% { transform: scale(2.4); opacity: 0; } }
        @keyframes saltos-flow { to { stroke-dashoffset: -24; } }
        @keyframes saltos-alert-pulse { 0%, 100% { transform: scale(1); opacity: 0.12; } 50% { transform: scale(1.2); opacity: 0.4; } }
        @keyframes saltos-billable-glow { 0%, 100% { transform: scale(1); opacity: 0.22; } 50% { transform: scale(1.08); opacity: 0.32; } }
        .saltos-hub-pulse { transform-origin: center; transform-box: fill-box; animation: saltos-hub-pulse 3.6s cubic-bezier(0.2,0.6,0.4,1) infinite; }
        .saltos-dashed { stroke-dasharray: 3 3; animation: saltos-flow 9s linear infinite; }
        .saltos-alert-ring { transform-origin: center; transform-box: fill-box; animation: saltos-alert-pulse 2.6s ease-in-out infinite; }
        .saltos-billable-glow { transform-origin: center; transform-box: fill-box; animation: saltos-billable-glow 5s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) {
          .saltos-hub-pulse, .saltos-dashed, .saltos-alert-ring, .saltos-billable-glow { animation: none; }
        }
      `}</style>

      <svg
        ref={svgRef}
        viewBox={`${-half} ${-half} ${size} ${size}`}
        preserveAspectRatio="xMidYMid meet"
        className="relative z-0 h-dvh w-full touch-none select-none"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endPointer}
        onPointerCancel={endPointer}
        onPointerLeave={endPointer}
        onLostPointerCapture={endPointer}
        onDoubleClick={resetView}
        role="img"
        aria-label={t.admin.referralMap}
      >
        <defs>
          <radialGradient id="saltos-hub-glow">
            <stop offset="0%" stopColor="var(--color-lime)" stopOpacity={0.45} />
            <stop offset="60%" stopColor="var(--color-lime)" stopOpacity={0.08} />
            <stop offset="100%" stopColor="var(--color-lime)" stopOpacity={0} />
          </radialGradient>
          <filter id="saltos-soft" x="-70%" y="-70%" width="240%" height="240%">
            <feGaussianBlur stdDeviation="2.2" />
          </filter>
        </defs>

        {/* Fuera del grupo de zoom: no escala con el pellizco, como pide la especificación.
            El propio <g> sí se desplaza con la inclinación del móvil -paralaje-, pero por
            ref en el bucle de rAF, nunca por React: no hace falta re-renderizar 60 veces
            por segundo solo para mover el fondo decorativo. */}
        <g ref={starGroupRef}>
          {stars.map((star, i) => (
            <circle key={i} cx={star.x.toFixed(2)} cy={star.y.toFixed(2)} r={star.r.toFixed(2)} fill="var(--color-chalk)" fillOpacity={star.o.toFixed(2)} />
          ))}
        </g>

        <g transform={`translate(${pan.x} ${pan.y}) scale(${pan.scale})`}>
          {Array.from(layout.ringRadiusByDepth.entries()).map(([depth, r]) => (
            <g key={depth}>
              <circle cx={0} cy={0} r={r} fill="none" stroke="rgba(255,255,255,.065)" strokeDasharray="1 7" strokeLinecap="round" />
              <text
                x={(-r + 3).toFixed(2)}
                y={-3.5}
                fontSize={6}
                fontWeight={500}
                letterSpacing={0.16 * 6}
                style={{ textTransform: "uppercase" }}
                fill="rgba(255,255,255,.2)"
              >
                {ordinalHop(depth, locale)} {t.admin.saltosHopWord}
              </text>
            </g>
          ))}

          {funnelTotal > 0
            ? (() => {
                const GAP = 0.04;
                let cursor = -Math.PI / 2 + 0.05;
                const spanTotal = Math.PI * 2 - 0.26;
                const arcs: React.ReactNode[] = [];
                for (const state of FUNNEL_ORDER) {
                  const count = funnelCounts.get(state) ?? 0;
                  if (count === 0) continue;
                  const span = (spanTotal * count) / funnelTotal;
                  const a1 = cursor + span - GAP;
                  const mid = (cursor + a1) / 2;
                  const labelR = arcRadius + 12;
                  const isMutedArc = SALTOS_MUTED_STATES.has(state);
                  const isPositiveArc = state === SALTOS_POSITIVE_STATE;
                  const arcWidth = isPositiveArc ? 5.5 : isMutedArc ? 3 : 4.5;
                  const arcOpacity = isPositiveArc ? 0.95 : isMutedArc ? 0.4 : 0.85;
                  arcs.push(
                    <path
                      key={state}
                      d={arcPath(cursor, a1, arcRadius)}
                      fill="none"
                      stroke={SALTOS_STATE_COLOR[state]}
                      strokeWidth={arcWidth}
                      strokeOpacity={arcOpacity}
                      strokeLinecap="round"
                    />,
                    <text
                      key={`${state}-n`}
                      x={(Math.cos(mid) * labelR).toFixed(2)}
                      y={(Math.sin(mid) * labelR).toFixed(2)}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fontSize={6}
                      fontWeight={600}
                      fill={SALTOS_STATE_COLOR[state]}
                      fillOpacity={isMutedArc ? 0.5 : 0.8}
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
            const key = `${link.fromId}>${link.toId}`;
            const toNode = byId.get(link.toId);
            const d = linkPath(layout, 0, 0, link.fromId, link.toId);
            if (!d) return null;
            const isPathLink = selectedId != null && ancestors.has(link.toId);
            // Mismo criterio que en los nodos: una rama que terminó en nada
            // -caducada, descartada- se retira visualmente en vez de pesar
            // igual que una que sigue viva.
            const isMutedLink = toNode != null && SALTOS_MUTED_STATES.has(toNode.state);
            const restOpacity = isMutedLink ? 0.14 : 0.3;
            const restWidth = isMutedLink ? 0.9 : 1.3;
            const opacity = selectedId ? (isPathLink ? 0.95 : 0.04) : restOpacity;
            const width = selectedId && isPathLink ? 2.2 : selectedId ? 1.1 : restWidth;
            return (
              <path
                key={key}
                ref={(el) => {
                  if (el) linkRefs.current.set(key, el);
                  else linkRefs.current.delete(key);
                }}
                d={d}
                fill="none"
                stroke={toNode ? saltosNodeColor(toNode) : "rgba(245,247,245,0.22)"}
                strokeOpacity={opacity}
                strokeWidth={width}
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
            );
          })}

          {[...pulseLinkKeys].map((key) => (
            <circle
              key={key}
              ref={(el) => {
                if (el) pulseDotRefs.current.set(key, el);
                else pulseDotRefs.current.delete(key);
              }}
              r={PULSE_DOT_R}
              fill="var(--color-chalk)"
              fillOpacity={0}
              className="pointer-events-none"
            />
          ))}

          <g data-node-id={graph.establishment.id} className="cursor-pointer">
            <circle cx={0} cy={0} r={ESTABLISHMENT_RADIUS * 2.5} fill="url(#saltos-hub-glow)" />
            <circle cx={0} cy={0} r={ESTABLISHMENT_RADIUS} fill="var(--color-lime)" />
            <text y={-1} textAnchor="middle" dominantBaseline="middle" fontSize={8} fontWeight={800} fill="#15150f">
              {shopName}
            </text>
            <text
              y={7.5}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize={4.6}
              fontWeight={600}
              letterSpacing={0.1 * 4.6}
              style={{ textTransform: "uppercase" }}
              fill="rgba(14,18,17,0.6)"
            >
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
            const color = saltosNodeColor(node);
            const showLabel = node.claimed && (pan.scale >= LABEL_VISIBLE_SCALE || isSelected || isAncestor);
            const pendingStrokeOpacity = node.state === "expired" ? 0.6 : 0.75;
            // Jerarquía visual: lo bueno pesa más, lo perdido se retira -no
            // compiten por la atención a partes iguales-. Ver el comentario
            // de SALTOS_POSITIVE_STATE/SALTOS_MUTED_STATES más arriba.
            const isPositive = node.state === SALTOS_POSITIVE_STATE;
            const isMuted = SALTOS_MUTED_STATES.has(node.state);
            const haloFillOpacity = isPositive ? 0.24 : isMuted ? 0.07 : 0.13;
            const haloScale = isPositive ? 2.15 : 1.85;
            const restOpacity = isMuted ? 0.55 : 1;

            return (
              <g
                key={node.id}
                ref={(el) => {
                  if (el) nodeRefs.current.set(node.id, el);
                  else nodeRefs.current.delete(node.id);
                }}
                data-node-id={node.id}
                className="cursor-pointer"
                opacity={dimmed ? 0.11 : restOpacity}
                transform={`translate(${pos.x.toFixed(2)},${pos.y.toFixed(2)})`}
              >
                {isExpiringNode ? (
                  <circle className="saltos-alert-ring" r={pt.nodeRadius + 6} fill="none" stroke="var(--color-coral)" strokeWidth={1} />
                ) : null}
                {isBest ? <circle r={pt.nodeRadius * 2.1} fill="var(--color-amber)" fillOpacity={0.16} filter="url(#saltos-soft)" /> : null}

                {isPending ? (
                  <circle
                    className="saltos-dashed"
                    r={pt.nodeRadius + 1.6}
                    fill="none"
                    stroke={color}
                    strokeWidth={1.4}
                    strokeOpacity={pendingStrokeOpacity}
                  />
                ) : (
                  <>
                    <circle
                      className={isPositive ? "saltos-billable-glow" : undefined}
                      r={pt.nodeRadius * haloScale}
                      fill={color}
                      fillOpacity={haloFillOpacity}
                      filter="url(#saltos-soft)"
                    />
                    <circle r={pt.nodeRadius} fill={color} />
                    <circle r={pt.nodeRadius} fill="none" stroke="rgba(255,255,255,.16)" strokeWidth={0.55} />
                  </>
                )}
                <circle r={Math.max(pt.nodeRadius + 7, 12)} fill="transparent" />

                {node.claimed ? (
                  <text
                    y={pt.nodeRadius + 7}
                    textAnchor="middle"
                    fontSize={6.2}
                    fontWeight={500}
                    fill="rgba(245,247,245,0.88)"
                    opacity={showLabel ? 1 : 0}
                    style={{ transition: "opacity 0.2s", pointerEvents: "none" }}
                  >
                    {node.name}
                  </text>
                ) : null}
              </g>
            );
          })}
        </g>
      </svg>

      {/* z-30, por encima de la leyenda y el footer (z-20): en viewports bajos
          -móvil en horizontal- la leyenda puede crecer hasta solaparse con la
          cabecera, y el botón de volver tiene que seguir pudiéndose tocar. */}
      <header className="pointer-events-none fixed inset-x-0 top-0 z-30 flex items-start justify-between gap-3 px-5 pt-[max(1rem,env(safe-area-inset-top))]">
        <Link
          href="/admin/atribuciones"
          prefetch={false}
          className="btn glass-dark pointer-events-auto gap-1.5 px-4 py-2.5 text-[0.875rem] text-chalk"
        >
          <ArrowLeftIcon className="size-4" />
          {t.common.back}
        </Link>

        <div className="pointer-events-none flex flex-col items-end gap-0.5 pt-1">
          <CountUpStat value={hud.sent} label={t.admin.sent} active={mounted} delayMs={0} />
          <CountUpStat value={hud.opened} label={t.admin.opened} active={mounted} delayMs={85} />
          <CountUpStat value={hud.redeemed} label={t.admin.redeemed} active={mounted} delayMs={170} />
          <CountUpStat value={hud.billable} label={t.admin.attrBillable} active={mounted} delayMs={255} />
          <CountUpStat value={hud.maxHops} label={t.admin.maxHops} active={mounted} delayMs={340} />
        </div>
      </header>

      <div
        className="glass-dark pointer-events-auto fixed bottom-[7.5rem] left-3 z-20 max-h-[min(60dvh,19rem)] max-w-[13rem] overflow-y-auto p-3.5 transition-transform duration-300 ease-[var(--ease-out-soft)]"
        style={{ transform: legendOpen ? "translateX(0)" : "translateX(-120%)" }}
      >
        <p className="eyebrow text-chalk/40">{t.admin.saltosLegendTitle}</p>
        <p className="mt-0.5 text-[0.6875rem] leading-snug text-chalk/30">{t.admin.saltosLegendDesc}</p>
        <div className="mt-2 flex flex-col gap-1.5">
          {FUNNEL_ORDER.map((state) => {
            const isMutedRow = SALTOS_MUTED_STATES.has(state);
            return (
              <div key={state} className={cn("flex items-center gap-2 text-[0.75rem]", isMutedRow ? "text-chalk/45" : "text-chalk/75")}>
                <span
                  className="size-2.5 shrink-0 rounded-full"
                  style={{ background: SALTOS_STATE_COLOR[state], opacity: isMutedRow ? 0.55 : 1 }}
                />
                <span className="min-w-0 flex-1 truncate">{stateBadgeLabel(state, t)}</span>
                <span className="numeral text-[0.6875rem] text-chalk/40">{funnelCounts.get(state) ?? 0}</span>
              </div>
            );
          })}
        </div>
        <div className="mt-3 flex items-end gap-2.5 border-t border-white/8 pt-2.5">
          <span className="block size-[7px] rounded-full bg-chalk/25" />
          <span className="block size-[13px] rounded-full bg-chalk/25" />
          <span className="block size-[21px] rounded-full bg-chalk/25" />
          <p className="text-[0.625rem] leading-tight text-chalk/40">{t.admin.saltosSizeLegend}</p>
        </div>
      </div>

      <footer className="pointer-events-none fixed inset-x-0 bottom-0 z-20 flex flex-col items-center gap-3 px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
        {!selectedNode && !touched ? (
          <p className="text-[0.65625rem] text-chalk/32 transition-opacity duration-300">
            {funnelTotal === 0 ? t.admin.referralMapEmpty : t.admin.referralMapHint}
          </p>
        ) : null}
        {/* La ficha (z-30, opaca, ancho completo) se pinta encima de este footer
            (z-20) en cuanto hay un nodo seleccionado: sin ocultarlos aquí, estos
            dos botones quedaban tapados y sin forma de tocarlos hasta cerrar la
            ficha con su propio botón. */}
        <div className={cn("pointer-events-auto flex items-center gap-2", selectedNode ? "invisible" : "visible")}>
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

      <SaltosSheet
        node={selectedNode}
        giftedByName={giftedByName}
        invitedCount={selectedNode?.childCount ?? 0}
        color={selectedNode ? saltosNodeColor(selectedNode) : "var(--color-slate)"}
        stampsGoal={stampsGoal}
        locale={locale}
        t={t}
        onClose={() => setSelectedId(null)}
      />
    </div>
  );
}
