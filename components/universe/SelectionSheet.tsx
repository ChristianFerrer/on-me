"use client";

import { XIcon } from "@/components/ui/Icons";
import { cn } from "@/lib/cn";
import { STATE_BADGE_SKIN, stateBadgeLabel } from "@/lib/giftGraph/stateBadge";
import { formatDateTime, type Dict, type Locale } from "@/lib/i18n";
import type { Node } from "@/lib/giftGraph/types";

/**
 * Misma tarjeta que /admin/atribuciones (nombre, padrino, canjeado, volvió,
 * badge de estado): quien ya conoce esa lista reconoce esto al instante,
 * en vez de aprenderse una ficha nueva solo para el mapa.
 */
export function SelectionSheet({
  node,
  giftedByName,
  locale,
  t,
  onClose,
}: {
  node: Node | null;
  giftedByName: string;
  locale: Locale;
  t: Dict;
  onClose: () => void;
}) {
  if (!node) return null;

  // Invitación sin reclamar: no tiene nombre -createInvitation no lo pide,
  // llega en el claim-, así que ni lo inventamos ni enseñamos el código
  // interno. Un texto genérico y la fecha de envío bastan.
  const isPending = !node.claimed;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30 flex justify-center px-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
      <div className="glass-dark pointer-events-auto w-full max-w-[30rem] rounded-3xl border border-white/10 p-5 sm:max-w-[34rem]">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-[1.0625rem] font-semibold">
              {isPending ? t.admin.saltosPendingInvite : node.name}
            </p>
            <p className="eyebrow mt-1.5 text-chalk/35">
              {t.admin.attrPadrino} · {giftedByName || "—"}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <span className={cn("eyebrow rounded-full px-2.5 py-1", STATE_BADGE_SKIN[node.state])}>
              {stateBadgeLabel(node.state, t)}
            </span>
            <button
              type="button"
              onClick={onClose}
              aria-label={t.common.close}
              className="btn -m-1 size-9 shrink-0 text-chalk/60 hover:text-chalk"
            >
              <XIcon className="size-5" />
            </button>
          </div>
        </div>

        {isPending ? (
          <div className="numeral mt-4 text-[0.75rem] text-chalk/45">
            <dt className="text-chalk/30">{t.admin.saltosSentAt}</dt>
            <dd className="mt-0.5">{formatDateTime(node.lastActivityAt, locale)}</dd>
          </div>
        ) : (
          <dl className="numeral mt-4 grid grid-cols-2 gap-3 text-[0.75rem] text-chalk/45">
            <div>
              <dt className="text-chalk/30">{t.admin.attrRedeemed}</dt>
              <dd className="mt-0.5">{node.redeemedAt ? formatDateTime(node.redeemedAt, locale) : "—"}</dd>
            </div>
            <div>
              <dt className="text-chalk/30">{t.admin.attrReturned}</dt>
              <dd className="mt-0.5">{node.returnedAt ? formatDateTime(node.returnedAt, locale) : "—"}</dd>
            </div>
          </dl>
        )}
      </div>
    </div>
  );
}
