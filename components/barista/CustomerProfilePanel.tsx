"use client";

import { useState } from "react";
import { GiftIcon, UserIcon, XIcon } from "@/components/ui/Icons";
import { StampCard } from "@/components/ui/StampCard";
import { cn } from "@/lib/cn";
import type { Dict } from "@/lib/i18n";
import type { IdentifyProfile } from "./useIdentifyFlow";

type BaristaDict = Dict["barista"];

/** Cuántos sellos se pueden dar de una vez desde el perfil -0, para quien solo viene a canjear-. */
const STAMP_OPTIONS = [0, 1, 2, 3, 4, 5];
/** Tope del selector de canje: si acumuló más de 5, se canjean en dos pasadas. */
const MAX_REDEEM_OPTIONS = 5;

/**
 * El perfil del cliente tras identificarlo: lo que tiene hoy, y las dos
 * decisiones del barista -cuántos sellos, cuántos canjea- en la misma
 * pantalla. A diferencia del escáner clásico, aquí completar una tarjeta
 * no obliga a resolver el premio en el momento: se ve acumulado y se
 * canjea cuando el cliente lo pida.
 */
export function CustomerProfilePanel({
  t,
  profile,
  busy,
  onCancel,
  onConfirm,
}: {
  t: BaristaDict;
  profile: IdentifyProfile;
  busy: boolean;
  onCancel: () => void;
  onConfirm: (addStamps: number, redeemCount: number) => void;
}) {
  const [addStamps, setAddStamps] = useState(1);
  const [redeemCount, setRedeemCount] = useState(0);

  const redeemCap = Math.min(profile.rewardsPending, MAX_REDEEM_OPTIONS);
  const redeemOptions = Array.from({ length: redeemCap + 1 }, (_, i) => i);
  const canConfirm = addStamps > 0 || redeemCount > 0;

  return (
    <div className="fixed inset-0 z-[60] flex flex-col overflow-y-auto aurora-night text-chalk">
      <header className="flex items-center justify-between px-5 pt-[max(1.25rem,env(safe-area-inset-top))]">
        <p className="eyebrow text-chalk/45">{t.identifyProfileTitle}</p>
        <button
          type="button"
          onClick={onCancel}
          aria-label={t.cancel}
          className="btn glass-dark size-10 rounded-full text-chalk"
        >
          <XIcon className="size-4" />
        </button>
      </header>

      <div className="flex flex-1 flex-col gap-5 px-5 py-6">
        <h1 className="display break-words text-[2.25rem]">{profile.name}</h1>

        <section className="glass-dark p-5">
          <span className="numeral text-[1.5rem] font-semibold">
            {profile.stamps}
            <span className="text-chalk/30">/{profile.goal}</span>
          </span>
          <StampCard stamps={profile.stamps} goal={profile.goal} tone="dark" className="mt-4" />
        </section>

        <div className="grid grid-cols-2 gap-3">
          <div className="glass-dark flex flex-col items-center gap-1 p-4 text-center">
            <GiftIcon className="size-5 text-lime" />
            <span className="numeral text-[1.375rem] font-semibold">{profile.rewardsPending}</span>
            <span className="text-[0.75rem] text-chalk/50">{t.identifyRewardsPendingLabel}</span>
          </div>
          <div className="glass-dark flex flex-col items-center gap-1 p-4 text-center">
            <UserIcon className="size-5 text-azure" />
            <span className="numeral text-[1.375rem] font-semibold">{profile.invitedCount}</span>
            <span className="text-[0.75rem] text-chalk/50">{t.identifyInvitedLabel}</span>
          </div>
        </div>

        <div>
          <p className="eyebrow text-chalk/45">{t.identifyAddStampsLabel}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {STAMP_OPTIONS.map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setAddStamps(n)}
                aria-pressed={addStamps === n}
                className={cn(
                  "numeral flex size-11 items-center justify-center rounded-full text-[0.9375rem] font-bold transition-colors",
                  addStamps === n ? "bg-lime text-ink" : "glass-dark text-chalk/60 hover:text-chalk",
                )}
              >
                {n}
              </button>
            ))}
          </div>
        </div>

        {profile.rewardsPending > 0 ? (
          <div>
            <p className="eyebrow text-chalk/45">{t.identifyRedeemLabel}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {redeemOptions.map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setRedeemCount(n)}
                  aria-pressed={redeemCount === n}
                  className={cn(
                    "numeral flex size-11 items-center justify-center rounded-full text-[0.9375rem] font-bold transition-colors",
                    redeemCount === n ? "bg-amber text-ink" : "glass-dark text-chalk/60 hover:text-chalk",
                  )}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      <div className="px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        <button
          type="button"
          disabled={!canConfirm || busy}
          onClick={() => onConfirm(addStamps, redeemCount)}
          className="btn w-full bg-lime px-6 py-6 text-[1.1875rem] font-bold text-ink disabled:opacity-40"
        >
          {busy ? t.checking : t.identifyConfirm}
        </button>
      </div>
    </div>
  );
}
