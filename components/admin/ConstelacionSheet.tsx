"use client";

import { useEffect, useRef, useState } from "react";
import { XIcon } from "@/components/ui/Icons";
import { StampCard } from "@/components/ui/StampCard";
import { cn } from "@/lib/cn";
import { fill, formatDateTime, type Dict, type Locale } from "@/lib/i18n";
import type { Node } from "@/lib/giftGraph/types";

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Ficha propia de la constelación -no la del universo 3D-: la
 * especificación pide una línea de invitación, canjeado/consumos/ventana y
 * la propia tarjeta de sellos -en vez de una barra de progreso genérica-,
 * que la ficha compartida no tiene. Se mantiene montada siempre -solo se
 * traslada fuera de pantalla al cerrar- para poder animar la salida igual
 * que la entrada; el último nodo mostrado se recuerda en estado -no en un
 * ref, que no se puede leer durante el render- para que el contenido no
 * parpadee a vacío durante esa transición.
 */
export function ConstelacionSheet({
  node,
  giftedByName,
  invitedCount,
  sentAt,
  color,
  stampsGoal,
  returnWindowDays,
  nowMs,
  locale,
  t,
  onClose,
  variant = "sheet",
  ignoreOutsideClickRef,
}: {
  node: Node | null;
  giftedByName: string;
  invitedCount: number;
  /** Cuándo se le envió la invitación que trajo a este nodo -viene del propio enlace del grafo, no del nodo-. null en clientes directos, que no vinieron de ninguna invitación. */
  sentAt: string | null;
  color: string;
  stampsGoal: number;
  returnWindowDays: number;
  nowMs: number;
  locale: Locale;
  t: Dict;
  onClose: () => void;
  /**
   * "sheet" -por defecto, ConstelacionMap-: pliego de ancho completo que sube
   * desde el borde inferior, con su propio contenedor fijo. "corner" -solo
   * ConstelacionSolMap-: sin contenedor fijo propio -el padre ya la coloca,
   * apilada bajo la leyenda en la esquina inferior izquierda-, más estrecha
   * y deslizándose desde la izquierda en vez de desde abajo.
   */
  variant?: "sheet" | "corner";
  /**
   * El propio lienzo del mapa (su `<svg>`): un toque ahí dentro NUNCA debe
   * cerrar por "fuera", aunque el punto tocado no sea la tarjeta -el mapa ya
   * decide por su cuenta qué hacer con ese toque (seleccionar otra esfera,
   * una sección del anillo, o deseleccionar en vacío), en su propio
   * `pointerup`. Sin excluirlo, el cierre por fuera -en `pointerdown`, antes
   * de que el mapa resuelva el gesto en `pointerup`- deseleccionaba primero
   * y el mapa reseleccionaba después: dos renders separados con `null` en
   * medio, que se veía como si el zoom se deshiciera y volviera a hacerse
   * de golpe al tocar una esfera vecina.
   */
  ignoreOutsideClickRef?: React.RefObject<Element | null>;
}) {
  const initialSnapshot = node ? { node, giftedByName, invitedCount, sentAt, color } : null;
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  useEffect(() => {
    // Diferido a un microtask -como el flag `mounted` de ConstelacionMap-: evita
    // el aviso de "cascading renders" sin retrasar visualmente el cambio,
    // porque los microtasks corren antes de que el navegador pinte el frame.
    if (node) queueMicrotask(() => setSnapshot({ node, giftedByName, invitedCount, sentAt, color }));
  }, [node, giftedByName, invitedCount, sentAt, color]);

  const open = node != null;

  // Cerrar al tocar fuera: cualquier puntero que baje fuera del propio
  // recuadro de la tarjeta la cierra, sin importar sobre qué caiga -otra
  // esfera, el fondo del mapa, un botón de la columna de iconos-. En
  // `pointerdown`, no en `click`: así cierra en el mismo instante en que
  // empieza el toque, antes de que ese mismo gesto pueda además seleccionar
  // otra esfera -React aplica los dos cambios de estado en el mismo ciclo,
  // así que no hay parpadeo-.
  const cardRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!open) return;
    function handlePointerDown(event: PointerEvent) {
      // `as globalThis.Node`, no `as Node` -este archivo importa `Node` como
      // el tipo del grafo (@/lib/giftGraph/types), que le tapa el nombre al
      // `Node` del DOM que `contains()` de verdad espera-.
      const target = event.target as globalThis.Node;
      if (cardRef.current?.contains(target)) return;
      if (ignoreOutsideClickRef?.current?.contains(target)) return;
      onClose();
    }
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [open, onClose, ignoreOutsideClickRef]);

  if (!snapshot) return null;

  const shown = snapshot.node;
  const isPending = !shown.claimed;
  // Histórico real, no solo la tarjeta en curso: tarjetas completadas antes
  // de esta -a stampsGoal cada una- más los sellos que lleva ahora mismo.
  const totalConsumed = shown.cardsCompleted * stampsGoal + shown.stamps;

  const daysSinceLastVisit = Math.max(0, Math.floor((nowMs - new Date(shown.lastActivityAt).getTime()) / DAY_MS));
  const lastVisitText =
    daysSinceLastVisit === 0
      ? t.admin.constelacionToday
      : daysSinceLastVisit === 1
        ? t.admin.constelacionDaysAgoOne
        : fill(t.admin.constelacionDaysAgoMany, { n: daysSinceLastVisit });

  // La cuenta atrás de la ventana solo tiene sentido mientras el cliente
  // TODAVÍA no es nuevo verificado -sigue en "window", esperando su
  // segunda compra-: una vez lo es, esa cuenta atrás ya no cuenta nada, así
  // que el mismo hueco pasa a enseñar hace cuánto fue su última visita.
  const isWaitingOnWindow = shown.state === "window" && shown.redeemedAt != null;
  const windowDaysLeft = isWaitingOnWindow
    ? Math.max(0, returnWindowDays - Math.floor((nowMs - new Date(shown.redeemedAt as string).getTime()) / DAY_MS))
    : null;
  const windowOrLastVisitLabel = isWaitingOnWindow ? t.admin.constelacionWindowLabel : t.admin.constelacionLastVisitLabel;
  const windowOrLastVisitValue = !isWaitingOnWindow
    ? lastVisitText
    : windowDaysLeft === 0
      ? t.admin.constelacionWindowClosed
      : windowDaysLeft === 1
        ? t.admin.constelacionWindowDaysLeftOne
        : fill(t.admin.constelacionWindowDaysLeftMany, { n: windowDaysLeft as number });

  // Enviada + invitados en una sola frase legible, no dos celdas sueltas sin
  // contexto: un cliente directo (alta por QR) nunca recibió invitación, así
  // que para ellos solo tiene sentido la parte de a cuántos han invitado.
  const sentInvitedLine =
    snapshot.sentAt && shown.state !== "direct"
      ? fill(t.admin.constelacionSentInvitedLine, { date: formatDateTime(snapshot.sentAt, locale), n: snapshot.invitedCount })
      : fill(t.admin.constelacionInvitedOnlyLine, { n: snapshot.invitedCount });

  // Corner -20rem, junto a la leyenda- sigue siendo más estrecha que sheet
  // -30/34rem-, así que cada componente de dentro lleva su propio par de
  // tamaños en vez de uno solo pensado para el ancho mayor: en corner el
  // nombre truncaría en dos palabras y la cuadrícula de datos se apretaría
  // sin este ajuste. Un poco más ancha que antes (16rem→20rem) a propósito:
  // ese margen de más deja que la línea de invitación quepa sin partirse en
  // dos, así la tarjeta entera pesa menos de alto -gana ese hueco arriba
  // para el mapa- sin perder ningún dato.
  const compact = variant === "corner";

  const card = (
    <div
      ref={cardRef}
      className={cn(
        "glass-dark overflow-hidden shadow-[0_-18px_50px_rgba(0,0,0,0.5)] transition-transform duration-[400ms] ease-[cubic-bezier(0.22,1,0.36,1)]",
        compact ? "w-[min(20rem,calc(100vw-2rem))] p-4" : "w-full max-w-[30rem] p-5 sm:max-w-[34rem]",
        open ? "pointer-events-auto" : "pointer-events-none",
      )}
      aria-hidden={compact ? !open : undefined}
      style={{
        // -120% de su propio ancho -no de la pantalla- alcanzaba cuando esta
        // columna vivía pegada al borde izquierdo; ahora que comparte fila
        // con el panel de actividad (`md:w-64` a su izquierda, ver
        // ConstelacionSolMap) la tarjeta arranca más a la derecha, y ese
        // mismo -120% ya no la saca de la pantalla -se quedaba asomando,
        // visible, junto al panel de actividad-. -200vw sí lo garantiza
        // siempre, sea cual sea la posición de partida de esta columna.
        transform: open ? "translate(0, 0)" : compact ? "translateX(-200vw)" : "translateY(102%)",
      }}
    >
        {variant === "sheet" ? <div className="mx-auto mb-3 h-[3.5px] w-[34px] rounded-full bg-white/16" /> : null}

        {/* Estado arriba del todo -junto a la X, misma fila-, nombre debajo:
            así se lee primero "qué es" y luego "quién es", y el cierre queda
            siempre en la esquina donde se espera en vez de un botón aparte
            al final de la tarjeta. */}
        <div className="flex items-center justify-between gap-2">
          <span
            className={cn(
              "shrink-0 rounded-full font-bold uppercase tracking-[0.12em]",
              compact ? "px-2.5 py-1 text-[0.5625rem]" : "px-[13px] py-[7px] text-[0.625rem]",
            )}
            style={{ background: `color-mix(in srgb, ${snapshot.color} 15%, transparent)`, color: snapshot.color }}
          >
            {stateBadgeText(shown, t)}
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label={t.common.close}
            className={cn("btn -m-1 shrink-0 text-chalk/55 hover:text-chalk", compact ? "size-7" : "size-9")}
          >
            <XIcon className={compact ? "size-3.5" : "size-5"} />
          </button>
        </div>

        <p className={cn("truncate font-extrabold tracking-[-0.025em]", compact ? "mt-1.5 text-[1.125rem]" : "mt-2 text-[1.5rem]")}>
          {isPending ? t.admin.constelacionPendingInvite : shown.name}
        </p>
        <p className={cn("mt-1 font-semibold uppercase tracking-[0.15em] text-chalk/34", compact ? "text-[0.5625rem]" : "text-[0.6875rem]")}>
          {t.admin.attrPadrino} · {snapshot.giftedByName || "—"}
        </p>

        <p className={cn("leading-snug text-chalk/75", compact ? "mt-2 text-[0.6875rem]" : "mt-3 text-[0.8125rem]")}>{sentInvitedLine}</p>

        {isPending ? null : (
          <dl className={cn("numeral grid grid-cols-3", compact ? "mt-2 gap-2 text-[0.5625rem]" : "mt-3 gap-3 text-[0.6875rem]")}>
            <div>
              <dt className="text-chalk/34">{t.admin.attrRedeemed}</dt>
              <dd className={cn("mt-0.5 font-semibold text-chalk/90", compact ? "text-[0.75rem]" : "text-[0.9375rem]")}>
                {shown.redeemedAt ? formatDateTime(shown.redeemedAt, locale) : "—"}
              </dd>
            </div>
            <div>
              <dt className="text-chalk/34">{t.admin.constelacionConsumptionsLabel}</dt>
              <dd className={cn("mt-0.5 font-semibold text-chalk/90", compact ? "text-[0.75rem]" : "text-[0.9375rem]")}>{totalConsumed}</dd>
            </div>
            <div>
              <dt className="text-chalk/34">{windowOrLastVisitLabel}</dt>
              <dd className={cn("mt-0.5 font-semibold text-chalk/90", compact ? "text-[0.75rem]" : "text-[0.9375rem]")}>{windowOrLastVisitValue}</dd>
            </div>
          </dl>
        )}

        {isPending ? null : (
          <div className={compact ? "mt-2" : "mt-3"}>
            <StampCard stamps={shown.stamps} goal={stampsGoal} tone="dark" />
            <p className={cn("numeral mt-1.5 text-chalk/40", compact ? "text-[0.5625rem]" : "text-[0.6875rem]")}>
              {fill(t.admin.constelacionCardsCompletedLine, { n: shown.cardsCompleted })}
            </p>
          </div>
        )}
    </div>
  );

  if (variant === "corner") return card;

  return (
    <div
      // 3.375rem = alto de BottomNav sin zona segura -ver el mismo cálculo en
      // ConstelacionMap-: la barra es fija en móvil/tablet -por debajo de
      // `md`-, así que ahí la ficha tiene que despegarse de su borde de
      // pantalla, no solo llevar más z-index. A partir de `md` BottomNav pasa
      // a sidebar izquierdo -ver BottomNav.tsx-, sin barra inferior que
      // despejar, así que el padding cae a `md:pb-[max(1rem,...)]`, el
      // margen de siempre; `md:pl-[16rem]` -mismo ancho que
      // ADMIN_SIDEBAR_WIDTH, repetido a mano porque Tailwind no puede leer esa
      // constante JS en una clase- recentra la ficha en el hueco visible junto
      // al sidebar, no en todo el ancho de la pantalla.
      className="pointer-events-none fixed inset-x-0 bottom-0 z-30 flex justify-center px-3 pb-[calc(3.375rem+env(safe-area-inset-bottom)+1rem)] md:pb-[max(1rem,env(safe-area-inset-bottom))] md:pl-[16rem]"
      aria-hidden={!open}
    >
      {card}
    </div>
  );
}

function stateBadgeText(node: Node, t: Dict): string {
  const label: Record<Node["state"], string> = {
    billable: t.admin.attrBillable,
    direct: t.admin.attrDirect,
    window: t.admin.attrWindow,
    discarded: t.admin.attrDiscarded,
    claimed: t.admin.attrClaimed,
    opened: t.admin.attrOpened,
    sent: t.admin.attrSent,
    expired: t.admin.attrExpired,
  };
  return label[node.state];
}
