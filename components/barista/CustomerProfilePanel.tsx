"use client";

import { useState } from "react";
import {
  CheckIcon,
  CoffeeIcon,
  EyeIcon,
  EyeOffIcon,
  GiftIcon,
  OrbitIcon,
  UserIcon,
  XIcon,
} from "@/components/ui/Icons";
import { StampCard } from "@/components/ui/StampCard";
import { cn } from "@/lib/cn";
import { formatDate, type Dict, type Locale } from "@/lib/i18n";
import type { IdentifyProfile } from "./useIdentifyFlow";

type BaristaDict = Dict["barista"];

/** Tope del selector de canje: si acumuló más de 5, se canjean en dos pasadas. */
const MAX_REDEEM_OPTIONS = 5;

/**
 * El perfil del cliente tras identificarlo, en dos secciones bien
 * separadas: cuántos sellos darle -un contador con menos/más, no una fila
 * de botones- y todo lo que hay que saber de él antes de decidir. A
 * diferencia del escáner clásico, aquí completar una tarjeta no obliga a
 * resolver el premio en el momento: se ve acumulado y se canjea cuando el
 * cliente lo pida.
 */
export function CustomerProfilePanel({
  t,
  locale,
  profile,
  busy,
  onCancel,
  onConfirm,
}: {
  t: BaristaDict;
  locale: Locale;
  profile: IdentifyProfile;
  busy: boolean;
  onCancel: () => void;
  onConfirm: (addStamps: number, redeemCount: number) => void;
}) {
  const [addStamps, setAddStamps] = useState(Math.min(1, profile.maxStamps));
  const [redeemCount, setRedeemCount] = useState(0);
  const [phoneRevealed, setPhoneRevealed] = useState(false);

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

      <div className="flex flex-1 flex-col gap-6 px-5 py-6">
        <h1 className="display break-words text-[2.25rem]">{profile.name}</h1>

        {/* -------------------------------------------------- sección 1 */}
        <section>
          <p className="eyebrow text-chalk/45">{t.identifyStampsSectionTitle}</p>
          <div className="glass-dark mt-2.5 flex flex-col items-center gap-3 p-6">
            <p className="text-[0.8125rem] font-medium text-chalk/50">{t.identifyAddStampsLabel}</p>
            <div className="flex items-center justify-center gap-5">
              <button
                type="button"
                onClick={() => setAddStamps((n) => Math.max(0, n - 1))}
                disabled={addStamps <= 0}
                aria-label={t.identifyStampsMinus}
                className="btn glass-dark size-14 shrink-0 rounded-full text-[1.75rem] font-bold leading-none text-chalk disabled:opacity-30"
              >
                −
              </button>
              <span className="numeral w-16 text-center text-[3rem] font-bold leading-none text-lime">
                {addStamps}
              </span>
              <button
                type="button"
                onClick={() => setAddStamps((n) => Math.min(profile.maxStamps, n + 1))}
                disabled={addStamps >= profile.maxStamps}
                aria-label={t.identifyStampsPlus}
                className="btn glass-dark size-14 shrink-0 rounded-full text-[1.75rem] font-bold leading-none text-chalk disabled:opacity-30"
              >
                +
              </button>
            </div>
          </div>

          {profile.rewardsPending > 0 ? (
            <div className="mt-4">
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
        </section>

        {/* -------------------------------------------------- sección 2 */}
        <section>
          <p className="eyebrow text-chalk/45">{t.identifyInfoSectionTitle}</p>

          <div className="glass-dark mt-2.5 p-5">
            <span className="numeral text-[1.5rem] font-semibold">
              {profile.stamps}
              <span className="text-chalk/30">/{profile.goal}</span>
            </span>
            <p className="mt-0.5 text-[0.75rem] text-chalk/50">{t.identifyCurrentStampsLabel}</p>
            <StampCard stamps={profile.stamps} goal={profile.goal} tone="dark" className="mt-4" />
          </div>

          <div className="mt-3 grid grid-cols-2 gap-3">
            <StatTile icon={<GiftIcon className="size-5 text-lime" />} value={profile.rewardsPending} label={t.identifyRewardsPendingLabel} />
            <StatTile icon={<CheckIcon className="size-5 text-mint" />} value={profile.cardsCompleted} label={t.identifyCardsCompletedLabel} />
            <StatTile icon={<CoffeeIcon className="size-5 text-amber" />} value={profile.rewardsClaimed} label={t.identifyRewardsClaimedLabel} />
            <StatTile icon={<OrbitIcon className="size-5 text-azure" />} value={profile.invitedCount} label={t.identifyInvitedLabel} />
            <StatTile icon={<UserIcon className="size-5 text-coral" />} value={profile.newCustomersFromInvites} label={t.identifyNewCustomersLabel} />
          </div>

          <div className="glass-dark mt-3 flex items-center justify-between p-4">
            <span className="text-[0.8125rem] text-chalk/50">{t.identifySignupDateLabel}</span>
            <span className="numeral text-[0.9375rem] font-semibold">{formatDate(profile.createdAt, locale)}</span>
          </div>

          <div className="glass-dark mt-3 flex items-center justify-between p-4">
            <span className="text-[0.8125rem] text-chalk/50">{t.identifyPhoneLabel}</span>
            <div className="flex items-center gap-2.5">
              <span className="numeral text-[0.9375rem] font-semibold">
                {phoneRevealed && profile.phone ? profile.phone : `··${profile.phoneLast4}`}
              </span>
              {profile.phone ? (
                <button
                  type="button"
                  onClick={() => setPhoneRevealed((v) => !v)}
                  aria-label={phoneRevealed ? t.identifyHidePhone : t.identifyShowPhone}
                  className="btn glass-dark size-8 shrink-0 rounded-full text-chalk"
                >
                  {phoneRevealed ? <EyeOffIcon className="size-4" /> : <EyeIcon className="size-4" />}
                </button>
              ) : (
                <span className="text-[0.6875rem] text-chalk/35">{t.identifyPhoneUnavailable}</span>
              )}
            </div>
          </div>
        </section>
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

function StatTile({ icon, value, label }: { icon: React.ReactNode; value: number; label: string }) {
  return (
    <div className="glass-dark flex flex-col items-center gap-1 p-4 text-center">
      {icon}
      <span className="numeral text-[1.375rem] font-semibold">{value}</span>
      <span className="text-[0.75rem] text-chalk/50">{label}</span>
    </div>
  );
}
