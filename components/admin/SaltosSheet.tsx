"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";
import { formatDateTime, type Dict, type Locale } from "@/lib/i18n";
import type { Node } from "@/lib/giftGraph/types";

/**
 * Ficha propia de la constelación de saltos -no la del universo 3D-: la
 * especificación pide una rejilla 2x2 (enviada/canjeado/salto/invitados) y
 * una barra de progreso de la tarjeta que la ficha compartida no tiene.
 * Se mantiene montada siempre -solo se traslada fuera de pantalla al
 * cerrar- para poder animar la salida igual que la entrada; el último nodo
 * mostrado se recuerda en estado -no en un ref, que no se puede leer
 * durante el render- para que el contenido no parpadee a vacío durante
 * esa transición.
 */
export function SaltosSheet({
  node,
  giftedByName,
  invitedCount,
  color,
  stampsGoal,
  locale,
  t,
  onClose,
}: {
  node: Node | null;
  giftedByName: string;
  invitedCount: number;
  color: string;
  stampsGoal: number;
  locale: Locale;
  t: Dict;
  onClose: () => void;
}) {
  const initialSnapshot = node ? { node, giftedByName, invitedCount, color } : null;
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  useEffect(() => {
    // Diferido a un microtask -como el flag `mounted` de SaltosMap-: evita
    // el aviso de "cascading renders" sin retrasar visualmente el cambio,
    // porque los microtasks corren antes de que el navegador pinte el frame.
    if (node) queueMicrotask(() => setSnapshot({ node, giftedByName, invitedCount, color }));
  }, [node, giftedByName, invitedCount, color]);

  const open = node != null;
  if (!snapshot) return null;

  const shown = snapshot.node;
  const isPending = !shown.claimed;
  const progress = stampsGoal > 0 ? Math.min(1, Math.max(0, shown.stamps / stampsGoal)) : 0;

  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-0 z-30 flex justify-center px-3 pb-[max(1rem,env(safe-area-inset-bottom))]"
      aria-hidden={!open}
    >
      <div
        className={cn(
          "w-full max-w-[30rem] overflow-hidden rounded-[var(--radius-card)] border border-white/10 bg-ink p-5 shadow-[0_-18px_50px_rgba(0,0,0,0.5)] transition-transform duration-[400ms] ease-[cubic-bezier(0.22,1,0.36,1)] sm:max-w-[34rem]",
          open ? "pointer-events-auto" : "pointer-events-none",
        )}
        style={{ transform: open ? "translateY(0)" : "translateY(102%)" }}
      >
        <div className="mx-auto mb-3 h-[3.5px] w-[34px] rounded-full bg-white/16" />

        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-[1.5rem] font-extrabold tracking-[-0.025em]">
              {isPending ? t.admin.saltosPendingInvite : shown.name}
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

        <dl className="numeral mt-4 grid grid-cols-2 gap-3 text-[0.6875rem]">
          <div>
            <dt className="text-chalk/34">{t.admin.saltosSentAt}</dt>
            <dd className="mt-0.5 text-[0.9375rem] font-semibold text-chalk/90">{formatDateTime(shown.lastActivityAt, locale)}</dd>
          </div>
          <div>
            <dt className="text-chalk/34">{t.admin.attrRedeemed}</dt>
            <dd className="mt-0.5 text-[0.9375rem] font-semibold text-chalk/90">
              {shown.redeemedAt ? formatDateTime(shown.redeemedAt, locale) : "—"}
            </dd>
          </div>
          <div>
            <dt className="text-chalk/34">{t.admin.saltosHopFieldLabel}</dt>
            <dd className="mt-0.5 text-[0.9375rem] font-semibold text-chalk/90">{shown.depth}</dd>
          </div>
          <div>
            <dt className="text-chalk/34">{t.admin.saltosInvitedLabel}</dt>
            <dd className="mt-0.5 text-[0.9375rem] font-semibold text-chalk/90">{snapshot.invitedCount}</dd>
          </div>
        </dl>

        {isPending ? null : (
          <div className="mt-4 h-[5px] w-full overflow-hidden rounded-full bg-white/9">
            <div
              className="h-full rounded-full bg-lime transition-[width] duration-[700ms] delay-[120ms] ease-[cubic-bezier(0.22,1,0.36,1)]"
              style={{ width: `${progress * 100}%` }}
            />
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
    opened: t.admin.attrOpened,
    sent: t.admin.attrSent,
    expired: t.admin.attrExpired,
  };
  return label[node.state];
}
