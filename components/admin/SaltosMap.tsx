"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeftIcon, CompassIcon, EyeIcon, EyeOffIcon, InfoIcon } from "@/components/ui/Icons";
import { SaltosSheet } from "@/components/admin/SaltosSheet";
import { cn } from "@/lib/cn";
import { bestPadrinoId, isExpiringSoon } from "@/lib/giftGraph/insights";
import { type Pan, panBy, pixelsToUnits, zoomAtPoint } from "@/lib/panZoom";
import { ESTABLISHMENT_RADIUS, layoutSaltos, SALTOS_PHASE_SIZE, type SaltosLayout, type SaltosPoint } from "@/lib/giftGraph/saltosLayout";
import { stateBadgeLabel } from "@/lib/giftGraph/stateBadge";
import { isTap, type PointerPoint } from "@/lib/giftGraph/tapGesture";
import type { GiftGraph, Node, NodeState } from "@/lib/giftGraph/types";
import type { Dict, Locale } from "@/lib/i18n";

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
/** Amplitud del bamboleo de cada nodo: radial (unidades del viewBox) y angular (radianes) -globo de helio en un hilo flojo, no un radio de rueda rígido. */
const WOBBLE_AMPLITUDE = 6.5;
const WOBBLE_ANGULAR_AMPLITUDE = 0.075;
/** Avance por frame del punto que recorre las cadenas con canje reciente, su radio y el de su halo resplandeciente. */
const PULSE_STEP = 0.0035;
const PULSE_DOT_R = 0.95;
const PULSE_GLOW_R = PULSE_DOT_R * 3.2;
const DAY_MS = 24 * 60 * 60 * 1000;
/** Ventana de "canje reciente" para disparar el pulso: la misma que usa el negocio para el retorno. */
const RECENT_REDEMPTION_MS = 30 * DAY_MS;

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
 * enviada → caducada → abierta → se dio de alta → en ventana → nuevo
 * verificado → directo. "discarded" no tiene hueco en el embudo de
 * invitación de 5 pasos, pero los nodos descartados existen de verdad, así
 * que se enseñan igual, al final del arco, en vez de desaparecer en
 * silencio. "direct" tampoco viene de ese embudo -es alta directa por
 * QR-, pero este mapa ya no es solo "el embudo de invitación": es donde
 * el dueño cuenta cuántos clientes tiene en total, así que se enseña
 * junto a "nuevo verificado", el otro estado que también es dinero de
 * verdad.
 */
const FUNNEL_ORDER: NodeState[] = ["sent", "expired", "opened", "claimed", "window", "billable", "direct", "discarded"];

/**
 * Colores literales por fase del camino del cliente -no los tokens del
 * diseño compartido (lib/giftGraph/stateBadge.ts)-: la especificación de
 * esta vista pide valores exactos, propios de la constelación, que no
 * tienen por qué existir en la paleta del resto del panel.
 *
 * Blanco (prospecto) → cian vivo -38E1FF- (ya es cliente real, pero
 * todavía provisional: se dio de alta o está en ventana) → ámbar -FBBF24-
 * (abrió el enlace: ya demostró interés, pero sigue siendo un
 * prospecto, no comparte color con nada verificado) → magenta -FF00F9-
 * (nuevo verificado: hizo su primer consumo pagado después de canjear la
 * invitación -la definición exacta de "Cliente Nuevo Verificado" de
 * lib/attribution.ts-, el hito que de verdad factura al local, así que
 * lleva el color más alto de contraste de todo el mapa) → verde lima
 * -E9FF72- (alta directa, siempre en primera línea) → negro con borde
 * blanco (descartada/caducada, sin historia que seguir contando -el
 * borde es el que las hace visibles sobre un fondo igual de oscuro que
 * su propio relleno-).
 */
const SALTOS_PHASE_COLOR: Record<NodeState, string> = {
  sent: "#FFFFFF",
  opened: "#FBBF24",
  claimed: "#38E1FF",
  window: "#38E1FF",
  billable: "#FF00F9",
  direct: "#E9FF72",
  discarded: "#000000",
  expired: "#000000",
};

/** Borde de cada punto: el mismo casi invisible de siempre, salvo en los dos negros -sin él, se funden con el fondo. */
const SALTOS_STROKE_COLOR: Record<NodeState, string> = {
  sent: "rgba(255,255,255,.16)",
  opened: "rgba(255,255,255,.16)",
  claimed: "rgba(255,255,255,.16)",
  window: "rgba(255,255,255,.16)",
  billable: "rgba(255,255,255,.16)",
  direct: "rgba(255,255,255,.16)",
  discarded: "rgba(255,255,255,.85)",
  expired: "rgba(255,255,255,.85)",
};

/**
 * Color del arco del embudo y de su etiqueta numérica: el mismo de cada
 * fase, salvo en los dos negros -un trazo o un texto negro sobre el
 * fondo casi negro del mapa no se ve, y ahí no hay forma de ponerles un
 * borde como al punto-. Gris claro en su lugar: sigue leyéndose "menos
 * importante" que los colores vivos, pero sin desaparecer.
 */
const SALTOS_ARC_COLOR: Record<NodeState, string> = {
  ...SALTOS_PHASE_COLOR,
  discarded: "rgba(255,255,255,.55)",
  expired: "rgba(255,255,255,.55)",
};

/**
 * Jerarquía visual, no solo de color: este es el mapa que el dueño del
 * local quiere dejar abierto en un monitor y ver crecer día a día, así
 * que los dos estados que son dinero de verdad -"nuevo verificado" y
 * "directo"- llevan el glow que respira; las dos salidas sin historia
 * (caducada, descartada) se retiran del resto de elementos que las
 * rodean -enlace, arco, fila de leyenda- en vez de competir por la
 * atención.
 */
const SALTOS_POSITIVE_STATES = new Set<NodeState>(["billable", "direct"]);
const SALTOS_MUTED_STATES = new Set<NodeState>(["expired", "discarded"]);

/** Color real de un nodo, para el propio punto, sus enlaces y su ficha. */
function saltosNodeColor(node: Node): string {
  return SALTOS_PHASE_COLOR[node.state];
}

/** Igual que saltosNodeColor, pero segura para trazo/texto: el negro de descartada/caducada no se ve sobre un fondo igual de oscuro. */
function safeLineColor(node: Node): string {
  return SALTOS_MUTED_STATES.has(node.state) ? SALTOS_ARC_COLOR[node.state] : saltosNodeColor(node);
}

/**
 * "En ventana" no es un tamaño fijo: arranca en SALTOS_PHASE_SIZE.window
 * (igual que el canje que la abre) y se encoge un 4% por cada día que
 * pasa sin resolverse -sin bajar nunca de WINDOW_SIZE_FLOOR-, y parpadea
 * cada vez más rápido cuantos menos días le quedan de los
 * `returnWindowDays` del local: la cuenta atrás se ve, no hay que abrir
 * la ficha para saber que a esa rama le queda poco.
 */
const WINDOW_SHRINK_PER_DAY = 0.04;
const WINDOW_SIZE_FLOOR = 0.45;
/** Parpadeo del más lento (recién entrado en ventana) al más rápido (a punto de resolverse), en segundos. */
const WINDOW_BLINK_SLOWEST_S = 6;
const WINDOW_BLINK_FASTEST_S = 0.6;

function windowSizeMultiplier(daysElapsed: number): number {
  return Math.max(WINDOW_SIZE_FLOOR, 1 - WINDOW_SHRINK_PER_DAY * daysElapsed);
}

function windowBlinkDurationS(daysRemaining: number, returnWindowDays: number): number {
  const t = clamp(daysRemaining / Math.max(1, returnWindowDays), 0, 1);
  return WINDOW_BLINK_FASTEST_S + t * (WINDOW_BLINK_SLOWEST_S - WINDOW_BLINK_FASTEST_S);
}

type PointerState = { x: number; y: number };
type XY = { x: number; y: number };

/**
 * Semillas del bamboleo: por índice de aparición, no por hash -así lo
 * pide la especificación-. Dos ejes independientes y desincronizados
 * entre sí -radial y angular, cada uno con su propia frecuencia y fase-,
 * para que el nodo no se limite a acercarse y alejarse en línea recta
 * como un radio de rueda: un globo de helio amarrado con un hilo muy
 * ligero también se balancea de lado a lado, y ese balanceo no va a la
 * vez que el vaivén de acercarse/alejarse. Frecuencias bajas a propósito
 * -períodos de varios segundos-: rápido se lee como cuerda tensa
 * vibrando, lento se lee como cuerda floja meciéndose con la brisa.
 */
function wobbleFreq(index: number): number {
  return 0.16 + ((index * 37) % 13) / 34;
}
function wobblePhase(index: number): number {
  return index * 1.87;
}
function wobbleFreqAngular(index: number): number {
  return 0.11 + ((index * 53) % 17) / 44;
}
function wobblePhaseAngular(index: number): number {
  return index * 2.63;
}

function nodeXY(point: { angle: number; ringRadius: number; depth: number }): XY {
  if (point.depth === 0) return { x: 0, y: 0 };
  return { x: point.ringRadius * Math.cos(point.angle), y: point.ringRadius * Math.sin(point.angle) };
}

/** Misma posición que nodeXY, pero con la rotación de fondo y el bamboleo del nodo -radial y angular- ya aplicados. */
function animatedXY(point: SaltosPoint, rotation: number, nowMs: number): XY {
  if (point.depth === 0) return { x: 0, y: 0 };
  const t = nowMs / 1000;
  const radialWobble = Math.sin(t * wobbleFreq(point.index) + wobblePhase(point.index)) * WOBBLE_AMPLITUDE;
  const angularWobble = Math.sin(t * wobbleFreqAngular(point.index) + wobblePhaseAngular(point.index)) * WOBBLE_ANGULAR_AMPLITUDE;
  const r = point.ringRadius + radialWobble;
  const angle = point.angle + rotation + angularWobble;
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

/** Puntos deterministas -sin Math.random(), igual que el resto del repo- fuera del grupo de zoom. */
const STAR_COUNT = 320;

function starfield(vb: number): { x: number; y: number; r: number; o: number }[] {
  const stars = [];
  for (let i = 0; i < STAR_COUNT; i++) {
    const angle = (i * 2.399963) % (2 * Math.PI); // ángulo dorado: reparte los puntos sin amontonarse
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
  returnWindowDays,
  locale,
  t,
}: {
  graph: GiftGraph;
  shopName: string;
  stampsGoal: number;
  /** Ventana de retorno del local, en días: gobierna cuánto se encoge y cada vez más rápido parpadea un nodo "en ventana". */
  returnWindowDays: number;
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
  const [hudVisible, setHudVisible] = useState(true);
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
  const pulseDotRefs = useRef(new Map<string, SVGGElement>());
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
      for (const [key, groupEl] of pulseDotRefs.current) {
        const pathEl = linkRefs.current.get(key);
        if (!pathEl || !groupEl) continue;
        const length = pathEl.getTotalLength();
        const point = pathEl.getPointAtLength(length * pulseT);
        groupEl.setAttribute("transform", `translate(${point.x.toFixed(2)},${point.y.toFixed(2)})`);
        groupEl.setAttribute("opacity", pulseOpacity.toFixed(3));
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
        @keyframes saltos-alert-pulse { 0%, 100% { transform: scale(1); opacity: 0.12; } 50% { transform: scale(1.2); opacity: 0.4; } }
        @keyframes saltos-billable-glow { 0%, 100% { transform: scale(1); opacity: 0.22; } 50% { transform: scale(1.08); opacity: 0.32; } }
        @keyframes saltos-window-blink { 0%, 100% { opacity: 1; } 50% { opacity: 0.42; } }
        @keyframes saltos-sun-aura-a { 0%, 100% { transform: scale(1) translate(0, 0); opacity: 0.14; } 50% { transform: scale(1.14) translate(1.5%, -1%); opacity: 0.22; } }
        @keyframes saltos-sun-aura-b { 0%, 100% { transform: scale(1.06) translate(-1%, 1%); opacity: 0.1; } 50% { transform: scale(0.94) translate(1%, 1.5%); opacity: 0.18; } }
        @keyframes saltos-sun-aura-c { 0%, 100% { transform: scale(0.96) translate(1%, -1.5%); opacity: 0.07; } 50% { transform: scale(1.1) translate(-1.5%, 1%); opacity: 0.15; } }
        .saltos-alert-ring { transform-origin: center; transform-box: fill-box; animation: saltos-alert-pulse 2.6s ease-in-out infinite; }
        .saltos-billable-glow { transform-origin: center; transform-box: fill-box; animation: saltos-billable-glow 5s ease-in-out infinite; }
        .saltos-window-blink { animation: saltos-window-blink 3s ease-in-out infinite; }
        .saltos-sun-aura-a { transform-origin: center; transform-box: fill-box; animation: saltos-sun-aura-a 4.6s ease-in-out infinite; }
        .saltos-sun-aura-b { transform-origin: center; transform-box: fill-box; animation: saltos-sun-aura-b 6.3s ease-in-out infinite 0.6s; }
        .saltos-sun-aura-c { transform-origin: center; transform-box: fill-box; animation: saltos-sun-aura-c 7.9s ease-in-out infinite 1.3s; }
        @media (prefers-reduced-motion: reduce) {
          .saltos-alert-ring, .saltos-billable-glow, .saltos-window-blink,
          .saltos-sun-aura-a, .saltos-sun-aura-b, .saltos-sun-aura-c { animation: none; }
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
                  const isPositiveArc = SALTOS_POSITIVE_STATES.has(state);
                  const arcWidth = isPositiveArc ? 5.5 : isMutedArc ? 3 : 4.5;
                  const arcOpacity = isPositiveArc ? 0.95 : isMutedArc ? 0.4 : 0.85;
                  arcs.push(
                    <path
                      key={state}
                      d={arcPath(cursor, a1, arcRadius)}
                      fill="none"
                      stroke={SALTOS_ARC_COLOR[state]}
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
                      fill={SALTOS_ARC_COLOR[state]}
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
                stroke={toNode ? safeLineColor(toNode) : "rgba(245,247,245,0.22)"}
                strokeOpacity={opacity}
                strokeWidth={width}
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
            );
          })}

          {[...pulseLinkKeys].map((key) => {
            // Del mismo color que la cuerda por la que viaja, no de uno fijo:
            // el color de la propia rama, ya calculado para el enlace.
            const childId = key.split(">")[1];
            const childNode = childId ? byId.get(childId) : undefined;
            const pulseColor = childNode ? safeLineColor(childNode) : "var(--color-chalk)";
            return (
              <g
                key={key}
                ref={(el) => {
                  if (el) pulseDotRefs.current.set(key, el);
                  else pulseDotRefs.current.delete(key);
                }}
                opacity={0}
                className="pointer-events-none"
              >
                <circle r={PULSE_GLOW_R} fill={pulseColor} fillOpacity={0.5} filter="url(#saltos-soft)" />
                <circle r={PULSE_DOT_R} fill={pulseColor} />
              </g>
            );
          })}

          <g data-node-id={graph.establishment.id} className="cursor-pointer">
            {/* Aura de sol: tres círculos difuminados, cada uno con su propio período y
                retraso -no laten a la vez-, para que el borde de la corona ondule en vez
                de simplemente "respirar" en bloque, como el resto de los halos del mapa. */}
            <circle className="saltos-sun-aura-a" r={ESTABLISHMENT_RADIUS * 3.4} fill="var(--color-lime)" fillOpacity={0.14} filter="url(#saltos-soft)" />
            <circle className="saltos-sun-aura-b" r={ESTABLISHMENT_RADIUS * 3.9} fill="var(--color-lime)" fillOpacity={0.1} filter="url(#saltos-soft)" />
            <circle className="saltos-sun-aura-c" r={ESTABLISHMENT_RADIUS * 4.5} fill="var(--color-lime)" fillOpacity={0.07} filter="url(#saltos-soft)" />
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
            const isBest = node.id === bestPadrino;
            const isExpiringNode = expiringIds.has(node.id);
            const color = saltosNodeColor(node);
            const showLabel = node.claimed && (pan.scale >= LABEL_VISIBLE_SCALE || isSelected || isAncestor);
            // Jerarquía visual: lo bueno pesa más, lo perdido se retira -no
            // compiten por la atención a partes iguales-. Ver el comentario
            // de SALTOS_POSITIVE_STATES/SALTOS_MUTED_STATES más arriba.
            const isPositive = SALTOS_POSITIVE_STATES.has(node.state);
            const isMuted = SALTOS_MUTED_STATES.has(node.state);
            // Más visitas -sellos en la tarjeta actual, hasta completarla-,
            // aura más fuerte: un cliente que vuelve mucho se nota en el
            // mapa aunque su estado no cambie. Solo clientes reales, una
            // invitación pendiente no tiene visitas que contar.
            const visitBoost = node.claimed ? clamp(node.stamps / Math.max(1, stampsGoal), 0, 1) : 0;
            const haloFillOpacity = Math.min(0.6, (isPositive ? 0.24 : 0.13) * (1 + visitBoost * 0.9));
            const haloScale = (isPositive ? 2.15 : 1.85) * (1 + visitBoost * 0.35);
            const restOpacity = isMuted ? 0.55 : 1;

            // "En ventana" se encoge y parpadea cada vez más rápido cuantos
            // menos días le quedan de returnWindowDays. Ver el comentario de
            // windowSizeMultiplier/windowBlinkDurationS más arriba.
            const isWindow = node.state === "window" && node.redeemedAt != null;
            const daysElapsed = isWindow ? Math.max(0, (nowMs - new Date(node.redeemedAt as string).getTime()) / DAY_MS) : 0;
            const displayRadius = pt.nodeRadius * (isWindow ? windowSizeMultiplier(daysElapsed) : 1);
            const windowBlinkStyle = isWindow
              ? { animationDuration: `${windowBlinkDurationS(returnWindowDays - daysElapsed, returnWindowDays).toFixed(2)}s` }
              : undefined;

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
                  <circle className="saltos-alert-ring" r={displayRadius + 6} fill="none" stroke="var(--color-coral)" strokeWidth={1} />
                ) : null}
                {isBest ? <circle r={displayRadius * 2.1} fill="var(--color-amber)" fillOpacity={0.16} filter="url(#saltos-soft)" /> : null}

                <circle
                  className={isPositive ? "saltos-billable-glow" : undefined}
                  r={displayRadius * haloScale}
                  fill={color}
                  fillOpacity={haloFillOpacity}
                  filter="url(#saltos-soft)"
                />
                <circle className={isWindow ? "saltos-window-blink" : undefined} style={windowBlinkStyle} r={displayRadius} fill={color} />
                <circle r={displayRadius} fill="none" stroke={SALTOS_STROKE_COLOR[node.state]} strokeWidth={isMuted ? 0.9 : 0.55} />
                <circle r={Math.max(displayRadius + 7, 12)} fill="transparent" />

                {node.claimed ? (
                  <text
                    y={displayRadius + 7}
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

      {/* z-30, por encima de la leyenda y la columna de iconos (z-20): en viewports
          bajos -móvil en horizontal- la leyenda puede crecer hasta solaparse con la
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

        {/* Misma caja que la leyenda -mismo glass-dark translúcido, mismo tamaño
            de letra-, y ocultable con su propio icono en la columna de la derecha. */}
        {hudVisible ? (
          <div className="glass-dark pointer-events-none flex flex-col items-end gap-0.5 p-2.5" style={{ background: "rgba(10,14,13,0.32)" }}>
            <CountUpStat value={hud.sent} label={t.admin.sent} active={mounted} delayMs={0} />
            <CountUpStat value={hud.opened} label={t.admin.opened} active={mounted} delayMs={85} />
            <CountUpStat value={hud.redeemed} label={t.admin.redeemed} active={mounted} delayMs={170} />
            <CountUpStat value={hud.billable} label={t.admin.attrBillable} active={mounted} delayMs={255} />
            <CountUpStat value={hud.maxHops} label={t.admin.maxHops} active={mounted} delayMs={340} />
          </div>
        ) : null}
      </header>

      {/* La leyenda vive en el lateral izquierdo, suelta de la columna de iconos
          -que se queda a la derecha, junto al resto de controles-: son dos
          contenedores fixed independientes, no un único bloque apilado. */}
      <div className="pointer-events-none fixed inset-y-0 left-3 z-20 flex flex-col justify-end py-[max(1.25rem,env(safe-area-inset-bottom))]">
        <div
          className="glass-dark pointer-events-auto max-w-[16rem] p-3.5 transition-transform duration-300 ease-[var(--ease-out-soft)]"
          style={{
            transform: legendOpen ? "translateX(0)" : "translateX(-120%)",
            // Más transparente que el glass-dark de siempre -0.62 de opacidad-:
            // esta caja tapa buena parte de la constelación, así que deja
            // pasar más del mapa de detrás sin perder legibilidad -el blur
            // y el borde de glass-dark se quedan igual.
            background: "rgba(10,14,13,0.32)",
          }}
        >
          <p className="eyebrow text-chalk/40">{t.admin.saltosLegendTitle}</p>
          <p className="mt-0.5 text-[0.6875rem] leading-snug text-chalk/30">{t.admin.saltosLegendDesc}</p>
          <div className="mt-2 flex flex-col gap-1.5">
            {FUNNEL_ORDER.map((state) => {
              const isMutedRow = SALTOS_MUTED_STATES.has(state);
              // El propio punto de la leyenda ya es la burbuja a escala -mismo
              // multiplicador que dibuja el mapa-, así que enseña de un
              // vistazo que el tamaño también cuenta la fase del cliente.
              const swatchPx = 5 + SALTOS_PHASE_SIZE[state] * 6.5;
              return (
                <div key={state} className={cn("flex items-center gap-2 text-[0.75rem]", isMutedRow ? "text-chalk/45" : "text-chalk/75")}>
                  <span
                    className="flex shrink-0 items-center justify-center"
                    style={{ width: 21, height: 21 }}
                  >
                    <span
                      className="block rounded-full"
                      style={{
                        width: swatchPx,
                        height: swatchPx,
                        background: SALTOS_PHASE_COLOR[state],
                        opacity: isMutedRow ? 0.55 : 1,
                        border: isMutedRow ? `1px solid ${SALTOS_STROKE_COLOR[state]}` : undefined,
                      }}
                    />
                  </span>
                  <span className="min-w-0 flex-1 truncate">{stateBadgeLabel(state, t)}</span>
                  <span className="numeral text-[0.6875rem] text-chalk/40">{funnelCounts.get(state) ?? 0}</span>
                </div>
              );
            })}
          </div>
          <p className="mt-2.5 border-t border-white/8 pt-2.5 text-[0.625rem] leading-tight text-chalk/40">{t.admin.saltosSizeLegend}</p>
          <p className="mt-1.5 text-[0.625rem] leading-tight text-chalk/40">{t.admin.saltosBrightnessLegend}</p>
        </div>
      </div>

      {/* La ficha (z-30, opaca, ancho completo) se pinta encima de esta columna
          (z-20) en cuanto hay un nodo seleccionado: sin ocultarla aquí, los tres
          botones quedaban tapados y sin forma de tocarlos hasta cerrar la ficha
          con su propio botón. */}
      <div className="pointer-events-none fixed inset-y-0 right-3 z-20 flex flex-col items-center justify-end gap-2 py-[max(1.25rem,env(safe-area-inset-bottom))]">
        <div className={cn("pointer-events-auto flex flex-col items-center gap-2", selectedNode ? "invisible" : "visible")}>
          <button
            type="button"
            onClick={() => setLegendOpen((v) => !v)}
            aria-pressed={legendOpen}
            aria-label={t.admin.legend}
            className={cn("btn size-11", legendOpen ? "bg-lime text-ink" : "glass-dark text-chalk")}
          >
            <InfoIcon className="size-5" />
          </button>
          <button type="button" onClick={resetView} aria-label={t.admin.resetView} className="btn glass-dark size-11 text-chalk">
            <CompassIcon className="size-5" />
          </button>
          <button
            type="button"
            onClick={() => setHudVisible((v) => !v)}
            aria-pressed={hudVisible}
            aria-label={t.admin.saltosToggleHud}
            className={cn("btn size-11", hudVisible ? "bg-lime text-ink" : "glass-dark text-chalk")}
          >
            {hudVisible ? <EyeIcon className="size-5" /> : <EyeOffIcon className="size-5" />}
          </button>
        </div>
      </div>

      <footer className="pointer-events-none fixed inset-x-0 bottom-0 z-20 flex flex-col items-center gap-3 px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
        {!selectedNode && !touched ? (
          <p className="text-[0.65625rem] text-chalk/32 transition-opacity duration-300">
            {funnelTotal === 0 ? t.admin.referralMapEmpty : t.admin.referralMapHint}
          </p>
        ) : null}
      </footer>

      <SaltosSheet
        node={selectedNode}
        giftedByName={giftedByName}
        invitedCount={selectedNode?.childCount ?? 0}
        color={selectedNode ? safeLineColor(selectedNode) : "var(--color-slate)"}
        stampsGoal={stampsGoal}
        returnWindowDays={returnWindowDays}
        nowMs={nowMs}
        locale={locale}
        t={t}
        onClose={() => setSelectedId(null)}
      />
    </div>
  );
}
