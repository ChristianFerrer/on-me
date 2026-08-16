"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeftIcon, CompassIcon, EyeIcon, EyeOffIcon, InfoIcon, PulseIcon, SettingsIcon } from "@/components/ui/Icons";
import { ConstelacionSheet } from "@/components/admin/ConstelacionSheet";
import { cn } from "@/lib/cn";
import { bestPadrinoId, isExpiringSoon } from "@/lib/giftGraph/insights";
import { type Pan, panBy, pixelsToUnits, zoomAtPoint } from "@/lib/panZoom";
import { ESTABLISHMENT_RADIUS, layoutConstelacion, CONSTELACION_PHASE_SIZE, type ConstelacionLayout, type ConstelacionPoint } from "@/lib/giftGraph/constelacionLayout";
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
/** Fracción de displayRadius que ocupa el núcleo sólido de cada estrella -el resto es puro halo, para que el brillo pese más que el propio cuerpo, como una estrella real. */
const STAR_CORE_SCALE = 0.42;
/** Avance por frame del punto que recorre las cadenas con canje reciente, su radio y el de su halo resplandeciente. */
const PULSE_STEP = 0.0035;
const PULSE_DOT_R = 0.95;
const PULSE_GLOW_R = PULSE_DOT_R * 3.2;
const DAY_MS = 24 * 60 * 60 * 1000;
/** Ventana de "canje reciente" para disparar el pulso: la misma que usa el negocio para el retorno. */
const RECENT_REDEMPTION_MS = 30 * DAY_MS;

/**
 * "Magnitud" de cada estrella -tamaño, distancia al núcleo, grosor de su
 * cuerda y a qué zoom se le ve el nombre-, por consumo histórico real
 * -tarjetas completadas más la fracción de la que lleva en curso, no la
 * fase de su camino-: dos clientes "billable" pueden llevar consumos muy
 * distintos, y aquí es donde por fin se nota la diferencia. Propio de esta
 * vista -la que se parece a un cielo de verdad-, nunca de ConstelacionMap.
 *
 * Cinco clases discretas, como la magnitud aparente de una carta estelar
 * real -1ª a 5ª magnitud-, no una fórmula continua: dos consumos parecidos
 * caen en la misma clase en vez de temblar el layout por diferencias
 * mínimas entre vecinos. A más magnitud, más grande Y más lejos del
 * núcleo -pero dentro de su mismo anillo de profundidad, nunca cruzando
 * al siguiente: el tope (24) se queda bien por debajo de MIN_RING_GAP en
 * constelacionLayout.ts (36)-, así una estrella brillante se lee como su
 * propio punto de referencia en el cielo. Es justo lo contrario de un
 * cielo real -ahí, más lejos suele ser más tenue, no más grande-, a
 * propósito: aquí el radio tiene que contar quién es tu mejor cliente, no
 * imitar la física.
 */
const STAR_MAGNITUDE_CARD_THRESHOLDS = [0, 1, 2, 4, 7];
const STAR_MAGNITUDE_SIZE_MULTIPLIER = [0.82, 1, 1.22, 1.48, 1.8];
const STAR_MAGNITUDE_RADIUS_OFFSET = [0, 4, 9, 15, 24];
/** A más magnitud, el nombre se enseña ya a menos zoom -en una carta real solo las estrellas brillantes se etiquetan a simple vista, las tenues piden acercarse-. */
const STAR_MAGNITUDE_LABEL_SCALE = [LABEL_VISIBLE_SCALE, LABEL_VISIBLE_SCALE, 1.3, 1.15, 1.0];
/** A más magnitud, la cuerda hacia esa estrella es un poco más gruesa: en una carta real el trazo de la constelación se marca más hacia la estrella brillante. */
const STAR_MAGNITUDE_LINK_WIDTH_MULTIPLIER = [0.85, 0.92, 1, 1.15, 1.35];

function starMagnitudeTier(node: Node | undefined, stampsGoal: number): number {
  if (!node) return 0;
  const cardsWorth = node.cardsCompleted + node.stamps / Math.max(1, stampsGoal);
  let tier = 0;
  for (let i = 0; i < STAR_MAGNITUDE_CARD_THRESHOLDS.length; i++) {
    if (cardsWorth >= STAR_MAGNITUDE_CARD_THRESHOLDS[i]) tier = i;
  }
  return tier;
}

/**
 * Pasada de ajuste sobre el layout compartido -constelacionLayout.ts sigue
 * siendo exactamente el mismo para las dos vistas, sin tocar-: aquí, y
 * solo aquí, se reescriben el radio y el tamaño de cada punto según su
 * magnitud. El establecimiento (depth 0, el sol) no se toca. frameRadius
 * se reescala en la misma proporción que el punto más lejano, para que el
 * encuadre siga abarcando exactamente lo que hay que ver, ni más ni menos.
 */
function applyStarMagnitude(layout: ConstelacionLayout, nodes: Node[], stampsGoal: number): ConstelacionLayout {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const points = new Map<string, ConstelacionPoint>();
  let maxBefore = 0;
  let maxAfter = 0;
  for (const [id, pt] of layout.points) {
    if (pt.depth === 0) {
      points.set(id, pt);
      continue;
    }
    maxBefore = Math.max(maxBefore, pt.ringRadius);
    const tier = starMagnitudeTier(byId.get(id), stampsGoal);
    const nodeRadius = pt.nodeRadius * STAR_MAGNITUDE_SIZE_MULTIPLIER[tier];
    const ringRadius = pt.ringRadius + STAR_MAGNITUDE_RADIUS_OFFSET[tier];
    maxAfter = Math.max(maxAfter, ringRadius);
    points.set(id, { ...pt, nodeRadius, ringRadius });
  }
  const scale = maxBefore > 0 ? maxAfter / maxBefore : 1;
  return { ...layout, points, frameRadius: layout.frameRadius * scale };
}

/** Ventana de recencia para el titileo -no la de "canje reciente" del pulso, una propia: hoy mismo es lo más vivo posible, 60 días o más sin actividad es lo más apagado. */
const RECENT_LIVELINESS_WINDOW_DAYS = 60;

function livelinessFor(node: Node | undefined, nowMs: number): number {
  if (!node) return 0;
  const daysSince = Math.max(0, (nowMs - new Date(node.lastActivityAt).getTime()) / DAY_MS);
  return clamp(1 - daysSince / RECENT_LIVELINESS_WINDOW_DAYS, 0, 1);
}

/**
 * Efecto imán al tocar una sección del anillo: los nodos de esa misma
 * categoría son atraídos a lo largo de TODA la sección elegida -repartidos
 * por su propio rango angular, a MAGNET_TARGET_RADIUS_FACTOR del radio de
 * encuadre-, no apilados en un único punto medio; el resto se queda tal
 * cual, orbitando en su sitio de siempre, sin verse atraído a ninguna
 * parte -no se encoge hacia el núcleo-. `value` va de 0 (sin atracción: en
 * su órbita natural) a 1 (atraído del todo a su punto del anillo),
 * suavizado cuadro a cuadro -MAGNET_EASE- para que el imán tire, no
 * teletransporte. El reparto a lo largo de la sección usa el puesto de
 * cada nodo entre los de su misma categoría -categoryMemberRank, calculado
 * una vez por selección, no cada fotograma- con un margen a cada lado
 * -MAGNET_ARC_MARGIN- para no pegarlos justo al borde del arco.
 */
const MAGNET_EASE = 0.07;
/** Radio objetivo del imán -fracción del radio de encuadre-, y margen a cada lado del tramo de una sección, para no pegar ninguna esfera justo a su borde. */
const MAGNET_TARGET_RADIUS_FACTOR = 0.9;
const MAGNET_ARC_MARGIN = 0.08;

/** Punto objetivo -en coordenadas del mundo del SVG, ya convertido de ángulo+radio a x/y- cuando un nodo es atraído a su sección del anillo; `null` cuando no hay atracción. */
type MagnetTarget = XY | null;
type Magnet = { value: number; target: MagnetTarget };
const NO_MAGNET: Magnet = { value: 0, target: null };

/**
 * A diferencia de ConstelacionMap, aquí las líneas son rectas -ver
 * starLinkPath más abajo-, así que LINK_CURVE_BULGE/LINK_WOBBLE_AMPLITUDE
 * ya no dan forma al trazo que se pinta; se dejan porque linkBezier() -la
 * misma función geométrica compartida con ConstelacionMap, sin tocar- los
 * sigue usando para calcular c1/c2, aunque esta variante los ignore.
 */
const LINK_CURVE_BULGE = 0.22;
const LINK_WOBBLE_AMPLITUDE = 0.12;

function linkWobbleFreq(index: number): number {
  return 0.09 + ((index * 41) % 19) / 52;
}
function linkWobblePhase(index: number): number {
  return index * 3.14;
}

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
const CONSTELACION_PHASE_COLOR: Record<NodeState, string> = {
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
const CONSTELACION_STROKE_COLOR: Record<NodeState, string> = {
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
const CONSTELACION_ACCENT_COLOR: Record<NodeState, string> = {
  ...CONSTELACION_PHASE_COLOR,
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
const CONSTELACION_POSITIVE_STATES = new Set<NodeState>(["billable", "direct"]);
const CONSTELACION_MUTED_STATES = new Set<NodeState>(["expired", "discarded"]);

/** Color real de un nodo, para el propio punto, sus enlaces y su ficha. */
function constelacionNodeColor(node: Node): string {
  return CONSTELACION_PHASE_COLOR[node.state];
}

/** Igual que constelacionNodeColor, pero segura para trazo/texto: el negro de descartada/caducada no se ve sobre un fondo igual de oscuro. */
function safeLineColor(node: Node): string {
  return CONSTELACION_MUTED_STATES.has(node.state) ? CONSTELACION_ACCENT_COLOR[node.state] : constelacionNodeColor(node);
}

/**
 * "En ventana" no es un tamaño fijo: arranca en CONSTELACION_PHASE_SIZE.window
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

/**
 * Titileo de cada estrella: una animación CSS pura -constelacion-star-twinkle,
 * ver el <style> más abajo- que cada punto arranca con su propia duración y
 * retraso. El retraso sigue siendo puro índice de aparición -mismo criterio
 * determinista que el bamboleo (wobbleFreq/wobblePhase), no Math.random()-,
 * así que ninguna estrella titila a la vez que su vecina; pero la duración
 * base ya no es solo eso: `liveliness` (ver livelinessFor) la acelera para
 * un cliente con actividad reciente -titila vivo- y la alarga para uno
 * apagado -titila despacio, casi dormido-, como el centelleo real cambia
 * con la turbulencia. Es CSS, no otro cálculo dentro del bucle de rAF: el
 * navegador la anima solo, sin coste por fotograma.
 */
function twinkleDurationS(index: number, liveliness: number): number {
  const base = 2.6 + ((index * 29) % 11) / 3.1;
  return base * (1.6 - liveliness);
}
function twinkleDelayS(index: number): number {
  return ((index * 47) % 23) / 6.2;
}

function nodeXY(point: { angle: number; ringRadius: number; depth: number }): XY {
  if (point.depth === 0) return { x: 0, y: 0 };
  return { x: point.ringRadius * Math.cos(point.angle), y: point.ringRadius * Math.sin(point.angle) };
}

/**
 * Misma posición que nodeXY, pero con la rotación de fondo y el bamboleo
 * del nodo -radial y angular- ya aplicados, y el imán encima: `magnet.value`
 * va de 0 (sin categoría elegida, o esta esfera no es de la categoría
 * tocada: sigue en su órbita natural, sin tocarla) a 1 (atraído del todo
 * a `magnet.target`, un punto sobre la barra). Es una interpolación lineal
 * simple de la posición cartesiana, no polar -el objetivo ya no es "un
 * ángulo a tal radio" como con el anillo, es un punto fijo de la barra.
 */
function animatedXY(point: ConstelacionPoint, rotation: number, nowMs: number, magnet: Magnet = NO_MAGNET): XY {
  if (point.depth === 0) return { x: 0, y: 0 };
  const t = nowMs / 1000;
  const radialWobble = Math.sin(t * wobbleFreq(point.index) + wobblePhase(point.index)) * WOBBLE_AMPLITUDE;
  const angularWobble = Math.sin(t * wobbleFreqAngular(point.index) + wobblePhaseAngular(point.index)) * WOBBLE_ANGULAR_AMPLITUDE;
  const naturalAngle = point.angle + rotation + angularWobble;
  const naturalR = point.ringRadius + radialWobble;
  const naturalX = naturalR * Math.cos(naturalAngle);
  const naturalY = naturalR * Math.sin(naturalAngle);

  if (magnet.value > 0 && magnet.target) {
    return {
      x: naturalX + (magnet.target.x - naturalX) * magnet.value,
      y: naturalY + (magnet.target.y - naturalY) * magnet.value,
    };
  }
  return { x: naturalX, y: naturalY };
}

/**
 * Repartir a cada esfera a lo largo de toda la sección tocada -en vez de
 * apilarlas en un único punto medio- ya reduce mucho el solape, pero no lo
 * garantiza: una sección corta con muchos miembros, o el propio encogerse
 * hacia el núcleo al deseleccionar, siguen pudiendo dejar dos siluetas
 * demasiado cerca. Esta pasada, después de calcular la posición "deseada"
 * de cada esfera y antes de pintarla, empuja cada par que se invade -según
 * su propio radio visible, el mismo displayRadius que se pinta, no el
 * halo, que sí puede superponerse- lejos uno de otro. Un par de
 * iteraciones por fotograma bastan: no es una simulación física exacta,
 * solo lo justo para que ninguna silueta tape a otra sin que se note el
 * reacomodo como un salto brusco.
 */
const COLLISION_PADDING = 0.6;
const COLLISION_ITERATIONS = 10;
const COLLISION_MAGNET_THRESHOLD = 0.01;

function resolveCollisions(positions: XY[], radii: number[], iterations: number, padding: number): void {
  for (let iter = 0; iter < iterations; iter++) {
    for (let i = 0; i < positions.length; i++) {
      for (let j = i + 1; j < positions.length; j++) {
        const dx = positions[j].x - positions[i].x;
        const dy = positions[j].y - positions[i].y;
        const dist = Math.hypot(dx, dy) || 0.0001;
        const minDist = radii[i] + radii[j] + padding;
        if (dist >= minDist) continue;
        const push = (minDist - dist) / 2;
        const nx = dx / dist;
        const ny = dy / dist;
        positions[i].x -= nx * push;
        positions[i].y -= ny * push;
        positions[j].x += nx * push;
        positions[j].y += ny * push;
      }
    }
  }
}

type Bezier = { p0: XY; c1: XY; c2: XY; p1: XY };

/** Mapa vacío compartido -en vez de un `new Map()` en cada valor por defecto- para cuando linkBezier() se llama sin radios que recortar, como en algún test o llamada suelta. */
const EMPTY_RADIUS_MAP: Map<string, number> = new Map();

/**
 * Puntos de control de la curva Bézier cúbica de un enlace: van al radio
 * medio entre el anillo del padre y el del hijo, cada uno en su propio
 * ángulo, para que la rama gire suave hacia su hijo en vez de salir en
 * línea recta desde el centro. `rotation` es 0 para el primer pintado
 * estático -la base que siempre es correcta, se mueva o no el JS- y el
 * ángulo de fondo real cuando la anima el bucle de rAF.
 *
 * Factorizado aparte de linkPath() para que el pulso viajero (más abajo,
 * en el bucle de rAF) pueda evaluar un punto sobre la misma curva sin
 * tener que ir al DOM -path.getTotalLength()/getPointAtLength()-, que es
 * muchísimo más caro que la aritmética directa y, con muchos pulsos
 * activos a la vez, es la diferencia entre una página fluida y una que
 * se nota pesada.
 *
 * A ese arco base se le suma un abombamiento perpendicular a la línea
 * recta entre extremos -LINK_CURVE_BULGE más una respiración lenta que
 * varía con el tiempo, LINK_WOBBLE_AMPLITUDE-, para que la cuerda tenga
 * cuerpo propio y no sea solo dos puntos que se bambolean cada uno por su
 * lado: `index` -la posición del enlace en layout.links- es la semilla de
 * esa respiración, igual que point.index lo es del bamboleo de cada nodo.
 */
function linkBezier(
  layout: ConstelacionLayout,
  rotation: number,
  nowMs: number,
  fromId: string,
  toId: string,
  index = 0,
  magnetFrom: Magnet = NO_MAGNET,
  magnetTo: Magnet = NO_MAGNET,
  // Posición ya corregida por resolveCollisions -si el bucle de rAF la
  // calculó este fotograma-, para que la cuerda nazca exactamente donde
  // de verdad se pintó la esfera, no donde el imán la quería antes de
  // separarla de sus vecinas. Sin esto, con el imán activo la cuerda se
  // despegaba visualmente del punto -o del núcleo- en cuanto la
  // separación desplazaba a la esfera de su posición "deseada".
  p0Override?: XY,
  p1Override?: XY,
  // Radio visible de cada nodo -el mismo displayRadius que se pinta,
  // establishmentRadius para el propio local-, para recortar cada extremo
  // desde el centro hasta el borde de la esfera: sin esto la cuerda nacía
  // clavada en el centro de cada nodo, tapada por su propio relleno.
  radiusById: Map<string, number> = EMPTY_RADIUS_MAP,
): Bezier | null {
  const from = layout.points.get(fromId);
  const to = layout.points.get(toId);
  if (!from || !to) return null;

  const rawP0 = p0Override ?? animatedXY(from, rotation, nowMs, magnetFrom);
  const rawP1 = p1Override ?? animatedXY(to, rotation, nowMs, magnetTo);
  const r0 = from.depth === 0 ? ESTABLISHMENT_RADIUS : (radiusById.get(fromId) ?? 0);
  const r1 = to.depth === 0 ? ESTABLISHMENT_RADIUS : (radiusById.get(toId) ?? 0);
  const rawDx = rawP1.x - rawP0.x;
  const rawDy = rawP1.y - rawP0.y;
  const rawDist = Math.hypot(rawDx, rawDy) || 1;
  const ux = rawDx / rawDist;
  const uy = rawDy / rawDist;
  const p0 = { x: rawP0.x + ux * r0, y: rawP0.y + uy * r0 };
  const p1 = { x: rawP1.x - ux * r1, y: rawP1.y - uy * r1 };

  const midR = (from.ringRadius + to.ringRadius) / 2;
  // Desde el propio centro (radio 0) el ángulo del padre no significa nada:
  // el primer tramo sale recto, y ya curva a partir del segundo.
  const a0 = (from.depth === 0 ? to.angle : from.angle) + rotation;
  const a1 = to.angle + rotation;
  let c1 = { x: midR * Math.cos(a0), y: midR * Math.sin(a0) };
  let c2 = { x: midR * Math.cos(a1), y: midR * Math.sin(a1) };

  const dx = p1.x - p0.x,
    dy = p1.y - p0.y;
  const dist = Math.hypot(dx, dy) || 1;
  const nx = -dy / dist,
    ny = dx / dist; // perpendicular unitario a la línea recta entre extremos
  const breathe = Math.sin((nowMs / 1000) * linkWobbleFreq(index) + linkWobblePhase(index));
  const bulge = dist * (LINK_CURVE_BULGE + LINK_WOBBLE_AMPLITUDE * breathe);
  c1 = { x: c1.x + nx * bulge, y: c1.y + ny * bulge };
  c2 = { x: c2.x + nx * bulge, y: c2.y + ny * bulge };

  return { p0, c1, c2, p1 };
}

/**
 * A diferencia de ConstelacionMap -cuerdas orgánicas que se abomban y
 * ondulan, como cuerda floja de verdad-, aquí cada enlace es un trazo
 * recto y fino entre los mismos dos extremos ya recortados al borde de
 * cada esfera -linkBezier ya hace ese recorte; solo se ignoran sus puntos
 * de control c1/c2-, exactamente como las líneas de una carta estelar de
 * verdad entre una estrella y la siguiente.
 */
function starLinkPath(b: Bezier): string {
  return `M${b.p0.x.toFixed(2)},${b.p0.y.toFixed(2)} L${b.p1.x.toFixed(2)},${b.p1.y.toFixed(2)}`;
}

/** Punto sobre el propio trazo recto en el parámetro t -para el pulso viajero, mismo criterio que bezierPointAt en ConstelacionMap pero sin curva que evaluar. */
function starLinkPointAt(b: Bezier, t: number): XY {
  return { x: b.p0.x + (b.p1.x - b.p0.x) * t, y: b.p0.y + (b.p1.y - b.p0.y) * t };
}

function linkPath(
  layout: ConstelacionLayout,
  rotation: number,
  nowMs: number,
  fromId: string,
  toId: string,
  index = 0,
  magnetFrom: Magnet = NO_MAGNET,
  magnetTo: Magnet = NO_MAGNET,
  radiusById: Map<string, number> = EMPTY_RADIUS_MAP,
): string | null {
  const b = linkBezier(layout, rotation, nowMs, fromId, toId, index, magnetFrom, magnetTo, undefined, undefined, radiusById);
  if (!b) return null;
  return starLinkPath(b);
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

/**
 * Banda tipo Vía Láctea: una franja diagonal fija con más densidad de
 * puntos de fondo que el resto del cielo, como la propia galaxia se ve
 * más poblada en una noche despejada de verdad. Puramente decorativa -no
 * lee ningún dato del negocio-, y determinista igual que el resto del
 * fondo: `along` recorre la banda de punta a punta y `across` es la suma
 * de dos desplazamientos deterministas distintos, no uno solo, para que
 * la densidad caiga hacia los bordes de la franja en vez de cortar en
 * seco, el mismo efecto que un solo dado no puede dar pero la suma de dos
 * sí -la misma idea que un dado doble se agrupa más hacia el centro que
 * uno solo.
 */
const MILKY_WAY_ANGLE = 0.62;
const MILKY_WAY_COUNT = 220;
const MILKY_WAY_WIDTH_FRACTION = 0.22;

function milkyWayBand(vb: number): { x: number; y: number; r: number; o: number }[] {
  const stars = [];
  const dirX = Math.cos(MILKY_WAY_ANGLE);
  const dirY = Math.sin(MILKY_WAY_ANGLE);
  const perpX = -dirY;
  const perpY = dirX;
  const halfWidth = vb * MILKY_WAY_WIDTH_FRACTION;
  for (let i = 0; i < MILKY_WAY_COUNT; i++) {
    const along = (((i * 137) % 1000) / 1000) * (vb * 2.1) - vb * 1.05;
    const spread1 = (((i * 71) % 97) / 96) * 2 - 1;
    const spread2 = (((i * 53 + 19) % 89) / 88) * 2 - 1;
    const across = ((spread1 + spread2) / 2) * halfWidth;
    const r = 0.15 + ((i * 31) % 13) / 12 * 0.55;
    const o = 0.03 + ((i * 17) % 19) / 18 * 0.16;
    stars.push({ x: dirX * along + perpX * across, y: dirY * along + perpY * across, r, o });
  }
  return stars;
}

function starfield(vb: number): { x: number; y: number; r: number; o: number }[] {
  const stars = [];
  for (let i = 0; i < STAR_COUNT; i++) {
    const angle = (i * 2.399963) % (2 * Math.PI); // ángulo dorado: reparte los puntos sin amontonarse
    const radius = 60 + ((i * 53) % 97) / 97 * (vb * 1.05 - 60);
    const r = 0.2 + ((i * 31) % 17) / 16 * 0.9;
    const o = 0.04 + ((i * 19) % 23) / 22 * 0.28;
    stars.push({ x: Math.cos(angle) * radius, y: Math.sin(angle) * radius, r, o });
  }
  return stars.concat(milkyWayBand(vb));
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
 * Variante "cielo de verdad" de la constelación, pensada para comparar
 * lado a lado con ConstelacionMap: misma capa de datos, mismo layout
 * radial, mismo gesto de pan/zoom/imán -physically es el mismo mapa-, pero
 * pintada como un cielo nocturno de verdad en vez de un diagrama de
 * burbujas de color plano. Tres diferencias a propósito, las que pidió la
 * comparación: el núcleo es un sol -corona incluida-, no lleva el nombre
 * del local escrito encima, que en su lugar vive fuera del mapa en una
 * esquina; cada cliente es una estrella -un punto pequeño con su propio
 * brillo que titila, no una esfera de color plana-; y las cuerdas entre
 * ellas son líneas rectas y finas, como las de una carta estelar, no
 * cuerdas orgánicas que se abomban y ondulan.
 */
export function ConstelacionSolMap({
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
  // El layout radial en sí -profundidad, ángulo- sigue siendo el mismo que
  // ConstelacionMap; applyStarMagnitude es la pasada propia de esta vista,
  // la que reescribe radio y tamaño según el consumo de cada estrella.
  const layout = useMemo(
    () => applyStarMagnitude(layoutConstelacion(graph.nodes, graph.edges, graph.establishment.id), graph.nodes, stampsGoal),
    [graph, stampsGoal],
  );
  const byId = useMemo(() => new Map(graph.nodes.map((n) => [n.id, n])), [graph.nodes]);
  const parentOf = useMemo(() => new Map(graph.edges.map((e) => [e.to, e.from])), [graph.edges]);
  // giftedAt del propio enlace entrante: cuándo se envió la invitación que trajo
  // a ese nodo -no lastActivityAt, que para un cliente real es su última visita,
  // no la fecha de envío-.
  const sentAtById = useMemo(() => new Map(graph.edges.map((e) => [e.to, e.giftedAt])), [graph.edges]);
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
  const frameRadius = layout.frameRadius;

  // Rango angular -inicio y fin, no solo el punto medio- de cada sección
  // del anillo, para el efecto imán: misma geometría -GAP, ángulo de
  // arranque, spanTotal- que el propio dibujado del anillo en el JSX, así
  // que si uno cambia el otro tiene que cambiar igual o dejan de apuntar
  // al mismo sitio.
  const arcAngleRangeByState = useMemo(() => {
    const map = new Map<NodeState, { start: number; end: number }>();
    if (funnelTotal === 0) return map;
    const GAP = 0.04;
    let cursor = -Math.PI / 2 + 0.05;
    const spanTotal = Math.PI * 2 - 0.26;
    for (const state of FUNNEL_ORDER) {
      const count = funnelCounts.get(state) ?? 0;
      if (count === 0) continue;
      const span = (spanTotal * count) / funnelTotal;
      const a1 = cursor + span - GAP;
      map.set(state, { start: cursor, end: a1 });
      cursor = a1 + GAP;
    }
    return map;
  }, [funnelCounts, funnelTotal]);

  // Puesto de cada nodo entre los de su misma categoría -y cuántos son en
  // total-, para repartirlos en orden a lo largo de la sección de la barra
  // en vez de apilarlos todos en su punto medio. Mismo orden estable que
  // point.index -la propia iteración de layout.points-, así que dos
  // nodos vecinos en el anillo también quedan cerca al converger.
  const categoryMemberRank = useMemo(() => {
    const byState = new Map<NodeState, string[]>();
    for (const point of layout.points.values()) {
      if (point.depth === 0) continue;
      const node = byId.get(point.id);
      if (!node) continue;
      const ids = byState.get(node.state) ?? [];
      ids.push(point.id);
      byState.set(node.state, ids);
    }
    const map = new Map<string, { rank: number; count: number }>();
    for (const ids of byState.values()) {
      ids.forEach((id, rank) => map.set(id, { rank, count: ids.length }));
    }
    return map;
  }, [layout, byId]);

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

  // Encuadre automático: el viewBox es el borde más lejano de todos
  // -frameRadius- más un margen fijo. Un viewBox cuadrado con "xMidYMid
  // meet" ya reparte eso solo en cualquier proporción de pantalla, así que
  // no hace falta recalcular en el resize: es una propiedad de cómo SVG
  // escala un viewBox, no algo que dependa de los píxeles reales del
  // contenedor -ni tampoco de la rotación de fondo, que gira dentro de ese
  // margen sin llegar nunca a asomar fuera de él.
  const half = frameRadius + VIEWBOX_PADDING;
  const size = half * 2;
  const stars = useMemo(() => starfield(half), [half]);

  const [pan, setPan] = useState<Pan>({ x: 0, y: 0, scale: 1 });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // Categoría del anillo tocada, para el efecto imán: se lee dentro del
  // bucle de rAF -que no vuelve a montarse en cada cambio de estado, solo
  // cuando cambia `layout`-, así que también vive en un ref sincronizado.
  const [selectedCategory, setSelectedCategory] = useState<NodeState | null>(null);
  const selectedCategoryRef = useRef<NodeState | null>(null);
  // Se queda con la última categoría real -no se limpia al deseleccionar-
  // para que, mientras el imán suaviza el valor de vuelta a 0, siga
  // sabiendo hacia qué ángulo estaba tirando -si no, el nodo saltaría de
  // golpe a su posición natural en cuanto `selectedCategory` pasa a null,
  // en vez de soltarse poco a poco.
  const lastCategoryRef = useRef<NodeState | null>(null);
  // Copia en estado -no solo en el ref de arriba, que el render no puede
  // leer- de la última categoría real: así el panel inferior derecho puede
  // seguir mostrando su número y descripción mientras se desvanece hacia
  // fuera, en lugar de vaciarse de golpe en cuanto se deselecciona.
  const [lastCategory, setLastCategory] = useState<NodeState | null>(null);
  useEffect(() => {
    selectedCategoryRef.current = selectedCategory;
    if (selectedCategory) {
      lastCategoryRef.current = selectedCategory;
      // Diferido a un microtask -mismo patrón que el snapshot de
      // ConstelacionSheet-: evita el aviso de "cascading renders" sin retrasar
      // visualmente el cambio.
      queueMicrotask(() => setLastCategory(selectedCategory));
    }
  }, [selectedCategory]);
  const arcAngleRangeRef = useRef(new Map<NodeState, { start: number; end: number }>());
  useEffect(() => {
    arcAngleRangeRef.current = arcAngleRangeByState;
  }, [arcAngleRangeByState]);
  const categoryMemberRankRef = useRef(new Map<string, { rank: number; count: number }>());
  useEffect(() => {
    categoryMemberRankRef.current = categoryMemberRank;
  }, [categoryMemberRank]);

  // El radio visible de cada esfera -mismo cálculo que displayRadius más
  // abajo en el JSX, "en ventana" incluido-, para que la pasada de
  // separación del imán (bucle de rAF) sepa cuánto hueco necesita cada
  // nodo sin duplicar esa cuenta ni desincronizarse de lo que de verdad
  // se pinta.
  const nodeRadiusById = useMemo(() => {
    const map = new Map<string, number>();
    for (const node of graph.nodes) {
      const pt = layout.points.get(node.id);
      if (!pt) continue;
      const isWindow = node.state === "window" && node.redeemedAt != null;
      const daysElapsed = isWindow ? Math.max(0, (nowMs - new Date(node.redeemedAt as string).getTime()) / DAY_MS) : 0;
      map.set(node.id, pt.nodeRadius * (isWindow ? windowSizeMultiplier(daysElapsed) : 1));
    }
    return map;
  }, [graph.nodes, layout, nowMs]);
  const nodeRadiusRef = useRef(new Map<string, number>());
  useEffect(() => {
    nodeRadiusRef.current = nodeRadiusById;
  }, [nodeRadiusById]);
  const [legendOpen, setLegendOpen] = useState(true);
  const [hudVisible, setHudVisible] = useState(true);
  /** Ajuste propio de esta vista -no existe en ConstelacionMap-: oculta las líneas que van del sol a un cliente sin padrino (alta directa por QR), que en un local con muchas suelen ser la mayoría del ruido visual alrededor del núcleo. */
  const [hideDirectLinks, setHideDirectLinks] = useState(false);
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
  const tapCandidate = useRef<{ pointerId: number; nodeId: string | null; arcState: NodeState | null; down: PointerPoint } | null>(null);

  // Refs para el bucle de rAF: se escriben atributos DOM directamente en
  // cada frame -rotación y bamboleo-, sin pasar por setState ni volver a
  // renderizar React 60 veces por segundo.
  const nodeRefs = useRef(new Map<string, SVGGElement>());
  const linkRefs = useRef(new Map<string, SVGPathElement>());
  const pulseDotRefs = useRef(new Map<string, SVGGElement>());
  const rotationRef = useRef(0);
  const pausedRef = useRef(false);
  const resumeTimer = useRef<number | null>(null);
  /** Valor de imán ya suavizado por nodo -ver MAGNET_EASE-, para no saltar de golpe al elegir/quitar una categoría. */
  const magnetRef = useRef(new Map<string, number>());
  /** Índice estable de cada enlace dentro de layout.links, semilla de la respiración de su curva -ver linkBezier-. */
  const linkIndexOf = useMemo(() => new Map(layout.links.map((l, i) => [`${l.fromId}>${l.toId}`, i])), [layout.links]);

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

      // Imán: objetivo 0/1 según si el nodo es de la categoría tocada,
      // suavizado hacia ese objetivo en vez de saltar de golpe. Las que no
      // son de la categoría elegida se quedan en 0 -su órbita natural, sin
      // atracción alguna- en vez de encogerse hacia el núcleo.
      const category = selectedCategoryRef.current;
      for (const point of layout.points.values()) {
        if (point.depth === 0) continue;
        const node = byId.get(point.id);
        const target = category && node?.state === category ? 1 : 0;
        const cur = magnetRef.current.get(point.id) ?? 0;
        magnetRef.current.set(point.id, cur + (target - cur) * MAGNET_EASE);
      }

      // El objetivo de atracción usa la ÚLTIMA categoría real -no la actual,
      // que puede ya ser null tras deseleccionar-, para que el valor de
      // imán pueda seguir suavizándose de vuelta a 0 sin saltar de golpe.
      const range = lastCategoryRef.current ? arcAngleRangeRef.current.get(lastCategoryRef.current) : undefined;
      const targetRadius = frameRadius * MAGNET_TARGET_RADIUS_FACTOR;
      function magnetFor(id: string): Magnet {
        const value = magnetRef.current.get(id) ?? 0;
        if (value <= 0 || range == null) return { value, target: null };
        const entry = categoryMemberRankRef.current.get(id);
        // Puesto normalizado (0..1) entre los de su misma categoría -0.5 si
        // no se conoce o es el único-, repartido con un margen a cada lado
        // para no pegar ninguna esfera justo al borde del arco.
        const t = entry && entry.count > 1 ? entry.rank / (entry.count - 1) : 0.5;
        const margin = MAGNET_ARC_MARGIN * (range.end - range.start);
        const angle = range.start + margin + t * (range.end - range.start - margin * 2);
        return { value, target: { x: targetRadius * Math.cos(angle), y: targetRadius * Math.sin(angle) } };
      }

      // Posición "deseada" de cada esfera -imán ya aplicado, todavía sin
      // separar de sus vecinas-, más su radio visible: solo hace falta la
      // pasada de separación cuando el imán anda tirando de verdad -si no,
      // el reposo natural del anillo ya evita el solape por construcción, y
      // recorrer 80-90 pares cada fotograma sería trabajo de sobra.
      const nodeIds: string[] = [];
      const nodePositions: XY[] = [];
      const nodeRadii: number[] = [];
      let magnetActive = false;
      for (const point of layout.points.values()) {
        if (point.depth === 0) continue;
        const magnet = magnetFor(point.id);
        if (magnet.value > COLLISION_MAGNET_THRESHOLD) magnetActive = true;
        nodeIds.push(point.id);
        nodePositions.push(animatedXY(point, rotation, now, magnet));
        nodeRadii.push(nodeRadiusRef.current.get(point.id) ?? 4);
      }
      if (magnetActive) resolveCollisions(nodePositions, nodeRadii, COLLISION_ITERATIONS, COLLISION_PADDING);

      const correctedById = new Map<string, XY>();
      for (let i = 0; i < nodeIds.length; i++) {
        correctedById.set(nodeIds[i], nodePositions[i]);
        const el = nodeRefs.current.get(nodeIds[i]);
        if (!el) continue;
        const { x, y } = nodePositions[i];
        el.setAttribute("transform", `translate(${x.toFixed(2)},${y.toFixed(2)})`);
      }

      // El espinazo de cada enlace -sus dos extremos ya recortados al borde
      // de la esfera- se calcula una sola vez por fotograma y se reutiliza
      // para el pulso viajero de más abajo. Sus extremos parten de la MISMA
      // posición ya corregida de arriba -correctedById-, así la línea nunca
      // se despega de la esfera que conecta aunque la separación la haya
      // movido de su punto "deseado".
      const linkSpineByKey = new Map<string, Bezier>();
      for (const link of layout.links) {
        const key = `${link.fromId}>${link.toId}`;
        const index = linkIndexOf.get(key) ?? 0;
        const spine = linkBezier(
          layout,
          rotation,
          now,
          link.fromId,
          link.toId,
          index,
          magnetFor(link.fromId),
          magnetFor(link.toId),
          correctedById.get(link.fromId),
          correctedById.get(link.toId),
          nodeRadiusRef.current,
        );
        if (!spine) continue;
        linkSpineByKey.set(key, spine);
        const pathEl = linkRefs.current.get(key);
        if (pathEl) pathEl.setAttribute("d", starLinkPath(spine));
      }

      pulseT = (pulseT + PULSE_STEP) % 1;
      const pulseOpacity = Math.sin(pulseT * Math.PI) * 0.85;
      for (const [key, groupEl] of pulseDotRefs.current) {
        if (!groupEl) continue;
        const spine = linkSpineByKey.get(key);
        if (!spine) continue;
        const point = starLinkPointAt(spine, pulseT);
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
      const arcEl = targetEl.closest?.("[data-arc-state]");
      tapCandidate.current = {
        pointerId: event.pointerId,
        nodeId: nodeEl?.getAttribute("data-node-id") ?? null,
        arcState: (arcEl?.getAttribute("data-arc-state") as NodeState | null) ?? null,
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

  // Deliberadamente NO en onPointerLeave: dentro de la constelación cada nodo
  // apila varios círculos superpuestos (halo, aura, borde, círculo de toque
  // más grande que el propio punto...), y con tantas capas encima unas de
  // otras algunos navegadores táctiles disparan pointerleave sin que el
  // dedo haya salido de verdad del SVG -solo cambió de qué capa interna
  // está "debajo"-. Enganchado a endPointer, ese leave espurio soltaba el
  // dedo a media cuenta y el pellizco/arrastre se cortaba en seco, pero
  // solo dentro del área densa de nodos -fuera, sobre fondo vacío, no había
  // capas que cruzar y el gesto funcionaba bien. pointercancel y
  // lostpointercapture ya cubren el caso real de "el dedo se fue sin avisar".
  function endPointer(event: React.PointerEvent<SVGSVGElement>) {
    const pending = tapCandidate.current;
    pointers.current.delete(event.pointerId);

    if (pointers.current.size === 0) {
      dragOrigin.current = null;
      scheduleResumeMotion();
      if (pending && pending.pointerId === event.pointerId) {
        const up: PointerPoint = { x: event.clientX, y: event.clientY, t: Date.now() };
        if (isTap(pending.down, up, TAP_MAX_DISTANCE_PX, TAP_MAX_DURATION_MS)) {
          if (pending.arcState) setSelectedCategory((prev) => (prev === pending.arcState ? null : pending.arcState));
          else if (pending.nodeId && pending.nodeId !== graph.establishment.id) setSelectedId(pending.nodeId);
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
        <filter id="constelacion-grain">
          <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves={3} stitchTiles="stitch" />
        </filter>
        <rect width="100%" height="100%" filter="url(#constelacion-grain)" />
      </svg>

      <style>{`
        @keyframes constelacion-alert-pulse { 0%, 100% { transform: scale(1); opacity: 0.12; } 50% { transform: scale(1.2); opacity: 0.4; } }
        @keyframes constelacion-billable-glow { 0%, 100% { transform: scale(1); opacity: 0.22; } 50% { transform: scale(1.08); opacity: 0.32; } }
        @keyframes constelacion-window-blink { 0%, 100% { opacity: 1; } 50% { opacity: 0.42; } }
        /* Aura de sol tenue: picos a porcentajes irregulares -no 0/50/100%- para que
           el vaivén parezca aleatorio en vez de un "respirar" simétrico en bloque;
           cada capa además dura un número de segundos no múltiplo de las otras
           -ver más abajo-, así las tres nunca laten a la vez. */
        @keyframes constelacion-sun-aura-a {
          0%, 100% { transform: scale(1) translate(0, 0); opacity: 0.09; }
          22% { transform: scale(1.07) translate(1.1%, -0.6%); opacity: 0.13; }
          41% { transform: scale(0.97) translate(-0.7%, 0.9%); opacity: 0.07; }
          63% { transform: scale(1.1) translate(0.5%, 1.2%); opacity: 0.14; }
          78% { transform: scale(1.02) translate(-1%, -0.4%); opacity: 0.08; }
        }
        @keyframes constelacion-sun-aura-b {
          0%, 100% { transform: scale(1.03) translate(-0.6%, 0.5%); opacity: 0.07; }
          18% { transform: scale(0.96) translate(0.8%, -1%); opacity: 0.05; }
          47% { transform: scale(1.09) translate(-1%, -0.5%); opacity: 0.1; }
          69% { transform: scale(0.99) translate(1%, 0.8%); opacity: 0.06; }
          86% { transform: scale(1.05) translate(0.4%, -0.9%); opacity: 0.09; }
        }
        @keyframes constelacion-sun-aura-c {
          0%, 100% { transform: scale(0.98) translate(0.5%, -0.4%); opacity: 0.05; }
          27% { transform: scale(1.06) translate(-0.9%, 0.7%); opacity: 0.08; }
          52% { transform: scale(0.95) translate(0.6%, 1%); opacity: 0.04; }
          74% { transform: scale(1.04) translate(-0.5%, -0.8%); opacity: 0.07; }
          91% { transform: scale(1) translate(0.9%, 0.3%); opacity: 0.05; }
        }
        .constelacion-alert-ring { transform-origin: center; transform-box: fill-box; animation: constelacion-alert-pulse 2.6s ease-in-out infinite; }
        .constelacion-billable-glow { transform-origin: center; transform-box: fill-box; animation: constelacion-billable-glow 5s ease-in-out infinite; }
        .constelacion-window-blink { animation: constelacion-window-blink 3s ease-in-out infinite; }
        .constelacion-sun-aura-a { transform-origin: center; transform-box: fill-box; animation: constelacion-sun-aura-a 11.3s ease-in-out infinite; }
        .constelacion-sun-aura-b { transform-origin: center; transform-box: fill-box; animation: constelacion-sun-aura-b 8.7s ease-in-out infinite 0.6s; }
        .constelacion-sun-aura-c { transform-origin: center; transform-box: fill-box; animation: constelacion-sun-aura-c 14.1s ease-in-out infinite 1.3s; }
        @keyframes constelacion-star-twinkle { 0%, 100% { opacity: 1; } 50% { opacity: var(--twinkle-min, 0.55); } }
        .constelacion-star-twinkle { animation: constelacion-star-twinkle var(--twinkle-s, 4s) ease-in-out infinite; animation-delay: var(--twinkle-delay, 0s); }
        @media (prefers-reduced-motion: reduce) {
          .constelacion-alert-ring, .constelacion-billable-glow, .constelacion-window-blink,
          .constelacion-sun-aura-a, .constelacion-sun-aura-b, .constelacion-sun-aura-c,
          .constelacion-star-twinkle { animation: none; }
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
        onLostPointerCapture={endPointer}
        onDoubleClick={resetView}
        role="img"
        aria-label={t.admin.referralMap}
      >
        <defs>
          {/* El núcleo es un sol de verdad -degradado radial, no un color plano-,
              pero en el lima de siempre de la marca: casi blanco en el centro,
              hacia el lima vivo y un lima más oscuro y verdoso en el borde. */}
          <radialGradient id="constelacion-sun-core">
            <stop offset="0%" stopColor="#FBFFE8" />
            <stop offset="45%" stopColor="#E9FF72" />
            <stop offset="80%" stopColor="#B9E23A" />
            <stop offset="100%" stopColor="#7FA820" />
          </radialGradient>
          <radialGradient id="constelacion-hub-glow">
            <stop offset="0%" stopColor="var(--color-lime)" stopOpacity={0.45} />
            <stop offset="60%" stopColor="var(--color-lime)" stopOpacity={0.08} />
            <stop offset="100%" stopColor="var(--color-lime)" stopOpacity={0} />
          </radialGradient>
          {/*
            Aura reutilizable por color -"currentColor" hereda del `color` en
            línea del propio elemento-, en vez del `filter="url(#constelacion-soft)"`
            -un feGaussianBlur- que llevaba antes cada halo. Con un grafo real
            (70-90 nodos, ~30 con el glow que respira) un blur SVG animado en
            cada uno obliga al navegador a re-rasterizar ese halo entero en
            cada frame -software, sin acelerar por GPU en la mayoría de
            navegadores-, y era la causa principal de que el mapa se notara
            pesado. Un degradado radial da el mismo aspecto de resplandor
            suave sin ese coste: es una malla que la GPU compone directamente.
          */}
          <radialGradient id="constelacion-glow">
            <stop offset="0%" stopColor="currentColor" stopOpacity={1} />
            <stop offset="100%" stopColor="currentColor" stopOpacity={0} />
          </radialGradient>
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
                  const isMutedArc = CONSTELACION_MUTED_STATES.has(state);
                  const isPositiveArc = CONSTELACION_POSITIVE_STATES.has(state);
                  const isSelectedArc = state === selectedCategory;
                  const arcWidthBase = isPositiveArc ? 5.5 : isMutedArc ? 3 : 4.5;
                  const arcWidth = isSelectedArc ? arcWidthBase * 1.8 : arcWidthBase;
                  const arcOpacity = isPositiveArc ? 0.95 : isMutedArc ? 0.4 : 0.85;
                  const d = arcPath(cursor, a1, frameRadius);
                  arcs.push(
                    <g key={state} data-arc-state={state} className="cursor-pointer">
                      {/* Trazo ancho e invisible: el arco visible es fino -3 a 5.5 unidades-, así que sin esto tocarlo con el dedo es una lotería. */}
                      <path d={d} fill="none" stroke="transparent" strokeWidth={16} strokeLinecap="round" />
                      <path
                        d={d}
                        fill="none"
                        stroke={CONSTELACION_ACCENT_COLOR[state]}
                        strokeOpacity={arcOpacity}
                        strokeLinecap="round"
                        style={{ strokeWidth: arcWidth, transition: "stroke-width 320ms var(--ease-out-soft)" }}
                      />
                    </g>,
                  );
                  cursor = a1 + GAP;
                }
                return arcs;
              })()
            : null}

          {layout.links.map((link, linkIndex) => {
            const key = `${link.fromId}>${link.toId}`;
            const toNode = byId.get(link.toId);
            const d = linkPath(layout, 0, 0, link.fromId, link.toId, linkIndex, NO_MAGNET, NO_MAGNET, nodeRadiusById);
            if (!d) return null;
            const isPathLink = selectedId != null && ancestors.has(link.toId);
            // Mismo criterio que en los nodos: una rama que terminó en nada
            // -caducada, descartada- se retira visualmente en vez de pesar
            // igual que una que sigue viva.
            const isMutedLink = toNode != null && CONSTELACION_MUTED_STATES.has(toNode.state);
            const restOpacity = isMutedLink ? 0.14 : 0.3;
            const restWidth = isMutedLink ? 0.9 : 1.3;
            // Alta directa por QR, sin padrino real: el ajuste de la columna de
            // iconos puede apagar del todo estas líneas -son puro ruido alrededor
            // del sol en un local con muchas-, y da igual qué más esté pasando.
            const isDirectLink = toNode?.state === "direct";
            // Al tocar una sección del anillo, las líneas desaparecen del todo
            // -no solo se atenúan- mientras las esferas convergen: así se ve con
            // claridad quién va hacia dónde, sin cuerdas cruzándose por encima.
            const hiddenByCategory = selectedCategory != null;
            const opacity = hiddenByCategory || (hideDirectLinks && isDirectLink) ? 0 : selectedId ? (isPathLink ? 0.95 : 0.04) : restOpacity;
            // La cuerda hacia una estrella de más magnitud se marca un poco
            // más gruesa -en una carta real, el trazo de la constelación
            // pesa más hacia la estrella brillante que hacia la tenue-.
            const linkWidthMul = STAR_MAGNITUDE_LINK_WIDTH_MULTIPLIER[starMagnitudeTier(toNode, stampsGoal)];
            const width = (selectedId && isPathLink ? 2.2 : selectedId ? 1.1 : restWidth) * linkWidthMul;
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
                style={{ transition: "stroke-opacity 260ms var(--ease-out-soft)" }}
              />
            );
          })}

          {[...pulseLinkKeys]
            .filter((key) => {
              // Ningún pulso viajero flotando sobre una cuerda que ya no se ve:
              // mismo criterio de ocultación que la propia línea, arriba.
              if (selectedCategory != null) return false;
              if (!hideDirectLinks) return true;
              const childId = key.split(">")[1];
              return byId.get(childId ?? "")?.state !== "direct";
            })
            .map((key) => {
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
                <circle r={PULSE_GLOW_R} fill="url(#constelacion-glow)" fillOpacity={0.5} style={{ color: pulseColor }} />
                <circle r={PULSE_DOT_R} fill={pulseColor} />
              </g>
            );
          })}

          <g data-node-id={graph.establishment.id} className="cursor-pointer">
            {/* Aura de sol, tenue y sin rayos: tres círculos difuminados en el mismo
                lima del núcleo, cada uno con su propio período -no múltiplo del de
                los otros, para que nunca se sincronicen- y su propia secuencia de
                picos a porcentajes irregulares -22/41/63/78%, no 0/50/100%-, así el
                borde ondula con un vaivén de aspecto aleatorio en vez de "respirar"
                de forma pareja en bloque. Movimiento e intensidad deliberadamente
                sutiles: es un aura, no un foco. */}
            <circle className="constelacion-sun-aura-a" r={ESTABLISHMENT_RADIUS * 3.1} fill="url(#constelacion-glow)" fillOpacity={0.1} style={{ color: "var(--color-lime)" }} />
            <circle className="constelacion-sun-aura-b" r={ESTABLISHMENT_RADIUS * 3.6} fill="url(#constelacion-glow)" fillOpacity={0.07} style={{ color: "var(--color-lime)" }} />
            <circle className="constelacion-sun-aura-c" r={ESTABLISHMENT_RADIUS * 4.1} fill="url(#constelacion-glow)" fillOpacity={0.05} style={{ color: "var(--color-lime)" }} />
            <circle cx={0} cy={0} r={ESTABLISHMENT_RADIUS * 2.5} fill="url(#constelacion-hub-glow)" />
            {/* Sin nombre del local escrito encima -eso es justo lo que este mapa cambia
                respecto a ConstelacionMap-: el núcleo es solo el sol, el nombre vive
                fuera, en la esquina -ver la placa fija más abajo en el JSX. */}
            <circle cx={0} cy={0} r={ESTABLISHMENT_RADIUS} fill="url(#constelacion-sun-core)" />
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
            const color = constelacionNodeColor(node);
            // Magnitud de esta estrella -tamaño y distancia ya resueltos en
            // el layout vía applyStarMagnitude-, aquí para lo que todavía
            // depende del propio render: a qué zoom se le ve el nombre y
            // qué tan viva titila.
            const magnitudeTier = starMagnitudeTier(node, stampsGoal);
            const labelScale = STAR_MAGNITUDE_LABEL_SCALE[magnitudeTier];
            const showLabel = node.claimed && (pan.scale >= labelScale || isSelected || isAncestor);
            // Jerarquía visual: lo bueno pesa más, lo perdido se retira -no
            // compiten por la atención a partes iguales-. Ver el comentario
            // de CONSTELACION_POSITIVE_STATES/CONSTELACION_MUTED_STATES más arriba.
            const isPositive = CONSTELACION_POSITIVE_STATES.has(node.state);
            const isMuted = CONSTELACION_MUTED_STATES.has(node.state);
            // Más visitas -sellos en la tarjeta actual, hasta completarla-,
            // aura más fuerte: un cliente que vuelve mucho se nota en el
            // mapa aunque su estado no cambie. Solo clientes reales, una
            // invitación pendiente no tiene visitas que contar.
            const visitBoost = node.claimed ? clamp(node.stamps / Math.max(1, stampsGoal), 0, 1) : 0;
            // Mismo criterio que rootFanoutOffset en constelacionLayout.ts -a
            // partir del segundo invitado directo, hasta un tope de 6-, pero
            // aquí en intensidad, no en radio: una raíz directa (depth 1) con
            // mucho fan-out brilla más -su pequeña constelación se nota
            // también de lejos, no solo por estar más separada del sol-.
            const fanoutBoost = node.depth === 1 ? clamp((node.childCount - 1) / 5, 0, 1) : 0;
            const haloFillOpacity = Math.min(0.6, (isPositive ? 0.24 : 0.13) * (1 + visitBoost * 0.9 + fanoutBoost * 0.8));
            const haloScale = (isPositive ? 2.15 : 1.85) * (1 + visitBoost * 0.35 + fanoutBoost * 0.4);
            const restOpacity = isMuted ? 0.55 : 1;

            // "En ventana" se encoge y parpadea cada vez más rápido cuantos
            // menos días le quedan de returnWindowDays. Ver el comentario de
            // windowSizeMultiplier/windowBlinkDurationS más arriba.
            const isWindow = node.state === "window" && node.redeemedAt != null;
            const daysElapsed = isWindow ? Math.max(0, (nowMs - new Date(node.redeemedAt as string).getTime()) / DAY_MS) : 0;
            const displayRadius = pt.nodeRadius * (isWindow ? windowSizeMultiplier(daysElapsed) : 1);
            // Cada cliente es una estrella, no una esfera de color plana: un punto
            // pequeño y brillante -starCoreR, una fracción de displayRadius- con
            // un halo grande alrededor -haloScale ya calculado sobre displayRadius
            // entero, así que al encoger solo el núcleo el halo pesa proporcionalmente
            // más, justo el aspecto "brillo dominante, cuerpo casi invisible" de una
            // estrella real-. El resto de la geometría -halo, parpadeo, blanco de
            // toque- sigue midiéndose sobre displayRadius para no desincronizarse.
            const starCoreR = Math.max(displayRadius * STAR_CORE_SCALE, 0.7);
            const windowBlinkStyle = isWindow
              ? { animationDuration: `${windowBlinkDurationS(returnWindowDays - daysElapsed, returnWindowDays).toFixed(2)}s` }
              : undefined;
            const twinkleStyle = {
              "--twinkle-s": `${twinkleDurationS(pt.index, livelinessFor(node, nowMs)).toFixed(2)}s`,
              "--twinkle-delay": `${twinkleDelayS(pt.index).toFixed(2)}s`,
            } as React.CSSProperties;

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
                  <circle className="constelacion-alert-ring" r={displayRadius + 6} fill="none" stroke="var(--color-coral)" strokeWidth={1} />
                ) : null}
                {isBest ? (
                  <circle r={displayRadius * 2.1} fill="url(#constelacion-glow)" fillOpacity={0.16} style={{ color: "var(--color-amber)" }} />
                ) : null}

                <circle
                  className={isPositive ? "constelacion-billable-glow" : undefined}
                  r={displayRadius * haloScale}
                  fill="url(#constelacion-glow)"
                  fillOpacity={haloFillOpacity}
                  style={{ color }}
                />
                {/* El titileo y el parpadeo de "en ventana" son dos animaciones de
                    `opacity` distintas: en un mismo elemento, la última declarada en
                    la hoja de estilos se comía a la otra -CSS solo aplica una por
                    propiedad-, así que el titileo vive en el <g> que envuelve, y el
                    parpadeo en el propio círculo de dentro; sus opacidades se
                    multiplican al componerse, así que ambas se ven a la vez. */}
                <g className="constelacion-star-twinkle" style={twinkleStyle}>
                  <circle className={isWindow ? "constelacion-window-blink" : undefined} style={windowBlinkStyle} r={starCoreR} fill={color} />
                  <circle r={starCoreR} fill="none" stroke={CONSTELACION_STROKE_COLOR[node.state]} strokeWidth={isMuted ? 0.7 : 0.4} />
                </g>
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
        {/* A diferencia de ConstelacionMap -la portada del panel-, esta es una
            vista de comparación que cuelga de ella, así que el botón de la
            esquina vuelve a ser "volver a /admin", no el HomeIcon -> /inicio. */}
        <div className="flex flex-col items-start gap-2.5">
          <Link
            href="/admin"
            prefetch={false}
            className="btn glass-dark pointer-events-auto size-11 text-chalk"
            aria-label={t.admin.constelacionSolBack}
          >
            <ArrowLeftIcon className="size-5" />
          </Link>

          {/* El nombre del local, fuera del mapa -no escrito encima del sol, como
              en ConstelacionMap-: una placa fija en la esquina, tipo cartela de
              observatorio, ajena al SVG que se pellizca y arrastra. */}
          <div className="pointer-events-none flex flex-col gap-0.5 pl-1">
            <p className="text-[0.9375rem] font-semibold leading-tight text-chalk/90">{shopName}</p>
            <p className="eyebrow text-chalk/40">
              {t.admin.referralMap} · {customerCount} {t.admin.constelacionCustomersLabel}
            </p>
          </div>
        </div>

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

      {/* La leyenda vive en el lateral izquierdo, suelta de la columna de
          iconos -que se queda a la derecha, junto al resto de controles-:
          son contenedores fixed independientes, no un único bloque
          apilado. El propio anillo -selector de estado con el mismo
          efecto imán- vive dentro del SVG de arriba, no aquí: pertenece
          al mundo que se pellizca y arrastra, no a este overlay fijo. */}
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
          <p className="eyebrow text-chalk/40">{t.admin.constelacionLegendTitle}</p>
          <p className="mt-0.5 text-[0.6875rem] leading-snug text-chalk/30">{t.admin.constelacionLegendDesc}</p>
          <div className="mt-2 flex flex-col gap-1.5">
            {FUNNEL_ORDER.map((state) => {
              const isMutedRow = CONSTELACION_MUTED_STATES.has(state);
              // El propio punto de la leyenda ya es la burbuja a escala -mismo
              // multiplicador que dibuja el mapa-, así que enseña de un
              // vistazo que el tamaño también cuenta la fase del cliente.
              const swatchPx = 5 + CONSTELACION_PHASE_SIZE[state] * 6.5;
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
                        background: CONSTELACION_PHASE_COLOR[state],
                        opacity: isMutedRow ? 0.55 : 1,
                        border: isMutedRow ? `1px solid ${CONSTELACION_STROKE_COLOR[state]}` : undefined,
                      }}
                    />
                  </span>
                  <span className="min-w-0 flex-1 truncate">{stateBadgeLabel(state, t)}</span>
                  <span className="numeral text-[0.6875rem] text-chalk/40">{funnelCounts.get(state) ?? 0}</span>
                </div>
              );
            })}
          </div>
          <p className="mt-2.5 border-t border-white/8 pt-2.5 text-[0.625rem] leading-tight text-chalk/40">{t.admin.constelacionSizeLegend}</p>
          <p className="mt-1.5 text-[0.625rem] leading-tight text-chalk/40">{t.admin.constelacionBrightnessLegend}</p>
        </div>
      </div>

      {/* La ficha (z-30, opaca, ancho completo) se pinta encima de esta columna
          (z-20) en cuanto hay un nodo seleccionado: sin ocultarla aquí, los tres
          botones quedaban tapados y sin forma de tocarlos hasta cerrar la ficha
          con su propio botón. */}
      <div className="pointer-events-none fixed inset-y-0 right-3 z-20 flex flex-col items-center justify-end gap-2 py-[max(1.25rem,env(safe-area-inset-bottom))]">
        <div className={cn("pointer-events-none flex flex-col items-end gap-2", selectedNode ? "invisible" : "visible")}>
          {/* Número y descripción de la categoría del anillo tocada, con el
              mismo tratamiento visual que la leyenda -glass-dark, mismo tono
              translúcido- y ajustado al tamaño del texto en vez de a un
              ancho fijo. Se queda montado con `lastCategory` para poder
              desvanecerse hacia fuera al deseleccionar, igual que la leyenda
              se desliza fuera en vez de desaparecer de golpe. */}
          {lastCategory ? (
            <div
              className="glass-dark max-w-[13rem] px-4 py-2.5 text-right transition-transform duration-300 ease-[var(--ease-out-soft)]"
              style={{
                transform: selectedCategory ? "translateX(0)" : "translateX(130%)",
                background: "rgba(10,14,13,0.32)",
              }}
            >
              <p className="numeral text-[1.5rem] font-extrabold leading-none" style={{ color: CONSTELACION_ACCENT_COLOR[lastCategory] }}>
                {funnelCounts.get(lastCategory) ?? 0}
              </p>
              <p className="mt-1 text-[0.6875rem] leading-snug text-chalk/70">{stateBadgeLabel(lastCategory, t)}</p>
            </div>
          ) : null}
        </div>
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
            aria-label={t.admin.constelacionToggleHud}
            className={cn("btn size-11", hudVisible ? "bg-lime text-ink" : "glass-dark text-chalk")}
          >
            {hudVisible ? <EyeIcon className="size-5" /> : <EyeOffIcon className="size-5" />}
          </button>
          {/* Propio de esta vista -no existe en ConstelacionMap-: apaga las
              líneas que van del sol a un cliente de alta directa por QR, el
              ruido visual más habitual alrededor del núcleo. */}
          <button
            type="button"
            onClick={() => setHideDirectLinks((v) => !v)}
            aria-pressed={hideDirectLinks}
            aria-label={t.admin.constelacionHideDirectLinks}
            title={t.admin.constelacionSettings}
            className={cn("btn size-11", hideDirectLinks ? "bg-lime text-ink" : "glass-dark text-chalk")}
          >
            <SettingsIcon className="size-5" />
          </button>
          {/* Como en ConstelacionMap: esta vista tampoco lleva su propia barra
              inferior -es igualmente "una exploración a pantalla completa, no
              una tarjeta más"-, así que este icono sigue siendo el camino
              directo a puertas y señales, juntas en /admin/metricas. */}
          <Link href="/admin/metricas" prefetch={false} aria-label={t.admin.navMetrics} className="btn glass-dark size-11 text-chalk">
            <PulseIcon className="size-5" />
          </Link>
        </div>
      </div>

      <footer className="pointer-events-none fixed inset-x-0 bottom-0 z-20 flex flex-col items-center gap-3 px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
        {!selectedNode && !touched ? (
          <p className="text-[0.65625rem] text-chalk/32 transition-opacity duration-300">
            {funnelTotal === 0 ? t.admin.referralMapEmpty : t.admin.referralMapHint}
          </p>
        ) : null}
      </footer>

      <ConstelacionSheet
        node={selectedNode}
        giftedByName={giftedByName}
        invitedCount={selectedNode?.childCount ?? 0}
        sentAt={selectedNode ? (sentAtById.get(selectedNode.id) ?? null) : null}
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
