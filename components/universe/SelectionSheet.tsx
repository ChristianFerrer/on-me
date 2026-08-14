"use client";

import { XIcon } from "@/components/ui/Icons";
import { fill, formatDate, plural, type Dict, type Locale } from "@/lib/i18n";
import type { Node } from "@/lib/giftGraph/types";

export function SelectionSheet({
  node,
  giftedByName,
  rootName,
  locale,
  t,
  onClose,
}: {
  node: Node | null;
  giftedByName: string;
  rootName: string;
  locale: Locale;
  t: Dict;
  onClose: () => void;
}) {
  if (!node) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30 flex justify-center px-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
      <div className="glass-dark pointer-events-auto w-full max-w-[30rem] rounded-3xl border border-white/10 p-5 sm:max-w-[34rem]">
        <div className="mb-4 flex items-start justify-between gap-3">
          <h2 className="text-[1.25rem] font-bold text-chalk">{node.name}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={t.common.close}
            className="btn -m-1 size-9 shrink-0 text-chalk/60 hover:text-chalk"
          >
            <XIcon className="size-5" />
          </button>
        </div>

        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-[0.875rem]">
          <div>
            <dt className="text-chalk/45">{t.admin.universeGiftedByLabel}</dt>
            <dd className="mt-0.5 font-semibold text-chalk">{giftedByName}</dd>
          </div>
          <div>
            <dt className="text-chalk/45">{t.admin.universeGiftedOnLabel}</dt>
            <dd className="mt-0.5 font-semibold text-chalk">{formatDate(node.giftedAt, locale)}</dd>
          </div>
          <div>
            <dt className="text-chalk/45">{t.admin.universeGiftsGivenLabel}</dt>
            <dd className="mt-0.5 font-semibold text-lime">
              {fill(plural(node.childCount, t.admin.universeGiftsGivenValueOne, t.admin.universeGiftsGivenValueMany), {
                n: node.childCount,
              })}
            </dd>
          </div>
          <div>
            <dt className="text-chalk/45">{t.admin.universeChainLabel}</dt>
            <dd className="mt-0.5 font-semibold text-chalk">{rootName}</dd>
          </div>
        </dl>
      </div>
    </div>
  );
}
