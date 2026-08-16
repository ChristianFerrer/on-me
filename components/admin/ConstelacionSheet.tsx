"use client";

import { useEffect, useState } from "react";
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

  return (
    <div
      // 3.375rem = alto de BottomNav sin zona segura -ver el mismo cálculo en
      // ConstelacionMap/ConstelacionSolMap-: la barra es fija en móvil/tablet
      // -por debajo de `lg`-, así que ahí la ficha tiene que despegarse de su
      // borde de pantalla, no solo llevar más z-index. A partir de `lg`
      // BottomNav pasa a sidebar izquierdo -ver BottomNav.tsx-, sin barra
      // inferior que despejar, así que el padding cae a `lg:pb-[max(1rem,...)]`,
      // el margen de siempre; `lg:pl-[16rem]` -mismo ancho que
      // ADMIN_SIDEBAR_WIDTH, repetido a mano porque Tailwind no puede leer esa
      // constante JS en una clase- recentra la ficha en el hueco visible junto
      // al sidebar, no en todo el ancho de la pantalla.
      className="pointer-events-none fixed inset-x-0 bottom-0 z-30 flex justify-center px-3 pb-[calc(3.375rem+env(safe-area-inset-bottom)+1rem)] lg:pb-[max(1rem,env(safe-area-inset-bottom))] lg:pl-[16rem]"
      aria-hidden={!open}
    >
      <div
        className={cn(
          "glass-dark w-full max-w-[30rem] overflow-hidden p-5 shadow-[0_-18px_50px_rgba(0,0,0,0.5)] transition-transform duration-[400ms] ease-[cubic-bezier(0.22,1,0.36,1)] sm:max-w-[34rem]",
          open ? "pointer-events-auto" : "pointer-events-none",
        )}
        style={{ transform: open ? "translateY(0)" : "translateY(102%)" }}
      >
        <div className="mx-auto mb-3 h-[3.5px] w-[34px] rounded-full bg-white/16" />

        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-[1.5rem] font-extrabold tracking-[-0.025em]">
              {isPending ? t.admin.constelacionPendingInvite : shown.name}
            </p>
            <p className="mt-1.5 text-[0.6875rem] font-semibold uppercase tracking-[0.15em] text-chalk/34">
              {t.admin.attrPadrino} · {snapshot.giftedByName || "—"}
            </p>
          </div>
          <span
            className="shrink-0 rounded-full px-[13px] py-[7px] text-[0.625rem] font-bold uppercase tracking-[0.12em]"
            style={{ background: `color-mix(in srgb, ${snapshot.color} 15%, transparent)`, color: snapshot.color }}
          >
            {stateBadgeText(shown, t)}
          </span>
        </div>

        <p className="mt-4 text-[0.8125rem] leading-snug text-chalk/75">{sentInvitedLine}</p>

        {isPending ? null : (
          <dl className="numeral mt-3 grid grid-cols-3 gap-3 text-[0.6875rem]">
            <div>
              <dt className="text-chalk/34">{t.admin.attrRedeemed}</dt>
              <dd className="mt-0.5 text-[0.9375rem] font-semibold text-chalk/90">
                {shown.redeemedAt ? formatDateTime(shown.redeemedAt, locale) : "—"}
              </dd>
            </div>
            <div>
              <dt className="text-chalk/34">{t.admin.constelacionConsumptionsLabel}</dt>
              <dd className="mt-0.5 text-[0.9375rem] font-semibold text-chalk/90">{shown.stamps}</dd>
            </div>
            <div>
              <dt className="text-chalk/34">{windowOrLastVisitLabel}</dt>
              <dd className="mt-0.5 text-[0.9375rem] font-semibold text-chalk/90">{windowOrLastVisitValue}</dd>
            </div>
          </dl>
        )}

        {isPending ? null : (
          <div className="mt-4">
            <StampCard stamps={shown.stamps} goal={stampsGoal} tone="dark" />
            <p className="numeral mt-2 text-[0.6875rem] text-chalk/40">{fill(t.admin.constelacionTotalConsumedLine, { n: totalConsumed })}</p>
          </div>
        )}

        <button
          type="button"
          onClick={onClose}
          className="btn mt-4 w-full rounded-full bg-white/7 py-3 text-[0.875rem] text-chalk"
        >
          {t.common.close}
        </button>
      </div>
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
