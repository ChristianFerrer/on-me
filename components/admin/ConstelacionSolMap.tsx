"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeftIcon, ChevronDownIcon, CompassIcon, EyeIcon, EyeOffIcon, InfoIcon, PulseIcon, SettingsIcon, SparkleIcon } from "@/components/ui/Icons";
import { BottomNav } from "@/components/admin/BottomNav";
import { ConstelacionSheet } from "@/components/admin/ConstelacionSheet";
import { cn } from "@/lib/cn";
import { bestPadrinoId, isExpiringSoon } from "@/lib/giftGraph/insights";
import { type Pan, panBy, pixelsToUnits, zoomAtPoint } from "@/lib/panZoom";
import { ESTABLISHMENT_RADIUS, layoutConstelacion, CONSTELACION_PHASE_SIZE, type ConstelacionLayout, type ConstelacionPoint } from "@/lib/giftGraph/constelacionLayout";
import { stateBadgeLabel } from "@/lib/giftGraph/stateBadge";
import { isTap, type PointerPoint } from "@/lib/giftGraph/tapGesture";
import { liveEventMessage, type LiveEventKind } from "@/lib/giftGraph/liveEvents";
import { simulateGraphStep } from "@/lib/giftGraph/simulateActivity";
import type { GiftGraph, Node, NodeState } from "@/lib/giftGraph/types";
import { fill, type Dict, type Locale } from "@/lib/i18n";

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

/**
 * Alto real de BottomNav en móvil/tablet -por debajo de `lg`, donde sigue
 * siendo una barra inferior fija, ver BottomNav.tsx-, sin la zona segura
 * -que la propia barra ya reserva aparte con su pb-[env(...)]-: padding
 * vertical (py-2.5 arriba y abajo) + icono (size-5) + hueco (gap-1) +
 * etiqueta (text-[0.625rem] leading-none) = 1.25 + 1.25 + 0.25 + 0.625rem =
 * 3.375rem. La columna de leyenda/iconos, el aviso inferior y la ficha (ver
 * ConstelacionSheet) suman esto a su margen normal de borde de pantalla
 * -1.25rem- vía `pb-[calc(3.375rem+env(safe-area-inset-bottom)+1.25rem)]`
 * para no quedar tapados por la barra. A partir de `lg` BottomNav se
 * convierte en un sidebar IZQUIERDO de ancho fijo -ADMIN_SIDEBAR_WIDTH en
 * BottomNav.tsx, hoy "16rem"-, así que ahí ya no hay barra inferior que
 * despejar -cae a `lg:pb-[max(1.25rem,env(safe-area-inset-bottom))]`, el
 * margen de siempre- pero sí hueco a la izquierda que respetar -de ahí
 * `lg:left-[calc(var(--admin-sidebar-width,16rem)+0.75rem)]` en la columna
 * de la leyenda, 0.75rem siendo el mismo hueco que ya usa `left-3`-. Esta
 * vista pasa `collapsible` a BottomNav -único sitio del panel que lo hace-,
 * así que el ancho del sidebar no es fijo: BottomNav publica su ancho real
 * en la variable CSS `--admin-sidebar-width` -16rem desplegado, 4.75rem
 * plegado- y aquí se lee con ese mismo nombre, 16rem de reserva por si el
 * valor no llegó a fijarse a tiempo -SSR/primer pintado-. */

/** Radianes por frame de la rotación de fondo, y cuánto tarda en reanudarse tras soltar. */
const ROTATION_PER_FRAME = 0.00019;
const ROTATION_RESUME_DELAY_MS = 2600;
/** Amplitud base del bamboleo de cada nodo: radial (unidades del viewBox) y angular (radianes) -globo de helio en un hilo flojo, no un radio de rueda rígido. Deliberadamente más baja que antes de pensarlo dos veces: es puro ruido decorativo -no cuenta nada del cliente-, así que no debe pesar más que el titileo o el parpadeo, que sí cuentan algo. Ver wobbleRestlessness más abajo -la excepción a "puro ruido"-. */
const WOBBLE_AMPLITUDE = 4.5;
const WOBBLE_ANGULAR_AMPLITUDE = 0.05;
/** Cuánto más se bambolea, sobre la base, un cliente activo cerca de completar su tarjeta actual: inquietud visual como pista de "esto está a punto de moverse de estado" -a más sellos sobre la meta, más bambolea-, no puro decorado. Reutiliza una animación que ya existía para algo con sentido, en vez de sumar una nueva. */
const WOBBLE_RESTLESS_BOOST = 1.8;
/** Con una cadena tocada -zoom cerrado, muchas esferas cerca unas de otras- el propio bamboleo dificulta tocar la esfera vecina que se quiere ver a continuación: el reloj que alimenta el vaivén avanza a este ritmo, no al real, mientras haya algo seleccionado -1 = normal, más bajo = más lento, nunca 0: sigue siendo un gráfico vivo, solo menos inquieto-. */
const WOBBLE_FOCUS_SPEED = 0.2;
/** Fracción de displayRadius que ocupa el núcleo sólido de cada estrella -el resto es puro halo, para que el brillo pese más que el propio cuerpo, como una estrella real. */
const STAR_CORE_SCALE = 0.5;
/** Tamaño mínimo del núcleo sólido, para que ni siquiera un prospecto de magnitud más baja -sent/opened/descartada, sin apenas consumo- se quede en un punto casi invisible: "cuadriplicar" tiene que notarse en todas, no solo en las de más magnitud. */
const STAR_CORE_MIN_R = 3;

/** El propio núcleo sólido -lo único que de verdad se pinta como círculo lleno, el halo es puro brillo difuso alrededor-: la misma fórmula la usa tanto el radio con el que se recortan las cuerdas y se separan las esferas por imán (nodeRadiusById) como el que de verdad se dibuja en el JSX, para que ninguno de los dos se desincronice del otro -si no, la cuerda se corta donde ya no hay esfera que tocar-. */
function starCoreRadius(displayRadius: number): number {
  return Math.max(displayRadius * STAR_CORE_SCALE, STAR_CORE_MIN_R);
}
/** Margen del círculo invisible de toque alrededor del núcleo real -no de displayRadius, que crece con la magnitud y ya va topado aparte-, con un mínimo para que una estrella tenue siga siendo fácil de tocar y un máximo para que una grande -justo las que quedan más pegadas al anillo de categorías, en el borde exterior de su profundidad- no le robe el toque al anillo. */
const STAR_TOUCH_PADDING = 6;
const STAR_TOUCH_MIN_R = 12;
const STAR_TOUCH_MAX_R = 16;
function starTouchRadius(starCoreR: number): number {
  return Math.min(Math.max(starCoreR + STAR_TOUCH_PADDING, STAR_TOUCH_MIN_R), STAR_TOUCH_MAX_R);
}
/** Avance por frame del punto que recorre las cadenas con canje reciente, su radio y el de su halo resplandeciente. */
const PULSE_STEP = 0.0035;
const PULSE_DOT_R = 0.95;
const PULSE_GLOW_R = PULSE_DOT_R * 3.2;
const DAY_MS = 24 * 60 * 60 * 1000;
/** Cada cuánto se vuelve a pedir el grafo entero -esta es la vista pensada para quedarse encendida en el local todo el día, así que no puede quedarse con la foto de cuando se abrió la pestaña-. Ni tan rápido que sea un martilleo a la base de datos, ni tan lento que un sello recién puesto tarde minutos en notarse. */
const LIVE_POLL_MS = 20_000;
/** Un sello, un canje o un alta de verdad -no el paso del reloj- disparan un destello de una sola vez, no el aura constante de siempre: un brillo que sube y baja en FLASH_DURATION_MS sobre la propia estrella donde pasó -radio y color de la propia estrella, no genéricos- y otro, más discreto, sobre el sol, para que se note incluso sin mirar ninguna estrella en concreto. Desaparece solo, sin más estado que un ref por fotograma -mismo patrón que el pulso viajero de las cuerdas-. */
const FLASH_DURATION_MS = 1800;
const FLASH_MAX_OPACITY = 0.85;
const SUN_FLASH_DURATION_MS = 2200;
const SUN_FLASH_MAX_OPACITY = 0.4;
/** Ventana de "canje reciente" para disparar el pulso: la misma que usa el negocio para el retorno. */
const RECENT_REDEMPTION_MS = 30 * DAY_MS;

/**
 * Feed de "Action" -burbuja arriba en móvil, panel tipo chat a la izquierda
 * en escritorio, ver liveEvents.ts para el vocabulario compartido-: cuántos
 * sucesos recientes se guardan como máximo -más que eso y es scroll sin fin
 * que nadie va a leer entero, no un chat en vivo-, cuánto dura la burbuja
 * antes de desvanecerse sola, y cada cuánto el modo simulación fabrica un
 * suceso nuevo -ni tan rápido que sea ilegible, ni tan lento que parezca
 * que no está pasando nada.
 */
const LIVE_EVENTS_MAX = 40;
const TOAST_DURATION_MS = 4200;
const SIMULATION_STEP_MS = 2600;

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
/** Triplicado a petición -tras cuadriplicarlo, resultó demasiado grande-: las esferas se veían demasiado pequeñas, sobre todo en móvil, pero no tanto como para llegar a 4x. */
const STAR_SIZE_MULTIPLIER = 3;
const STAR_MAGNITUDE_SIZE_MULTIPLIER = [0.82, 1, 1.22, 1.48, 1.8].map((m) => m * STAR_SIZE_MULTIPLIER);
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
 * Blanco (prospecto) → ámbar -FBBF24- (abrió el enlace: ya demostró
 * interés, pero sigue siendo un prospecto, no comparte color con nada
 * verificado) → verde -4ADE80, el mismo verde de --color-mint- (se dio de
 * alta desde la invitación: ya es cliente real, pero todavía provisional,
 * aún no ha canjeado en barra) → cian vivo -38E1FF- (en ventana: ya
 * canjeó, esperando su próxima visita) → magenta -FF00F9- (nuevo
 * verificado: hizo su primer consumo pagado después de canjear la
 * invitación -la definición exacta de "Cliente Nuevo Verificado" de
 * lib/attribution.ts-, el hito que de verdad factura al local, así que
 * lleva el color más alto de contraste de todo el mapa) → verde lima
 * -E9FF72- (alta directa, siempre en primera línea) → negro con borde
 * blanco -descartada, sin historia que seguir contando, el borde es el
 * que la hace visible sobre un fondo igual de oscuro que su propio
 * relleno- o negro con borde rojo -caducada: el rojo, no el blanco
 * neutro, marca que ahí sí hubo una invitación real que se dejó morir, a
 * diferencia de una simplemente descartada-. "se dio de alta" y "alta
 * directa" llevan cada uno su propio verde -distintos entre sí, 4ADE80 vs
 * E9FF72- a propósito: son dos caminos distintos hacia ser cliente, no el
 * mismo hito.
 */
const CONSTELACION_PHASE_COLOR: Record<NodeState, string> = {
  sent: "#FFFFFF",
  opened: "#FBBF24",
  claimed: "#4ADE80",
  window: "#38E1FF",
  billable: "#FF00F9",
  direct: "#E9FF72",
  discarded: "#000000",
  expired: "#000000",
};

/** Borde de cada punto: el mismo casi invisible de siempre, salvo en los dos negros -sin él, se funden con el fondo-; caducada lleva su propio rojo en vez del blanco neutro de descartada, para distinguir "hubo una invitación real que caducó" de "se descartó sin más". */
const CONSTELACION_STROKE_COLOR: Record<NodeState, string> = {
  sent: "rgba(255,255,255,.16)",
  opened: "rgba(255,255,255,.16)",
  claimed: "rgba(255,255,255,.16)",
  window: "rgba(255,255,255,.16)",
  billable: "rgba(255,255,255,.16)",
  direct: "rgba(255,255,255,.16)",
  discarded: "rgba(255,255,255,.85)",
  expired: "rgba(239,68,68,.9)",
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
function safeStateColor(state: NodeState): string {
  return CONSTELACION_MUTED_STATES.has(state) ? CONSTELACION_ACCENT_COLOR[state] : CONSTELACION_PHASE_COLOR[state];
}
function safeLineColor(node: Node): string {
  return safeStateColor(node.state);
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

/** Multiplicador de amplitud del bamboleo -radial y angular por igual-: 1 en reposo, hasta 1+WOBBLE_RESTLESS_BOOST para un cliente claimed, en estado con peso -no expirado/descartado-, con el consumo de su tarjeta actual cerca de la meta. Cuadrático, no lineal: a mitad de tarjeta apenas se nota más que en reposo, y la inquietud se concentra de verdad cerca del final, justo cuando el canje está a la vuelta de la esquina. */
function wobbleRestlessness(node: Node | undefined, stampsGoal: number): number {
  if (!node || !node.claimed || CONSTELACION_MUTED_STATES.has(node.state) || stampsGoal <= 0) return 1;
  const progress = clamp(node.stamps / stampsGoal, 0, 1);
  return 1 + progress * progress * WOBBLE_RESTLESS_BOOST;
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

/** `rotation` opcional -0 por defecto, la posición de siempre-: para el barrido de ángulos candidatos del encuadre de cadena (ver fitChainRotationAndPan) hace falta poder preguntar "¿dónde caería este punto si el mapa estuviera girado tantos radianes más?" sin tocar el `<g>` de verdad. */
function nodeXY(point: { angle: number; ringRadius: number; depth: number }, rotation = 0): XY {
  if (point.depth === 0) return { x: 0, y: 0 };
  return { x: point.ringRadius * Math.cos(point.angle + rotation), y: point.ringRadius * Math.sin(point.angle + rotation) };
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
function animatedXY(point: ConstelacionPoint, rotation: number, nowMs: number, magnet: Magnet = NO_MAGNET, restlessness = 1): XY {
  if (point.depth === 0) return { x: 0, y: 0 };
  const t = nowMs / 1000;
  const radialWobble = Math.sin(t * wobbleFreq(point.index) + wobblePhase(point.index)) * WOBBLE_AMPLITUDE * restlessness;
  const angularWobble =
    Math.sin(t * wobbleFreqAngular(point.index) + wobblePhaseAngular(point.index)) * WOBBLE_ANGULAR_AMPLITUDE * restlessness;
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
      <span className="numeral text-[1.125rem] font-bold tracking-tight sm:text-[1.375rem]">{active ? shown : value}</span>
      <span className="text-[0.625rem] lowercase text-chalk/45 sm:text-[0.6875rem]">{label}</span>
    </div>
  );
}

/**
 * Sondeo periódico (ver LIVE_POLL_MS): el grafo recién llegado sustituye al
 * que ya había, pero conservando el orden de aparición de los nodos que ya
 * existían -solo se añaden al final los de verdad nuevos-. `layoutConstelacion`
 * asigna a cada nodo su índice según su posición en este array, y ese índice
 * es la semilla del bamboleo y el titileo de cada estrella (wobbleFreq,
 * twinkleDelayS...); sin este cuidado, un sondeo que llegara en un orden
 * distinto -nada lo garantiza, la consulta no lleva ORDER BY- reordenaría el
 * array y cada estrella "saltaría" a una fase de movimiento distinta cada
 * vez, deshaciendo la sensación de continuidad que precisamente se busca en
 * una pantalla pensada para quedarse encendida todo el día.
 */
function mergeGraphPreservingOrder(prev: GiftGraph, next: GiftGraph): GiftGraph {
  const nextById = new Map(next.nodes.map((n) => [n.id, n]));
  const seen = new Set<string>();
  const merged: Node[] = [];
  for (const n of prev.nodes) {
    const fresh = nextById.get(n.id);
    if (!fresh) continue; // se fue de verdad -no debería pasar hoy, no hay borrado-, no lo arrastramos
    merged.push(fresh);
    seen.add(n.id);
  }
  for (const n of next.nodes) if (!seen.has(n.id)) merged.push(n);
  return { ...next, nodes: merged };
}

/** Lo mismo que dispara un destello, pero con el vocabulario del feed de actividad -ver liveEvents.ts-, para anunciarlo también ahí. `state` es el de la estrella tras el cambio -el punto de color de la burbuja/panel pinta ese, no uno genérico. */
type DetectedLiveEvent = { kind: LiveEventKind; name: string; nodeId: string; state: NodeState };
/** Un destello por nodo -id, intensidad 0..1- más, si hubo alguno, uno agregado para el sol; y los mismos sucesos, ya etiquetados, para el feed. */
type GraphActivity = { nodeFlashes: Map<string, number>; sunIntensity: number; events: DetectedLiveEvent[] };

/**
 * Compara dos capturas del grafo -la de antes y la recién llegada- y decide
 * dónde disparar un destello: un sello nuevo, un canje (cardsCompleted sube)
 * o un alta que acaba de aparecer. No cualquier diferencia -un simple cambio
 * de `lastActivityAt` sin que suba ni el sello ni el canje no cuenta como
 * "pasó algo" a efectos de destello, aunque sí siga afectando al titileo por
 * su cuenta-. Un canje pesa más que un sello suelto, y un sello más que un
 * alta nueva -la intensidad del destello, no solo su presencia, cuenta algo-.
 *
 * Solo 4 de los 8 sucesos del vocabulario compartido (ver liveEvents.ts) se
 * anuncian aquí en el feed -new_direct, stamp, redeemed, returned-: son los
 * únicos que este sondeo puede distinguir de verdad comparando dos fotos del
 * grafo. Una alta nueva que llegó reclamada por invitación, no por QR
 * directo, sigue disparando su destello -intensity 0.5- pero sin anuncio en
 * el feed: no hay en el vocabulario un suceso "cliente nuevo por invitación"
 * propio, y etiquetarlo como new_direct sería decir algo que no pasó.
 */
function detectGraphActivity(prevNodes: Node[], nextNodes: Node[]): GraphActivity {
  const prevById = new Map(prevNodes.map((n) => [n.id, n]));
  const nodeFlashes = new Map<string, number>();
  const events: DetectedLiveEvent[] = [];
  let sunIntensity = 0;
  for (const node of nextNodes) {
    const prev = prevById.get(node.id);
    let intensity = 0;
    let kind: LiveEventKind | null = null;
    if (!prev) {
      if (node.claimed) {
        intensity = 0.5; // alta -por invitación reclamada o directa- que no existía en la foto anterior
        if (node.state === "direct") kind = "new_direct";
      }
    } else if (node.cardsCompleted > prev.cardsCompleted) {
      intensity = 1; // canje de premio: el evento de más peso en la relación con el local
      kind = "redeemed";
    } else if (node.stamps > prev.stamps) {
      intensity = 0.7; // un café más en la tarjeta actual
      kind = "stamp";
    } else if (node.state !== prev.state && CONSTELACION_POSITIVE_STATES.has(node.state) && !CONSTELACION_POSITIVE_STATES.has(prev.state)) {
      intensity = 0.6; // pasó a facturable/directo sin que fuera por un sello -p.ej. se resolvió su ventana
      kind = "returned";
    }
    if (intensity > 0) {
      nodeFlashes.set(node.id, intensity);
      sunIntensity = Math.max(sunIntensity, intensity);
      if (kind) events.push({ kind, name: node.name, nodeId: node.id, state: node.state });
    }
  }
  return { nodeFlashes, sunIntensity, events };
}

/** Margen fijo alrededor de la caja que encierra toda la cadena tocada, en unidades del viewBox -mismo espíritu que VIEWBOX_PADDING, pero propio de este encuadre-. */
const CHAIN_ZOOM_PADDING = 50;
/** Margen extra por esfera, sobre su propio nodeRadius, al calcular la caja a encuadrar: sin esto la caja solo mira el CENTRO de cada esfera, no su cuerpo -ni el anillo "estás viendo esta" (displayRadius+4.5) de la propia seleccionada-, así que a un zoom alto -ver CHAIN_ZOOM_MAX_SCALE, el margen fijo de siempre no crece con el zoom- ese anillo podía asomar fuera de la pantalla aunque el CENTRO del nodo cupiera de sobra. */
const CHAIN_ZOOM_NODE_MARGIN = 5;
/** Tope de escala del encuadre a una cadena -antes sin tope: "el máximo posible" se probó literal y una cadena de un único cliente sin invitados -caja mínima, casi un punto- se ampliaba hasta ocupar la pantalla entera con el aura de una sola estrella, no un mapa. Mismo techo que el propio pellizco manual (MAX_SCALE): el automático nunca debe llegar más lejos de lo que ya podría llegar el dedo del cliente. */
const CHAIN_ZOOM_MAX_SCALE = MAX_SCALE;
/** Franja reservada arriba -en píxeles de pantalla, no unidades del viewBox: se convierte con pixelsToUnits al vuelo- para que la cadena encuadrada no quede tapada por la cabecera fija: botón de volver + placa del local, con su margen de zona segura. Un valor fijo, no medido -a diferencia de la ficha, ver cardHeightPx-: la cabecera no cambia de alto según qué cadena se toque. */
const HEADER_ZOOM_INSET_PX = 90;
/** Igual que arriba, pero abajo: lo que hay por debajo de la propia ficha de detalle -BottomNav en móvil/tablet más su zona segura y los márgenes fijos del contenedor- y que cardHeightPx, medido de verdad, no incluye por sí solo. */
const BOTTOM_CHROME_BUFFER_PX = 90;
/** Ángulos candidatos -relativos a la rotación actual del mapa- que se prueban antes de encuadrar una cadena: cada uno es una orientación distinta de su caja envolvente, y se elige la que mejor aprovecha el hueco disponible. 4 bastan -0/45/90/135°, el ajuste de una caja a un rectángulo se repite cada 180°- para que una cadena con forma alargada -la mayoría, ver captura real- pueda caer con su lado largo alineado al hueco alto y estrecho entre la cabecera y la tarjeta, en vez de quedarse siempre a la orientación en la que el mapa iba girando por su cuenta en ese momento. */
const CHAIN_ROTATION_CANDIDATES = [0, Math.PI / 4, Math.PI / 2, (Math.PI * 3) / 4];

/** El cuerpo de cada esfera, no solo su centro -ver CHAIN_ZOOM_NODE_MARGIN-: `radius` ya trae ese margen sumado, así que aquí basta con restar/sumar sin más cuentas. */
function chainBoundingBox(points: { xy: XY; radius: number }[]): { cx: number; cy: number; spanX: number; spanY: number } {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const { xy, radius } of points) {
    minX = Math.min(minX, xy.x - radius);
    maxX = Math.max(maxX, xy.x + radius);
    minY = Math.min(minY, xy.y - radius);
    maxY = Math.max(maxY, xy.y + radius);
  }
  return { cx: (minX + maxX) / 2, cy: (minY + maxY) / 2, spanX: Math.max(maxX - minX, 1), spanY: Math.max(maxY - minY, 1) };
}

/**
 * Encuadre automático de toda una cadena -las esferas que devuelve
 * `chainMembers`, la constelación entera del nodo tocado, root y
 * descendientes de cualquier profundidad- dentro del hueco de verdad
 * disponible: no todo el viewBox por igual, `topInset`/`bottomInset`
 * -en sus mismas unidades- reservan la franja que tapan la cabecera fija
 * arriba y la ficha de detalle abajo, para que la propia cadena tocada no
 * termine escondida bajo la ficha que la enseña. Topado a `maxScale` para
 * que una cadena de dos esferas casi pegadas no acabe llenando la
 * pantalla entera de zoom -leer la caja completa importa más que verla
 * grande-.
 *
 * También prueba unos pocos ángulos de rotación -ver
 * CHAIN_ROTATION_CANDIDATES- sobre la propia rotación actual del mapa
 * (`baseRotation`) y se queda con el que mejor llena ese hueco: una
 * cadena alargada cabe mucho mejor con su lado largo alineado al hueco
 * alto y estrecho entre cabecera y ficha que a la orientación en la que
 * el mapa iba girando por su cuenta en el momento de tocarla.
 */
function fitChainRotationAndPan(
  layoutPoints: ConstelacionPoint[],
  baseRotation: number,
  halfW: number,
  half: number,
  maxScale: number,
  topInset: number,
  bottomInset: number,
): { rotationDelta: number; pan: Pan } {
  const availW = Math.max(halfW * 2 - CHAIN_ZOOM_PADDING * 2, 1);
  const availH = Math.max(half * 2 - topInset - bottomInset - CHAIN_ZOOM_PADDING * 2, 1);
  // Centro vertical del hueco disponible, no del viewBox entero -0-: el
  // propio viewBox va de -half (arriba) a +half (abajo), así que un margen
  // de más arriba que abajo (o al revés) desplaza ese centro en la misma
  // proporción.
  const safeCenterY = (topInset - bottomInset) / 2;

  let best: { rotationDelta: number; pan: Pan } | null = null;
  for (const delta of CHAIN_ROTATION_CANDIDATES) {
    const rotation = baseRotation + delta;
    const box = chainBoundingBox(layoutPoints.map((p) => ({ xy: nodeXY(p, rotation), radius: p.nodeRadius + CHAIN_ZOOM_NODE_MARGIN })));
    const scale = clamp(Math.min(availW / box.spanX, availH / box.spanY), MIN_SCALE, maxScale);
    if (!best || scale > best.pan.scale) {
      best = { rotationDelta: delta, pan: { x: -box.cx * scale, y: safeCenterY - box.cy * scale, scale } };
    }
  }
  // layoutPoints nunca llega vacío -el efecto que llama a esto ya comprueba
  // chainPoints.length > 0-, así que `best` siempre queda asignado.
  return best as { rotationDelta: number; pan: Pan };
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
  graph: initialGraph,
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
  // La página lo carga una vez en el servidor al entrar, pero esta es la
  // vista pensada para quedarse encendida en el local todo el día -no una
  // que se recarga-, así que a partir de aquí `graph` es estado local que
  // el sondeo de más abajo (ver LIVE_POLL_MS) va refrescando solo, sin que
  // nadie tenga que volver a abrir la pestaña para que un sello nuevo se
  // note.
  const [graph, setGraph] = useState(initialGraph);
  const prevGraphRef = useRef(initialGraph);

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
  // /admin/metricas: son preguntas distintas ("cuántas se han enviado
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

  /**
   * Panel "lo que ninguna tarjeta te dice" -desktop, columna derecha-:
   * lecturas que no salen de mirar una sola tarjeta, solo de mirar toda la
   * red a la vez. Todo en cafés/cuentas, nunca en €: este local no guarda
   * ningún precio por café, así que cualquier cifra en euros aquí sería
   * inventada -mejor un número real y honesto que uno bonito y falso.
   */
  const insights = useMemo(() => {
    const claimedNodes = graph.nodes.filter((n) => n.claimed);
    // El café gratis del referido se regala en cuanto se da de alta desde la
    // invitación -"direct" nunca pasó por ninguna invitación, no cuenta-.
    const referredCustomers = claimedNodes.filter((n) => n.state !== "direct").length;
    const wonCustomers = claimedNodes.filter((n) => n.state === "billable").length;
    const referredPct = claimedNodes.length > 0 ? Math.round((referredCustomers / claimedNodes.length) * 100) : 0;
    const costPerWonCoffees = wonCustomers > 0 ? referredCustomers / wonCustomers : null;
    const noReturnCount = graph.nodes.filter((n) => n.state === "discarded").length;
    const expiredAttempts = graph.nodes.filter((n) => n.state === "expired").length;
    const dormantCount = claimedNodes.filter((n) => livelinessFor(n, nowMs) <= 0).length;
    // Mismo cupo que el negocio real -lib/card.ts, pendingGrants-: una
    // invitación de derecho por cada tarjeta completada, sin gastar
    // -childCount nunca debería superar cardsCompleted, pero max(...,0) por
    // si acaso-, sumado sobre toda la red.
    const readyToGiftCoffees = claimedNodes.reduce((sum, n) => sum + Math.max(n.cardsCompleted - n.childCount, 0), 0);
    const referrersToReview = new Set(
      graph.nodes
        .filter((n) => n.state === "discarded")
        .map((n) => parentOf.get(n.id))
        .filter((id): id is string => id != null && id !== graph.establishment.id),
    ).size;
    return {
      referredPct,
      costPerWonCoffees,
      noReturnCount,
      expiredAttempts,
      maxHops: layout.maxDepth,
      dormantCount,
      readyToGiftCoffees,
      expiringSoonCount: expiringIds.size,
      referrersToReview,
    };
  }, [graph.nodes, graph.establishment.id, parentOf, nowMs, layout.maxDepth, expiringIds]);

  // Encuadre automático: el viewBox es el borde más lejano de todos
  // -frameRadius- más un margen fijo, en vertical -`half`/`size` de
  // siempre-. El ancho real -`halfW`, más abajo, junto a `svgRef`- se
  // estira aparte para igualar la proporción del propio lienzo en
  // monitores anchos, en vez de quedarse en el cuadrado de siempre.
  const half = frameRadius + VIEWBOX_PADDING;
  const size = half * 2;

  const [pan, setPan] = useState<Pan>({ x: 0, y: 0, scale: 1 });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // Mismo patrón que selectedCategoryRef, justo abajo: el bucle de rAF
  // necesita saber si hay una esfera tocada -para relentizar el bamboleo,
  // ver WOBBLE_FOCUS_SPEED- sin volver a montarse cada vez que cambia.
  const selectedIdRef = useRef<string | null>(null);
  useEffect(() => {
    selectedIdRef.current = selectedId;
  }, [selectedId]);
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

  /** Zoom fijo de la sección de anillo tocada -a diferencia de la cadena, ver más abajo, aquí sí hay un tope: una sección puede tener muchos miembros repartidos por todo su arco, así que "máximo posible" no tiene el mismo sentido que para una cadena pequeña y apretada. */
  const AUTO_ZOOM_MAX_SCALE = 2.2;
  /** Duración de la animación del zoom automático al tocar una sección del anillo: rápida, el objetivo ya se conoce -siempre el mismo punto del arco-. */
  const CATEGORY_ZOOM_DURATION_MS = 450;
  /** La cadena, en cambio, suele acercarse mucho más -sin tope, ver fitChainRotationAndPan más abajo-, así que un salto tan rápido como el de categoría marea y no deja tiempo de leer qué esfera es cuál según se van separando; más lento a propósito, para poder seguir con la vista cuál es cuál mientras el mapa se acerca. */
  const CHAIN_ZOOM_DURATION_MS = 1100;
  /** Solo mientras dura la animación del zoom automático: fuera de esa ventana el `<g>` no lleva transición, para no competir con el pellizco/arrastre manual, que actualiza `pan` en cada frame. */
  const [autoZooming, setAutoZooming] = useState(false);
  const [autoZoomDurationMs, setAutoZoomDurationMs] = useState(CATEGORY_ZOOM_DURATION_MS);
  const categoryMemberRankRef = useRef(new Map<string, { rank: number; count: number }>());
  useEffect(() => {
    categoryMemberRankRef.current = categoryMemberRank;
  }, [categoryMemberRank]);

  // El radio visible de cada esfera -el núcleo sólido de verdad, no el halo
  // que lo rodea; mismo cálculo que starCoreR más abajo en el JSX, "en
  // ventana" incluido-, para que la pasada de separación del imán (bucle
  // de rAF) y el recorte de las cuerdas (linkPath) sepan exactamente hasta
  // dónde llega la esfera pintada, sin duplicar esa cuenta ni
  // desincronizarse de lo que de verdad se pinta -antes usaba el radio
  // completo de "magnitud" (displayRadius, mayor que el propio núcleo), así
  // que la cuerda se cortaba antes de llegar a tocar la esfera-.
  const nodeRadiusById = useMemo(() => {
    const map = new Map<string, number>();
    for (const node of graph.nodes) {
      const pt = layout.points.get(node.id);
      if (!pt) continue;
      const isWindow = node.state === "window" && node.redeemedAt != null;
      const daysElapsed = isWindow ? Math.max(0, (nowMs - new Date(node.redeemedAt as string).getTime()) / DAY_MS) : 0;
      const displayRadius = pt.nodeRadius * (isWindow ? windowSizeMultiplier(daysElapsed) : 1);
      map.set(node.id, starCoreRadius(displayRadius));
    }
    return map;
  }, [graph.nodes, layout, nowMs]);
  const nodeRadiusRef = useRef(new Map<string, number>());
  useEffect(() => {
    nodeRadiusRef.current = nodeRadiusById;
  }, [nodeRadiusById]);
  // Mismo patrón que nodeRadiusById -memo reactivo, espejado a un ref para
  // que el bucle de rAF lea siempre el valor fresco sin tener que
  // reiniciarse en cada render-: cuánto de más bambolea cada estrella,
  // ver wobbleRestlessness.
  const wobbleRestlessById = useMemo(() => {
    const map = new Map<string, number>();
    for (const node of graph.nodes) map.set(node.id, wobbleRestlessness(node, stampsGoal));
    return map;
  }, [graph.nodes, stampsGoal]);
  const wobbleRestlessRef = useRef(new Map<string, number>());
  useEffect(() => {
    wobbleRestlessRef.current = wobbleRestlessById;
  }, [wobbleRestlessById]);

  // Destellos de una sola vez -uno por estrella donde pasó algo, otro
  // agregado sobre el sol-, ver detectGraphActivity: mismo patrón de ref
  // sin estado de React que el resto del movimiento de esta vista, el
  // bucle de rAF de más abajo los hace crecer y apagarse fotograma a
  // fotograma sobre su propio elemento del DOM.
  const nodeFlashRef = useRef(new Map<string, { start: number; intensity: number }>());
  const sunFlashRef = useRef<{ start: number; intensity: number } | null>(null);
  const flashGlowRefs = useRef(new Map<string, SVGCircleElement>());
  const sunFlashElRef = useRef<SVGCircleElement | null>(null);

  /**
   * Feed de "Action": la misma lista de sucesos alimenta la burbuja móvil y
   * el panel tipo chat de escritorio -ver el JSX más abajo-, así que basta
   * un único estado. `toastEvent` es el último suceso -el que enseña la
   * burbuja, que se desvanece sola pasado TOAST_DURATION_MS-; `liveEvents`
   * es el historial completo, topado a LIVE_EVENTS_MAX, más reciente al
   * final -como cualquier chat en vivo, se lee de arriba hacia abajo y el
   * nuevo mensaje entra por abajo-. El mensaje ya traducido no se guarda en
   * el propio suceso -solo kind/name-, así que si el idioma cambiara a
   * media sesión el historial entero seguiría leyéndose en el idioma
   * correcto en vez de quedarse congelado en el de cuando pasó. `color` -el
   * mismo que pinta la propia estrella, ver safeStateColor- sí se congela
   * al momento de anunciar el suceso, no se recalcula después: si esa misma
   * estrella cambia de estado más tarde -otro suceso posterior sobre ella-
   * las entradas ya viejas del historial siguen enseñando el color de
   * cuando de verdad pasó, no el color actual, que ya no sería el mismo
   * suceso que están contando.
   */
  type LiveActivityEvent = { id: string; kind: LiveEventKind; name: string; nodeId: string; color: string; ts: number };
  const [liveEvents, setLiveEvents] = useState<LiveActivityEvent[]>([]);
  const [toastEvent, setToastEvent] = useState<LiveActivityEvent | null>(null);
  const liveEventIdRef = useRef(0);
  function pushLiveEvent(kind: LiveEventKind, name: string, nodeId: string, state: NodeState) {
    liveEventIdRef.current += 1;
    const entry: LiveActivityEvent = {
      id: `evt:${Date.now()}:${liveEventIdRef.current}`,
      kind,
      name,
      nodeId,
      color: safeStateColor(state),
      ts: Date.now(),
    };
    setLiveEvents((prev) => [...prev, entry].slice(-LIVE_EVENTS_MAX));
    setToastEvent(entry);
  }
  useEffect(() => {
    if (!toastEvent) return;
    const timeout = window.setTimeout(() => setToastEvent((cur) => (cur?.id === toastEvent.id ? null : cur)), TOAST_DURATION_MS);
    return () => window.clearTimeout(timeout);
  }, [toastEvent]);
  /** Auto-scroll del panel de escritorio -mismo gesto que cualquier chat en vivo-: cada suceso nuevo entra por abajo, la vista sigue pegada al fondo sola. */
  const liveFeedScrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = liveFeedScrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [liveEvents]);

  /**
   * Reloj propio del feed -no el `nowMs` de arriba, congelado al montar-:
   * "hace X min" tiene que ir avanzando de verdad mientras la pestaña se
   * queda abierta todo el día, sin necesidad de que llegue un suceso nuevo
   * para refrescarse. Cada 15s basta -la propia etiqueta redondea a minutos.
   */
  const [feedNowMs, setFeedNowMs] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setFeedNowMs(Date.now()), 15_000);
    return () => window.clearInterval(id);
  }, []);
  function relativeTimeLabel(tsMs: number): string {
    const minutes = Math.floor((feedNowMs - tsMs) / 60_000);
    return minutes <= 0 ? t.admin.constelacionJustNow : fill(t.admin.constelacionMinutesAgo, { n: minutes });
  }

  /**
   * Modo simulación: fabrica actividad de mentira -ver simulateActivity.ts-
   * para poder ver el universo "vivo" -destellos, HUD, el propio feed- sin
   * esperar a que pasen cosas de verdad. Espejado a un ref -mismo patrón
   * que selectedIdRef- porque el sondeo real, más abajo, vive en un efecto
   * con dependencias vacías y necesita saber si está encendido sin volver a
   * montarse en cada cambio.
   */
  const [simulating, setSimulating] = useState(false);
  const simulatingRef = useRef(false);
  useEffect(() => {
    simulatingRef.current = simulating;
  }, [simulating]);

  // Sondeo periódico del grafo entero (ver LIVE_POLL_MS): compara lo que
  // acaba de llegar contra la última foto para decidir si algo merece un
  // destello, y solo entonces sustituye el grafo -conservando el orden de
  // aparición de los nodos que ya había, ver mergeGraphPreservingOrder-.
  // Sin destellos si el usuario pidió menos movimiento: el dato en sí se
  // sigue refrescando -las estrellas cambian de color/tamaño/estado igual-,
  // solo se omite el brillo de "esto acaba de pasar". Se salta entero
  // mientras el modo simulación está encendido -el sondeo real pisaría la
  // actividad fabricada en cuanto llegara, deshaciendo la demo a medias-.
  useEffect(() => {
    let cancelled = false;
    async function poll() {
      if (simulatingRef.current) return;
      try {
        const res = await fetch("/api/admin/constelacion", { cache: "no-store" });
        if (!res.ok || cancelled || simulatingRef.current) return;
        const data = (await res.json()) as { graph?: GiftGraph };
        if (cancelled || !data.graph) return;
        const merged = mergeGraphPreservingOrder(prevGraphRef.current, data.graph);
        const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        if (!reduceMotion) {
          const { nodeFlashes, sunIntensity, events } = detectGraphActivity(prevGraphRef.current.nodes, merged.nodes);
          if (nodeFlashes.size > 0 || sunIntensity > 0) {
            const start = performance.now();
            for (const [id, intensity] of nodeFlashes) nodeFlashRef.current.set(id, { start, intensity });
            if (sunIntensity > 0) sunFlashRef.current = { start, intensity: sunIntensity };
          }
          for (const event of events) pushLiveEvent(event.kind, event.name, event.nodeId, event.state);
        }
        prevGraphRef.current = merged;
        setGraph(merged);
      } catch {
        // Sondeo best-effort: sin conexión un fotograma, la vista se queda
        // con los últimos datos que tenía en vez de romperse.
      }
    }
    const id = window.setInterval(poll, LIVE_POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Al encender la simulación, el universo arranca de cero -sin los
  // clientes de verdad ya cargados-, y lo que fabrica simulateGraphStep
  // (más abajo) lo va llenando desde ahí: así se ve nacer la constelación
  // entera, no una demo mezclada encima de los 100+ clientes reales que ya
  // hubiera. Solo el establecimiento -el sol- sobrevive al reinicio; todo
  // lo demás -selección tocada, feed de sucesos, destellos en curso- se
  // limpia con él, para que no queden restos de la sesión real colgando de
  // una constelación que ya no existe. Efecto propio, sin `stampsGoal` en
  // las dependencias -a diferencia del paso de simulación, justo debajo-:
  // si ese valor cambiara a media demo no hay por qué reiniciar el
  // universo ya construido, solo el propio encendido debe vaciarlo.
  useEffect(() => {
    if (!simulating) return;
    const emptyGraph: GiftGraph = { establishment: prevGraphRef.current.establishment, roots: [], nodes: [], edges: [] };
    prevGraphRef.current = emptyGraph;
    setGraph(emptyGraph);
    setSelectedId(null);
    setSelectedCategory(null);
    setLiveEvents([]);
    setToastEvent(null);
    nodeFlashRef.current.clear();
    sunFlashRef.current = null;
  }, [simulating]);

  // El propio paso de simulación: un cambio de mentira cada SIMULATION_STEP_MS
  // mientras `simulating` está encendido, con el mismo tratamiento que un
  // suceso real -destello más anuncio en el feed-, para que la demo se vea
  // exactamente igual que la actividad de verdad, no como una vista aparte.
  // El primer paso se dispara al momento de encender -no solo tras el primer
  // intervalo-, para que la demo se note nada más tocar el botón. Parte de lo
  // que dejó el efecto de arriba -el universo recién vaciado-, así que el
  // primer paso siempre es "aparece el primer cliente", nunca un sello o un
  // canje sobre alguien que todavía no existe.
  useEffect(() => {
    if (!simulating) return;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    function step() {
      const result = simulateGraphStep(prevGraphRef.current, stampsGoal);
      if (!result) return;
      if (!reduceMotion) {
        const start = performance.now();
        const intensity =
          result.event.kind === "redeemed" ? 1 : result.event.kind === "stamp" ? 0.7 : result.event.kind === "returned" ? 0.6 : 0.5;
        nodeFlashRef.current.set(result.event.nodeId, { start, intensity });
        sunFlashRef.current = { start, intensity };
      }
      pushLiveEvent(result.event.kind, result.event.name, result.event.nodeId, result.event.state);
      prevGraphRef.current = result.graph;
      setGraph(result.graph);
    }
    step();
    const id = window.setInterval(step, SIMULATION_STEP_MS);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [simulating, stampsGoal]);

  // Al apagar la simulación, no esperar hasta LIVE_POLL_MS para que el
  // sondeo real vuelva a tomar el mando: se pide el grafo de verdad al
  // momento, sin destellos ni anuncio en el feed -es solo resincronizar la
  // foto de referencia con lo real, no un suceso que contar-, así la
  // siguiente comparación real (ver el efecto de sondeo, arriba) parte de
  // los datos de verdad y no de los últimos inventados por la demo.
  const wasSimulatingRef = useRef(false);
  useEffect(() => {
    if (wasSimulatingRef.current && !simulating) {
      fetch("/api/admin/constelacion", { cache: "no-store" })
        .then((res) => (res.ok ? res.json() : null))
        .then((data: { graph?: GiftGraph } | null) => {
          if (!data?.graph) return;
          const merged = mergeGraphPreservingOrder(prevGraphRef.current, data.graph);
          prevGraphRef.current = merged;
          setGraph(merged);
        })
        .catch(() => {});
    }
    wasSimulatingRef.current = simulating;
  }, [simulating]);

  // Apagadas por defecto -a petición-: la leyenda y el HUD tapan mapa útil
  // nada más entrar, así que arrancan cerradas y es el propio botón el que
  // las enciende, igual que ya pasa con los rayos del sol (hideDirectLinks).
  const [legendOpen, setLegendOpen] = useState(false);
  const [hudVisible, setHudVisible] = useState(false);
  /** Ajuste propio de esta vista -no existe en ConstelacionMap-: oculta los "rayos" -las líneas que van del sol a un cliente sin padrino, alta directa por QR-, que en un local con muchas suelen ser la mayoría del ruido visual alrededor del núcleo. Ocultos por defecto: el sol arranca "apagado", sin rayos, y el propio botón los enciende. */
  const [hideDirectLinks, setHideDirectLinks] = useState(true);
  const [touched, setTouched] = useState(false);
  // Misma filosofía que legendOpen/hudVisible -apagado por defecto, es el
  // propio botón el que lo enciende-: la columna de iconos de la derecha
  // entera se pliega detrás de un único botón, así que de entrada solo hay
  // un botón a la vista en vez de cinco.
  const [controlsOpen, setControlsOpen] = useState(false);

  // Toda la cadena -no solo los antepasados hasta el sol: TODAS las esferas
  // unidas directa o indirectamente al nodo tocado, sus hermanos y los
  // invitados de sus invitados incluidos- comparte el mismo rootId -lo
  // asigna loadRealGiftGraph a cada nodo de un mismo árbol, raíz incluida-,
  // así que agrupar por ese campo trae la constelación entera de una vez,
  // no solo el camino recto hasta el sol. El sol NO se incluye aquí -a
  // propósito, aunque sea "el punto de referencia" en otro sentido-: como
  // vive en el centro (0,0) y una cadena real cuelga a su propio radio de
  // anillo, bastante lejos del centro, meterlo en la caja que se encuadra
  // arrastraba el encuadre a abarcar desde el sol hasta la cadena entera
  // -medio mapa vacío en medio- en vez de encuadrar solo la cadena, que es
  // lo que de verdad se quiere ver de cerca.
  const chainMembers = useMemo(() => {
    const set = new Set<string>();
    if (!selectedId) return set;
    const selected = byId.get(selectedId);
    if (!selected) return set;
    for (const node of graph.nodes) {
      if (node.rootId === selected.rootId) set.add(node.id);
    }
    return set;
  }, [selectedId, byId, graph.nodes]);

  const selectedNode = selectedId ? (byId.get(selectedId) ?? null) : null;
  const giftedByName = useMemo(() => {
    if (!selectedNode) return "";
    const parentId = parentOf.get(selectedNode.id);
    if (!parentId) return "";
    if (parentId === graph.establishment.id) return graph.establishment.name;
    return byId.get(parentId)?.name ?? "";
  }, [selectedNode, parentOf, byId, graph.establishment]);

  const svgRef = useRef<SVGSVGElement>(null);

  // Alto real -en píxeles de pantalla- de la ficha de detalle en la esquina
  // (variante "corner"): el encuadre automático a una cadena (ver más abajo)
  // lo necesita para no centrar la cadena en TODA la pantalla y dejarla
  // parcialmente tapada bajo la propia ficha que la enseña -justo lo que
  // pasaba antes de esto-. Vía ResizeObserver, no un cálculo a mano: el alto
  // de la ficha cambia con el contenido (pendiente vs. reclamado, cuántas
  // líneas ocupa el nombre...), así que se mide de verdad en vez de
  // adivinarlo. El propio nodo sigue montado -y con su tamaño real- aunque
  // esté "cerrado" -se traslada fuera de pantalla, no se desmonta-, así que
  // el observer no necesita esperar a la primera selección para engancharse.
  const cardWrapRef = useRef<HTMLDivElement>(null);
  const [cardHeightPx, setCardHeightPx] = useState(0);
  useEffect(() => {
    const el = cardWrapRef.current;
    if (!el) return;
    const update = () => setCardHeightPx(el.getBoundingClientRect().height);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Un viewBox cuadrado con "xMidYMid meet" sobre un monitor ancho de
  // escritorio deja franjas vacías a los lados en vez de aprovechar el
  // sitio -"se ve muy chico"-, así que el ancho se estira aparte para
  // igualar la proporción real del propio lienzo, medida con
  // ResizeObserver sobre el propio <svg>. En móvil/tablet -aspectRatio <= 1-
  // `halfW` coincide con `half`: el recuadro sigue siendo el cuadrado de
  // siempre, sin ningún cambio -por eso `size`/`half` sin más se pueden
  // seguir usando tal cual en viewPoint/deltaToView más abajo, que ya
  // asumían el lado corto del contenedor, y ese lado corto sigue siendo
  // vertical -`half`- tanto en cuadrado como en el rectángulo ancho.
  const [aspectRatio, setAspectRatio] = useState(1);
  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const update = () => {
      const rect = el.getBoundingClientRect();
      if (rect.height > 0) setAspectRatio(rect.width / rect.height);
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  const halfW = half * Math.max(aspectRatio, 1);
  // El campo de estrellas se reparte en círculo hasta `vb*1.05`: con el
  // recuadro ya no cuadrado, ese círculo tiene que cubrir hasta la esquina
  // más lejana -la diagonal, no el lado corto- para no dejar huecos sin
  // estrellas en los bordes izquierdo/derecho de un monitor ancho.
  const starRadius = Math.hypot(halfW, half);
  const stars = useMemo(() => starfield(starRadius), [starRadius]);

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
  // Reloj propio del bamboleo -no el `performance.now()` real-: avanza a
  // ritmo normal salvo mientras hay una cadena tocada (ver WOBBLE_FOCUS_SPEED),
  // momento en que se relentiza para que tocar la esfera vecina en el mismo
  // encuadre cerrado no sea una lotería. Con delta real de fotograma a
  // fotograma -no un paso fijo-, así el vaivén sigue leyéndose suave sin
  // importar la tasa de refresco.
  const wobbleClockRef = useRef(0);
  const lastFrameTimeRef = useRef<number | null>(null);
  /** Valor de imán ya suavizado por nodo -ver MAGNET_EASE-, para no saltar de golpe al elegir/quitar una categoría. */
  const magnetRef = useRef(new Map<string, number>());
  /** Índice estable de cada enlace dentro de layout.links, semilla de la respiración de su curva -ver linkBezier-. */
  const linkIndexOf = useMemo(() => new Map(layout.links.map((l, i) => [`${l.fromId}>${l.toId}`, i])), [layout.links]);

  // Zoom automático: SIEMPRE que se toca una esfera, encuadra la constelación
  // entera a la que pertenece -chainMembers ya la trae completa, root y
  // descendientes de cualquier profundidad- en el hueco de verdad libre
  // entre la cabecera y la ficha de detalle -no todo el viewBox por igual,
  // ver fitChainRotationAndPan-, probando de paso unos pocos ángulos de
  // rotación para que una cadena alargada pueda caer con su lado largo
  // alineado a ese hueco alto y estrecho en vez de a la orientación en la
  // que el mapa iba girando por su cuenta en ese momento. Tocar una sección
  // del anillo sigue encuadrando esa sección, igual que antes. Los dos
  // casos comparten un único efecto -y no dos compitiendo por `pan`- porque
  // selectedCategory y selectedId ahora son mutuamente excluyentes (ver
  // endPointer): nunca hay dos zooms queriendo mandar a la vez.
  useEffect(() => {
    const range = selectedCategory ? arcAngleRangeByState.get(selectedCategory) : undefined;
    const chainLayoutPoints = selectedCategory
      ? []
      : [...chainMembers].map((id) => layout.points.get(id)).filter((p): p is ConstelacionPoint => p != null);
    // chainLayoutPoints solo trae algo cuando NO hay categoría tocada -ver
    // su propia definición, arriba-, así que su longitud ya basta para elegir.
    const durationMs = chainLayoutPoints.length > 0 ? CHAIN_ZOOM_DURATION_MS : CATEGORY_ZOOM_DURATION_MS;
    // Mismo par píxeles↔unidades del viewBox que ya usan viewPoint/deltaToView
    // más abajo -el lado corto del contenedor real, medido con
    // getBoundingClientRect, no un valor supuesto-, para convertir el alto de
    // la cabecera y de la ficha -ambos en píxeles de pantalla- a las mismas
    // unidades en las que vive todo lo demás de este encuadre.
    const svgRect = svgRef.current?.getBoundingClientRect();
    const base = svgRect && svgRect.width > 0 && svgRect.height > 0 ? Math.min(svgRect.width, svgRect.height) : Math.min(halfW * 2, half * 2);
    const rawTopInset = pixelsToUnits(HEADER_ZOOM_INSET_PX, base, size);
    const rawBottomInset = pixelsToUnits(cardHeightPx + BOTTOM_CHROME_BUFFER_PX, base, size);
    // Red de seguridad: en una pantalla pequeña con una ficha larga -o si el
    // propio cálculo de arriba se equivoca por lo que sea, `base` medido en
    // un mal momento, lo que sea- cabecera + ficha podían llegar a "comerse"
    // el viewBox entero, con availH colapsando al suelo de 1 unidad dentro
    // de fitChainRotationAndPan y el zoom cayendo siempre al mínimo posible
    // -exactamente el defecto reportado: "se aleja por completo"-. Encoge
    // los dos márgenes a partes iguales si entre los dos suman más de esta
    // fracción del alto total, así SIEMPRE queda un hueco real donde encuadrar.
    const MAX_INSET_FRACTION = 0.55;
    const totalInset = rawTopInset + rawBottomInset;
    const maxTotalInset = half * 2 * MAX_INSET_FRACTION;
    const insetScale = totalInset > maxTotalInset && totalInset > 0 ? maxTotalInset / totalInset : 1;
    const topInset = rawTopInset * insetScale;
    const bottomInset = rawBottomInset * insetScale;
    // Diferido a un microtask -mismo patrón que el snapshot de lastCategory
    // más abajo-: evita el aviso de "cascading renders" sin retrasar
    // visualmente el zoom.
    queueMicrotask(() => {
      setAutoZoomDurationMs(durationMs);
      setAutoZooming(true);
      if (range) {
        const angle = (range.start + range.end) / 2;
        const targetRadius = frameRadius * MAGNET_TARGET_RADIUS_FACTOR;
        const cx = targetRadius * Math.cos(angle);
        const cy = targetRadius * Math.sin(angle);
        setPan({ x: -cx * AUTO_ZOOM_MAX_SCALE, y: -cy * AUTO_ZOOM_MAX_SCALE, scale: AUTO_ZOOM_MAX_SCALE });
      } else if (chainLayoutPoints.length > 0) {
        // Topado a CHAIN_ZOOM_MAX_SCALE -no Infinity-: "el máximo posible
        // para aprovechar la pantalla" se probó sin techo y una cadena de un
        // único cliente sin invitados -caja mínima, casi un punto- se
        // ampliaba hasta llenar la pantalla con el aura de una sola estrella.
        const { rotationDelta, pan: fitPan } = fitChainRotationAndPan(
          chainLayoutPoints,
          rotationRef.current,
          halfW,
          half,
          CHAIN_ZOOM_MAX_SCALE,
          topInset,
          bottomInset,
        );
        // Mutación directa del ref, no estado: la rotación de fondo ya vive
        // fuera de React (el bucle de rAF la lee/incrementa cuadro a
        // cuadro), así que sumarle el ángulo elegido aquí es la misma
        // operación -solo que de una vez, no ROTATION_PER_FRAME a la vez- y
        // el resto del mapa sigue girando desde ese nuevo punto de partida.
        rotationRef.current += rotationDelta;
        setPan(fitPan);
      } else {
        setPan({ x: 0, y: 0, scale: 1 });
      }
    });
    const timeout = window.setTimeout(() => setAutoZooming(false), durationMs + 50);
    return () => window.clearTimeout(timeout);
  }, [selectedCategory, selectedId, chainMembers, layout, arcAngleRangeByState, frameRadius, size, halfW, half, cardHeightPx]);

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

      // El reloj del bamboleo avanza con el delta real entre fotogramas -no
      // uno fijo, para no depender de la tasa de refresco-, pero a
      // WOBBLE_FOCUS_SPEED en vez de a 1 mientras haya una cadena tocada: así
      // las esferas siguen vivas, solo mucho más quietas, y tocar la vecina
      // en el mismo encuadre cerrado deja de ser una lotería.
      const frameDelta = lastFrameTimeRef.current == null ? 0 : now - lastFrameTimeRef.current;
      lastFrameTimeRef.current = now;
      const wobbleSpeed = selectedIdRef.current ? WOBBLE_FOCUS_SPEED : 1;
      wobbleClockRef.current += frameDelta * wobbleSpeed;
      const wobbleNow = wobbleClockRef.current;

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
        nodePositions.push(animatedXY(point, rotation, wobbleNow, magnet, wobbleRestlessRef.current.get(point.id) ?? 1));
        nodeRadii.push(nodeRadiusRef.current.get(point.id) ?? 4);
      }
      // También sin imán activo, mientras haya una cadena tocada: sin tope de
      // escala (ver fitChainRotationAndPan) el zoom puede acercarse mucho, y a esa
      // distancia dos esferas que en reposo casi se tocaban -su posición
      // natural del layout no se pensó para verse tan de cerca- pasan a
      // superponerse de verdad. Mismo criterio "según su propio radio
      // visible" que ya usa el imán, solo que ahora corre también en reposo.
      if (magnetActive || selectedIdRef.current) resolveCollisions(nodePositions, nodeRadii, COLLISION_ITERATIONS, COLLISION_PADDING);

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

      // Destellos de "esto acaba de pasar" (ver detectGraphActivity): suben
      // y bajan en FLASH_DURATION_MS/SUN_FLASH_DURATION_MS con un
      // desvanecido de salida, no lineal -se apagan más despacio de lo que
      // suben, como cualquier resplandor real-, y se olvidan solos al
      // llegar al final en vez de quedar un mapa creciendo sin límite.
      for (const [id, flash] of nodeFlashRef.current) {
        const el = flashGlowRefs.current.get(id);
        const elapsed = now - flash.start;
        if (elapsed >= FLASH_DURATION_MS) {
          nodeFlashRef.current.delete(id);
          el?.setAttribute("fill-opacity", "0");
          continue;
        }
        const decay = Math.sin((1 - elapsed / FLASH_DURATION_MS) * (Math.PI / 2));
        el?.setAttribute("fill-opacity", (flash.intensity * decay * FLASH_MAX_OPACITY).toFixed(3));
      }
      const sunFlash = sunFlashRef.current;
      if (sunFlash) {
        const elapsed = now - sunFlash.start;
        if (elapsed >= SUN_FLASH_DURATION_MS) {
          sunFlashRef.current = null;
          sunFlashElRef.current?.setAttribute("fill-opacity", "0");
        } else {
          const decay = Math.sin((1 - elapsed / SUN_FLASH_DURATION_MS) * (Math.PI / 2));
          sunFlashElRef.current?.setAttribute("fill-opacity", (sunFlash.intensity * decay * SUN_FLASH_MAX_OPACITY).toFixed(3));
        }
      }
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
          // Un anillo tocado y una cadena tocada son dos modos de zoom
          // automático distintos -ver el efecto combinado más arriba, junto
          // a `chainMembers`-, así que mutuamente excluyentes: elegir uno
          // suelta el otro, nunca compiten los dos por el mismo `pan`.
          if (pending.arcState) {
            setSelectedCategory((prev) => (prev === pending.arcState ? null : pending.arcState));
            setSelectedId(null);
          } else if (pending.nodeId && pending.nodeId !== graph.establishment.id) {
            setSelectedId(pending.nodeId);
            setSelectedCategory(null);
          } else if (!pending.nodeId) {
            setSelectedId(null);
          }
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
    setSelectedCategory(null);
  }

  return (
    <div className="fixed inset-0 aurora-night text-chalk transition-[left] duration-200 ease-[var(--ease-out-soft)] lg:left-[var(--admin-sidebar-width,16rem)]">
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
        viewBox={`${-halfW} ${-half} ${halfW * 2} ${size}`}
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

        <g
          transform={`translate(${pan.x} ${pan.y}) scale(${pan.scale})`}
          style={autoZooming ? { transition: `transform ${autoZoomDurationMs}ms var(--ease-out-soft)` } : undefined}
        >
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
            const isPathLink = selectedId != null && chainMembers.has(link.toId);
            // Mismo criterio que en los nodos: una rama que terminó en nada
            // -caducada, descartada- se retira visualmente en vez de pesar
            // igual que una que sigue viva.
            const isMutedLink = toNode != null && CONSTELACION_MUTED_STATES.has(toNode.state);
            const restOpacity = isMutedLink ? 0.14 : 0.3;
            const restWidth = isMutedLink ? 0.9 : 1.3;
            // Rayo del sol -cliente sin padrino real, ver loadRealGiftGraph.ts:
            // todo el que no es claimed_by de ninguna invitación recibe un
            // enlace directo del establecimiento, tenga o no una fila en
            // attributions que le dé un estado normal de la cadena (claimed,
            // window...) además de "direct"-: el ajuste de la columna de
            // iconos puede apagar del todo estas líneas -son puro ruido
            // alrededor del sol en un local con muchas-, da igual qué más
            // esté pasando. Se mira el ORIGEN del enlace, no el estado del
            // destino -toNode?.state === "direct" se quedaba corto: un
            // cliente sin padrino con canje ya registrado sigue sin padrino,
            // aunque su estado ya no sea "direct" (window/claimed/billable),
            // y su rayo debía seguir gobernado por este mismo interruptor-.
            const isDirectLink = link.fromId === graph.establishment.id;
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
              // mismo criterio de ocultación que la propia línea, arriba -el
              // ORIGEN del enlace, no el estado actual del destino.
              if (selectedCategory != null) return false;
              if (!hideDirectLinks) return true;
              const childId = key.split(">")[1];
              return parentOf.get(childId ?? "") !== graph.establishment.id;
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
            {/* pointerEvents="none" en toda el aura -mismo motivo que en las
                estrellas, ver el comentario en el bucle de nodos más abajo-: la del
                destello llega a 5x ESTABLISHMENT_RADIUS, y sin esto se comía los
                toques de cualquier nodo raíz cercano que cayera dentro sin que
                hubiera nada visible ahí -el sol ya es opaco a los toques por su
                propio núcleo, no le hace falta también el aura. */}
            <circle className="constelacion-sun-aura-a" r={ESTABLISHMENT_RADIUS * 3.1} fill="url(#constelacion-glow)" fillOpacity={0.1} style={{ color: "var(--color-lime)" }} pointerEvents="none" />
            <circle className="constelacion-sun-aura-b" r={ESTABLISHMENT_RADIUS * 3.6} fill="url(#constelacion-glow)" fillOpacity={0.07} style={{ color: "var(--color-lime)" }} pointerEvents="none" />
            <circle className="constelacion-sun-aura-c" r={ESTABLISHMENT_RADIUS * 4.1} fill="url(#constelacion-glow)" fillOpacity={0.05} style={{ color: "var(--color-lime)" }} pointerEvents="none" />
            <circle cx={0} cy={0} r={ESTABLISHMENT_RADIUS * 2.5} fill="url(#constelacion-hub-glow)" pointerEvents="none" />
            {/* Sin nombre del local escrito encima -eso es justo lo que este mapa cambia
                respecto a ConstelacionMap-: el núcleo es solo el sol, el nombre vive
                fuera, en la esquina -ver la placa fija más abajo en el JSX. */}
            <circle cx={0} cy={0} r={ESTABLISHMENT_RADIUS} fill="url(#constelacion-sun-core)" />
            {/* Destello de "algo acaba de pasar en el local" -sube y baja una sola vez,
                ver detectGraphActivity y el paso de destellos en el bucle de rAF-, no la
                respiración constante de las auras de arriba: opacidad en 0 aquí, el
                propio bucle la sube cuando el sondeo detecta actividad real. */}
            <circle
              ref={sunFlashElRef}
              cx={0}
              cy={0}
              r={ESTABLISHMENT_RADIUS * 5}
              fill="url(#constelacion-glow)"
              fillOpacity={0}
              style={{ color: "var(--color-lime)" }}
              pointerEvents="none"
            />
          </g>

          {graph.nodes.map((node) => {
            const pt = layout.points.get(node.id);
            const pos = positions.get(node.id);
            if (!pt || !pos) return null;
            const isSelected = node.id === selectedId;
            const isChainMember = chainMembers.has(node.id);
            const dimmed = selectedId != null && !isChainMember;
            const isBest = node.id === bestPadrino;
            const isExpiringNode = expiringIds.has(node.id);
            const color = constelacionNodeColor(node);
            // Magnitud de esta estrella -tamaño y distancia ya resueltos en
            // el layout vía applyStarMagnitude-, aquí para lo que todavía
            // depende del propio render: a qué zoom se le ve el nombre y
            // qué tan viva titila.
            const magnitudeTier = starMagnitudeTier(node, stampsGoal);
            const labelScale = STAR_MAGNITUDE_LABEL_SCALE[magnitudeTier];
            const showLabel = node.claimed && (pan.scale >= labelScale || isSelected || isChainMember);
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
            const starCoreR = starCoreRadius(displayRadius);
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
                {/* pointerEvents="none" en todo lo decorativo de aquí abajo -halos,
                    auras, anillos-: un <circle> con fill, aunque sea un degradado
                    casi del todo transparente o en fillOpacity={0}, sigue siendo
                    tocable en toda su área geométrica -el navegador no mira el alfa
                    real del píxel-. Sin este atributo el aura de una estrella grande
                    -haloScale, hasta 2.6x displayRadius- se comía los toques
                    destinados a una vecina más pequeña que cae dentro de ese círculo
                    invisible, aunque a la vista pareciera claramente "la otra
                    esfera". Solo el núcleo sólido y el círculo de toque dedicado
                    -starTouchRadius, más abajo- deben seguir respondiendo. */}
                {isExpiringNode ? (
                  <circle
                    className="constelacion-alert-ring"
                    r={displayRadius + 6}
                    fill="none"
                    stroke="var(--color-coral)"
                    strokeWidth={1}
                    pointerEvents="none"
                  />
                ) : null}
                {isBest ? (
                  <circle
                    r={displayRadius * 2.1}
                    fill="url(#constelacion-glow)"
                    fillOpacity={0.16}
                    style={{ color: "var(--color-amber)" }}
                    pointerEvents="none"
                  />
                ) : null}
                {/* "Estás viendo esta" -toda la constelación (chainMembers, ver más
                    arriba) se resalta igual, sin dimming, y con muchas esferas a la vez
                    a la vista no habría forma de distinguir la tocada del resto sin esto:
                    un anillo neto, no un halo difuso -eso ya lo usan isBest/isExpiringNode
                    para otra cosa-, para que se lea como "aquí" y no como otro estado más. */}
                {isSelected ? (
                  <circle
                    r={displayRadius + 4.5}
                    fill="none"
                    stroke="var(--color-chalk)"
                    strokeWidth={1.3}
                    strokeOpacity={0.92}
                    pointerEvents="none"
                  />
                ) : null}

                <circle
                  className={isPositive ? "constelacion-billable-glow" : undefined}
                  r={displayRadius * haloScale}
                  fill="url(#constelacion-glow)"
                  fillOpacity={haloFillOpacity}
                  style={{ color }}
                  pointerEvents="none"
                />
                {/* Destello de "esto acaba de pasar aquí" -sello, canje o alta nueva
                    detectados por el sondeo, ver detectGraphActivity-: sube y baja una
                    sola vez, no en bucle como el resto de esta lista. Opacidad en 0 en
                    el marcado, el bucle de rAF la mueve fotograma a fotograma sobre su
                    propio elemento -mismo patrón que el pulso viajero de las cuerdas. */}
                <circle
                  ref={(el) => {
                    if (el) flashGlowRefs.current.set(node.id, el);
                    else flashGlowRefs.current.delete(node.id);
                  }}
                  r={displayRadius * 2.4}
                  fill="url(#constelacion-glow)"
                  fillOpacity={0}
                  style={{ color }}
                  pointerEvents="none"
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
                <circle r={starTouchRadius(starCoreR)} fill="transparent" />

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
      <header className="pointer-events-none fixed inset-x-0 top-0 z-30 flex items-start justify-between gap-3 px-5 pt-[max(1rem,env(safe-area-inset-top))] transition-[padding-left] duration-200 ease-[var(--ease-out-soft)] lg:pl-[calc(var(--admin-sidebar-width,16rem)+1.25rem)]">
        {/* A diferencia de ConstelacionMap -la portada del panel-, esta es una
            vista de comparación que cuelga de ella, así que el botón de la
            esquina vuelve a ser "volver a /admin", no el HomeIcon -> /inicio. */}
        {/* Flecha y placa en la misma fila, no una encima de la otra: una vista
            pensada para dejar ver el mapa de fondo no puede gastarse dos
            líneas de alto en su propia cabecera si con una le basta -y la
            placa, más pequeña que antes, gana la misma legibilidad ocupando
            menos-. */}
        <div className="flex items-center gap-2.5">
          <Link
            href="/admin"
            prefetch={false}
            className="btn glass-dark pointer-events-auto size-11 shrink-0 text-chalk"
            aria-label={t.admin.constelacionSolBack}
          >
            <ArrowLeftIcon className="size-5" />
          </Link>

          {/* El nombre del local, fuera del mapa -no escrito encima del sol, como
              en ConstelacionMap-: una placa fija en la esquina, tipo cartela de
              observatorio, ajena al SVG que se pellizca y arrastra. */}
          <div className="pointer-events-none flex min-w-0 flex-col gap-0.5">
            <p className="truncate text-[1rem] font-extrabold leading-none tracking-[-0.01em] text-chalk">{shopName}</p>
            <p className="eyebrow truncate text-[0.625rem] text-chalk/45">
              {t.admin.referralMap} · {customerCount} {t.admin.constelacionCustomersLabel}
            </p>
          </div>
        </div>

        {/* Misma caja que la leyenda -mismo glass-dark translúcido, mismo tamaño
            de letra-, y ocultable con su propio icono en la columna de la derecha. */}
        {hudVisible ? (
          <div className="glass-dark pointer-events-none flex flex-col items-end gap-0.5 p-2.5 sm:gap-1 sm:p-3.5" style={{ background: "rgba(10,14,13,0.32)" }}>
            <CountUpStat value={hud.sent} label={t.admin.sent} active={mounted} delayMs={0} />
            <CountUpStat value={hud.opened} label={t.admin.opened} active={mounted} delayMs={85} />
            <CountUpStat value={hud.redeemed} label={t.admin.redeemed} active={mounted} delayMs={170} />
            <CountUpStat value={hud.billable} label={t.admin.attrBillable} active={mounted} delayMs={255} />
            <CountUpStat value={hud.maxHops} label={t.admin.maxHops} active={mounted} delayMs={340} />
          </div>
        ) : null}
      </header>

      {/* Burbuja de "Action" en móvil/tablet -ver liveEvents.ts para el
          vocabulario y pushLiveEvent más arriba para quién la dispara-: el
          mismo suceso que alimenta el panel de escritorio (más abajo, en la
          columna izquierda), aquí como un aviso pasajero en la parte
          superior de la pantalla en vez de un historial permanente -en una
          pantalla tan chica un chat entero no cabría sin tapar el mapa-.
          Debajo de la fila de la cabecera -no encima-, con su propio offset
          fijo: la cabecera es de alto constante, no medido, así que no hace
          falta un ResizeObserver como el de la ficha. Oculta en escritorio
          -lg:hidden-, ahí ya está el panel de al lado.

          Como una notificación de verdad, no solo un texto flotando: el
          punto a la izquierda lleva el mismo color que la propia estrella
          -ver LiveActivityEvent.color, congelado al momento del suceso-,
          así de un vistazo se sabe qué clase de cliente lo protagonizó
          antes de leer una sola palabra; un segundo punto detrás, con
          animate-ping, le da el pulso de "esto acaba de pasar" que un
          simple texto centrado no transmite. */}
      <div
        className="pointer-events-none fixed inset-x-0 z-40 flex justify-center px-5 lg:hidden"
        style={{ top: "calc(max(1rem,env(safe-area-inset-top)) + 3.5rem)" }}
      >
        <div
          className="glass-dark flex max-w-[min(24rem,calc(100vw-2.5rem))] items-center gap-3 px-4 py-3 text-left text-[0.8125rem] leading-snug text-chalk transition-[transform,opacity] duration-300 ease-[var(--ease-out-soft)]"
          style={{
            background: "rgba(10,14,13,0.68)",
            transform: toastEvent ? "translateY(0)" : "translateY(-14px)",
            opacity: toastEvent ? 1 : 0,
          }}
        >
          {toastEvent ? (
            <>
              <span className="relative flex size-2.5 shrink-0">
                <span className="absolute inline-flex size-full animate-ping rounded-full opacity-60" style={{ background: toastEvent.color }} />
                <span className="relative inline-flex size-2.5 rounded-full" style={{ background: toastEvent.color }} />
              </span>
              <span>{liveEventMessage(toastEvent.kind, toastEvent.name, t)}</span>
            </>
          ) : null}
        </div>
      </div>

      {/* La leyenda vive en el lateral izquierdo, suelta de la columna de
          iconos -que se queda a la derecha, junto al resto de controles-:
          son contenedores fixed independientes, no un único bloque
          apilado. El propio anillo -selector de estado con el mismo
          efecto imán- vive dentro del SVG de arriba, no aquí: pertenece
          al mundo que se pellizca y arrastra, no a este overlay fijo. */}
      <div
        className="pointer-events-none fixed inset-y-0 left-3 z-20 flex flex-col justify-end pt-[max(1.25rem,env(safe-area-inset-top))] pb-[calc(3.375rem+env(safe-area-inset-bottom)+1.25rem)] transition-[left] duration-200 ease-[var(--ease-out-soft)] lg:left-[calc(var(--admin-sidebar-width,16rem)+0.75rem)] lg:pb-[max(1.25rem,env(safe-area-inset-bottom))]"
      >
        {/* Panel de escritorio -"como si fuera un chat en vivo"-: mismos
            sucesos que la burbuja de arriba, pero como historial que se
            queda, no un aviso que se desvanece. Solo `lg:`, y solo entonces
            participa del layout -`hidden` en el resto de anchos no le resta
            ni un píxel a la leyenda/ficha que le siguen debajo-. `flex-1
            min-h-0` dentro de esta misma columna -ya `justify-end`- para que
            crezca ocupando justo el hueco libre por encima de la
            leyenda/ficha, nunca empujándolas ni desbordando la pantalla por
            arriba. */}
        <div className="hidden min-h-0 lg:flex lg:flex-1 lg:flex-col">
          <div
            className="glass-dark pointer-events-auto flex min-h-0 flex-1 flex-col p-3"
            style={{ background: "rgba(10,14,13,0.32)" }}
          >
            <p className="eyebrow shrink-0 text-chalk/40">
              {t.admin.constelacionActionFeedTitle}
              {liveEvents.length > 0 ? ` · ${fill(t.admin.constelacionActionFeedCount, { n: liveEvents.length })}` : ""}
            </p>
            <div ref={liveFeedScrollRef} className="mt-2 flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto pr-1">
              {liveEvents.length === 0 ? (
                <p className="text-[0.6875rem] text-chalk/35">{t.admin.constelacionActionFeedEmpty}</p>
              ) : (
                liveEvents.map((event) => {
                  const hasName = event.name !== "";
                  return (
                    <div key={event.id} className="flex items-start gap-2">
                      <span className="mt-[0.3125rem] size-1.5 shrink-0 rounded-full" style={{ background: event.color }} />
                      <div className="min-w-0 flex-1">
                        <p className={cn("text-[0.6875rem] leading-snug", hasName ? "font-semibold text-chalk/90" : "text-chalk/55")}>
                          {liveEventMessage(event.kind, event.name, t)}
                        </p>
                        <p className="mt-0.5 text-[0.5625rem] text-chalk/35">{relativeTimeLabel(event.ts)}</p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
        <div
          className="glass-dark pointer-events-auto max-w-[min(15rem,calc(100vw-6rem))] p-3 transition-transform duration-300 ease-[var(--ease-out-soft)] sm:max-w-[16rem] sm:p-3.5"
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
          <p className="mt-0.5 text-[0.625rem] leading-snug text-chalk/30 sm:text-[0.6875rem]">{t.admin.constelacionLegendDesc}</p>
          <div className="mt-2 flex flex-col gap-1.5">
            {FUNNEL_ORDER.map((state) => {
              const isMutedRow = CONSTELACION_MUTED_STATES.has(state);
              // El propio punto de la leyenda ya es la burbuja a escala -mismo
              // multiplicador que dibuja el mapa-, así que enseña de un
              // vistazo que el tamaño también cuenta la fase del cliente.
              const swatchPx = 5 + CONSTELACION_PHASE_SIZE[state] * 6.5;
              return (
                <div key={state} className={cn("flex items-center gap-2 text-[0.6875rem] sm:text-[0.75rem]", isMutedRow ? "text-chalk/45" : "text-chalk/75")}>
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
                  <span className="numeral text-[0.625rem] text-chalk/40 sm:text-[0.6875rem]">{funnelCounts.get(state) ?? 0}</span>
                </div>
              );
            })}
          </div>
          <p className="mt-2.5 border-t border-white/8 pt-2.5 text-[0.5625rem] leading-tight text-chalk/40 sm:text-[0.625rem]">{t.admin.constelacionSizeLegend}</p>
          <p className="mt-1.5 text-[0.5625rem] leading-tight text-chalk/40 sm:text-[0.625rem]">{t.admin.constelacionBrightnessLegend}</p>
        </div>

        {/* La ficha vive en esta misma columna, justo debajo de la leyenda -no
            en su propio overlay a pantalla completa como en ConstelacionMap-:
            `justify-end` la empuja al fondo y dobla como último hijo, así que
            la leyenda -primer hijo- siempre queda por encima de ella cuando
            las dos están abiertas a la vez. */}
        <div ref={cardWrapRef} className="mt-2 pointer-events-none">
          <ConstelacionSheet
            variant="corner"
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
            ignoreOutsideClickRef={svgRef}
          />
        </div>
      </div>

      {/* La ficha ahora vive en la columna de la izquierda, apilada bajo la
          leyenda -ya no es un pliego de ancho completo-, así que no tapa
          esta columna: los botones se quedan visibles y usables aunque haya
          un nodo seleccionado. */}
      <div
        className="pointer-events-none fixed inset-y-0 right-3 z-20 flex flex-col items-end justify-end gap-2 pt-[max(1.25rem,env(safe-area-inset-top))] pb-[calc(3.375rem+env(safe-area-inset-bottom)+1.25rem)] lg:w-72 lg:pb-[max(1.25rem,env(safe-area-inset-bottom))]"
      >
        {/* "Lo que ninguna tarjeta te dice": lecturas de toda la red a la vez,
            no de una tarjeta suelta -solo escritorio, mismo patrón que el
            panel de actividad de la columna izquierda: `hidden lg:flex
            lg:flex-1 lg:min-h-0` para crecer ocupando el hueco libre por
            encima de la burbuja de categoría/columna de controles, sin
            empujarlas ni desbordar la pantalla por arriba-. Todo en cafés,
            nunca en €: ver el comentario de `insights` más arriba. */}
        <div className="hidden min-h-0 w-full lg:flex lg:flex-1 lg:flex-col">
          <div
            className="glass-dark pointer-events-auto flex min-h-0 flex-1 flex-col overflow-y-auto p-3"
            style={{ background: "rgba(10,14,13,0.32)" }}
          >
            <p className="eyebrow shrink-0 text-chalk/40">{t.admin.constelacionInsightsTitle}</p>
            <div className="mt-2 shrink-0 rounded-2xl p-3" style={{ background: "rgba(233,255,114,0.1)" }}>
              <p className="numeral text-[1.75rem] font-extrabold leading-none text-lime">{insights.referredPct}%</p>
              <p className="mt-1 text-[0.6875rem] leading-snug text-chalk/70">{t.admin.constelacionInsightsReferredPct}</p>
            </div>
            <dl className="mt-3 flex flex-col gap-2.5">
              {[
                { value: insights.costPerWonCoffees != null ? insights.costPerWonCoffees.toFixed(1) : "—", label: t.admin.constelacionInsightsCostPerWon, desc: t.admin.constelacionInsightsCostPerWonDesc },
                { value: insights.noReturnCount, label: t.admin.constelacionInsightsNoReturn, desc: t.admin.constelacionInsightsNoReturnDesc },
                { value: insights.expiredAttempts, label: t.admin.constelacionInsightsExpiredAttempts, desc: t.admin.constelacionInsightsExpiredAttemptsDesc },
                { value: insights.maxHops, label: t.admin.maxHops, desc: t.admin.constelacionInsightsMaxHopsDesc },
                { value: insights.dormantCount, label: t.admin.constelacionInsightsDormant, desc: t.admin.constelacionInsightsDormantDesc },
                { value: insights.readyToGiftCoffees, label: t.admin.constelacionInsightsReadyToGift, desc: t.admin.constelacionInsightsReadyToGiftDesc },
                { value: insights.expiringSoonCount, label: t.admin.constelacionInsightsExpiringSoon, desc: t.admin.constelacionInsightsExpiringSoonDesc },
                { value: insights.referrersToReview, label: t.admin.constelacionInsightsReferrersToReview, desc: t.admin.constelacionInsightsReferrersToReviewDesc },
              ].map((row, i) => (
                <div key={i} className="flex items-baseline gap-2.5">
                  <dd className="numeral shrink-0 text-[1.0625rem] font-bold leading-none text-chalk/90">{row.value}</dd>
                  <div className="min-w-0">
                    <dt className="text-[0.6875rem] leading-snug text-chalk/80">{row.label}</dt>
                    <dd className="mt-0.5 text-[0.5625rem] leading-snug text-chalk/40">{row.desc}</dd>
                  </div>
                </div>
              ))}
            </dl>
          </div>
        </div>
        <div className="pointer-events-none flex flex-col items-end gap-2">
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
              <p className="numeral text-[1.5rem] font-extrabold leading-none sm:text-[1.75rem]" style={{ color: CONSTELACION_ACCENT_COLOR[lastCategory] }}>
                {funnelCounts.get(lastCategory) ?? 0}
              </p>
              <p className="mt-1 text-[0.6875rem] leading-snug text-chalk/70 sm:text-[0.75rem]">{stateBadgeLabel(lastCategory, t)}</p>
            </div>
          ) : null}
        </div>
        {/* `items-end` en el contenedor (arriba), no `items-center`: antes, en
            cuanto se tocaba alguna vez una sección del anillo, la burbuja de
            categoría -que se queda montada para siempre, solo se desliza
            fuera con translateX, ver más arriba- ensanchaba este contenedor
            de ajuste-a-contenido (fixed, solo `right-3`, sin `left`) y
            `items-center` recentraba el botón de desplegar en medio de ese
            hueco más ancho -un salto visible hacia la izquierda que parecía
            venir de abrir/cerrar los controles, pero en realidad venía de
            haber tocado el anillo antes-. Con `items-end` cada hijo se pega
            siempre al borde derecho real, sin que el ancho del hermano lo
            mueva. */}
        <div className="pointer-events-auto flex flex-col items-center gap-2">
          {/* Los cinco botones de siempre, ahora plegados detrás de un único
              interruptor -ver más abajo-: de entrada solo hay un botón a la
              vista, no cinco. `grid-template-rows` de 0fr a 1fr -no solo
              opacidad- para que de verdad recojan el hueco que ocupan al
              cerrarse, no que se queden invisibles pero pesando lo mismo; el
              propio contenido además se desliza -hacia abajo al cerrar, hacia
              arriba al abrir-, así se lee como que se juntan/reparten, no
              como un simple parpadeo. */}
          <div
            className="grid overflow-hidden transition-[grid-template-rows] duration-300 ease-[var(--ease-out-soft)]"
            style={{ gridTemplateRows: controlsOpen ? "1fr" : "0fr" }}
          >
            <div className="flex min-h-0 flex-col items-center gap-2 overflow-hidden">
              <div
                className="flex flex-col items-center gap-2 transition-[transform,opacity] duration-300 ease-[var(--ease-out-soft)]"
                style={{
                  transform: controlsOpen ? "translateY(0)" : "translateY(14px)",
                  opacity: controlsOpen ? 1 : 0,
                }}
              >
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
                {/* Propio de esta vista -no existe en ConstelacionMap-: enciende/apaga
                    los rayos del sol -las líneas que van del núcleo a un cliente de
                    alta directa por QR-, el ruido visual más habitual alrededor del
                    núcleo. Apagados por defecto: en lima solo cuando están
                    encendidos -rayos visibles-, apagado/glass-dark cuando no los hay. */}
                <button
                  type="button"
                  onClick={() => setHideDirectLinks((v) => !v)}
                  aria-pressed={!hideDirectLinks}
                  aria-label={t.admin.constelacionHideDirectLinks}
                  title={t.admin.constelacionSettings}
                  className={cn("btn size-11", !hideDirectLinks ? "bg-lime text-ink" : "glass-dark text-chalk")}
                >
                  <SettingsIcon className="size-5" />
                </button>
                {/* Modo simulación -ver simulateGraphStep/simulateActivity.ts-:
                    fabrica actividad de mentira cada SIMULATION_STEP_MS para ver
                    el universo "vivo" sin esperar a que pasen cosas de verdad. En
                    lima mientras está encendido, igual que el resto de
                    interruptores de esta columna. */}
                <button
                  type="button"
                  onClick={() => setSimulating((v) => !v)}
                  aria-pressed={simulating}
                  aria-label={t.admin.constelacionSimulateToggle}
                  title={t.admin.constelacionSimulateToggle}
                  className={cn("btn size-11", simulating ? "bg-lime text-ink" : "glass-dark text-chalk")}
                >
                  <SparkleIcon className="size-5" />
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
          </div>
          <button
            type="button"
            onClick={() => setControlsOpen((v) => !v)}
            aria-expanded={controlsOpen}
            aria-label={t.admin.constelacionToggleControls}
            className="btn glass-dark size-11 text-chalk"
          >
            <ChevronDownIcon className={cn("size-5 transition-transform duration-300 ease-[var(--ease-out-soft)]", controlsOpen ? "rotate-180" : "")} />
          </button>
        </div>
      </div>

      <footer
        className="pointer-events-none fixed inset-x-0 bottom-0 z-20 flex flex-col items-center gap-3 px-5 pb-[calc(3.375rem+env(safe-area-inset-bottom)+1.25rem)] transition-[padding-left] duration-200 ease-[var(--ease-out-soft)] lg:pb-[max(1.25rem,env(safe-area-inset-bottom))] lg:pl-[calc(var(--admin-sidebar-width,16rem)+1.25rem)]"
      >
        {!selectedNode && !touched ? (
          <p className="text-[0.65625rem] text-chalk/32 transition-opacity duration-300">
            {funnelTotal === 0 ? t.admin.referralMapEmpty : t.admin.referralMapHint}
          </p>
        ) : null}
      </footer>

      <BottomNav t={t.admin} active="constelacion" collapsible />
    </div>
  );
}
