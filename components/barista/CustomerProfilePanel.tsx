"use client";

import { useState } from "react";
import { EditIcon, XIcon } from "@/components/ui/Icons";
import { fill, formatMonthYear, formatRelativeTime, plural, type Dict, type Locale } from "@/lib/i18n";
import { TierBadge } from "./TierBadge";
import type { IdentifyProfile } from "./useIdentifyFlow";

type BaristaDict = Dict["barista"];

/**
 * El perfil del cliente tras identificarlo: dos columnas, una acción cada
 * una -sellar arriba de una, canjear arriba de la otra-, nunca un único
 * botón que mezcle las dos cosas. Son dos momentos distintos en la vida
 * real -paga un café, o se lleva uno gratis que ya tenía acumulado- y cada
 * uno cierra su propio resumen (ver IdentifyResult.tsx), así que cada uno
 * tiene su propio botón.
 */
export function CustomerProfilePanel({
  t,
  locale,
  profile,
  busy,
  onCancel,
  onConfirm,
  onUpdateProfile,
}: {
  t: BaristaDict;
  locale: Locale;
  profile: IdentifyProfile;
  busy: boolean;
  onCancel: () => void;
  onConfirm: (addStamps: number, redeemCount: number) => void;
  onUpdateProfile: (name: string, phone: string) => Promise<{ ok: true } | { ok: false; error: string }>;
}) {
  const [addStamps, setAddStamps] = useState(Math.min(1, profile.maxStamps));
  const [adjustingRedeem, setAdjustingRedeem] = useState(false);
  const [customRedeem, setCustomRedeem] = useState(profile.rewardsPending);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(profile.fullName);
  const [editPhone, setEditPhone] = useState(profile.phone ?? "");
  const [editBusy, setEditBusy] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const memberSince = fill(t.identifyMemberSince, { date: formatMonthYear(profile.createdAt, locale) });
  const lastVisit = fill(t.identifyLastVisit, {
    when: profile.lastVisitAt
      ? formatRelativeTime(profile.lastVisitAt, locale, t.identifyJustNow)
      : t.identifyFirstVisit,
  });
  const currentCard = fill(t.identifyCurrentCard, { stamps: profile.stamps, goal: profile.goal });

  function startAdjustingRedeem() {
    setCustomRedeem(profile.rewardsPending);
    setAdjustingRedeem(true);
  }

  function openEdit() {
    setEditName(profile.fullName);
    setEditPhone(profile.phone ?? "");
    setEditError(null);
    setEditing(true);
  }

  async function saveEdit(event: React.FormEvent) {
    event.preventDefault();
    if (editBusy) return;

    setEditBusy(true);
    setEditError(null);
    const result = await onUpdateProfile(editName.trim(), editPhone.trim());
    setEditBusy(false);

    if (result.ok) {
      setEditing(false);
    } else {
      setEditError(
        result.error === "invalid_phone"
          ? t.identifyEditPhoneInvalid
          : result.error === "phone_taken"
            ? t.identifyEditPhoneTaken
            : t.identifyEditError,
      );
    }
  }

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
        {editing ? (
          <form onSubmit={(event) => void saveEdit(event)} className="glass-dark flex flex-col gap-3 p-5">
            <div>
              <label htmlFor="edit-name" className="text-[0.8125rem] font-medium text-chalk/50">
                {t.identifyEditNameLabel}
              </label>
              <input
                id="edit-name"
                value={editName}
                onChange={(event) => setEditName(event.target.value)}
                className="field mt-1.5 w-full"
              />
            </div>
            <div>
              <label htmlFor="edit-phone" className="text-[0.8125rem] font-medium text-chalk/50">
                {t.identifyEditPhoneLabel}
              </label>
              <input
                id="edit-phone"
                type="tel"
                value={editPhone}
                onChange={(event) => setEditPhone(event.target.value)}
                className="numeral field mt-1.5 w-full"
              />
            </div>
            {editError ? <p className="text-[0.8125rem] text-coral">{editError}</p> : null}
            <div className="mt-1 flex gap-2.5">
              <button
                type="button"
                onClick={() => setEditing(false)}
                className="btn flex-1 glass-dark py-3 text-[0.9375rem] font-semibold text-chalk"
              >
                {t.cancel}
              </button>
              <button
                type="submit"
                disabled={editBusy || !editName.trim() || !editPhone.trim()}
                className="btn flex-1 bg-lime py-3 text-[0.9375rem] font-bold text-ink disabled:opacity-40"
              >
                {editBusy ? t.identifyEditSaving : t.identifyEditSave}
              </button>
            </div>
          </form>
        ) : (
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2.5">
              <h1 className="display min-w-0 flex-1 break-words text-[2.25rem]">{profile.name}</h1>
              <TierBadge t={t} tier={profile.tier} position={profile.rankPosition} />
              <button
                type="button"
                onClick={openEdit}
                disabled={busy}
                aria-label={t.identifyEditCta}
                className="btn glass-dark size-10 shrink-0 rounded-full text-chalk disabled:opacity-40"
              >
                <EditIcon className="size-4" />
              </button>
            </div>
            <p className="text-[0.8125rem] text-chalk/45">{memberSince}</p>
            <div className="flex items-center justify-between text-[0.8125rem] text-chalk/45">
              <span>{lastVisit}</span>
              <span>{currentCard}</span>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          {/* ------------------------------------------------- sellos */}
          <section className="glass-dark flex flex-col items-center gap-4 p-5">
            <p className="text-center text-[1.0625rem] font-bold">{t.identifyAddStampsLabel}</p>
            <div className="flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => setAddStamps((n) => Math.max(0, n - 1))}
                disabled={addStamps <= 0}
                aria-label={t.identifyStampsMinus}
                className="btn glass-dark size-11 shrink-0 rounded-full text-[1.5rem] font-bold leading-none text-chalk disabled:opacity-30"
              >
                −
              </button>
              <span className="numeral w-12 text-center text-[2.5rem] font-bold leading-none text-lime">
                {addStamps}
              </span>
              <button
                type="button"
                onClick={() => setAddStamps((n) => Math.min(profile.maxStamps, n + 1))}
                disabled={addStamps >= profile.maxStamps}
                aria-label={t.identifyStampsPlus}
                className="btn glass-dark size-11 shrink-0 rounded-full text-[1.5rem] font-bold leading-none text-chalk disabled:opacity-30"
              >
                +
              </button>
            </div>
            <button
              type="button"
              disabled={addStamps <= 0 || busy}
              onClick={() => onConfirm(addStamps, 0)}
              className="btn mt-auto w-full bg-lime px-4 py-3.5 text-[1rem] font-bold text-ink disabled:opacity-40"
            >
              {busy ? t.checking : t.identifySellCta}
            </button>
          </section>

          {/* --------------------------------------------- café gratis */}
          <section className="glass-dark flex flex-col items-center gap-3 p-5 text-center">
            <p className="text-[1.0625rem] font-bold">{t.identifyFreeCoffeeSectionTitle}</p>
            <p className="text-[0.8125rem] text-chalk/50">
              {plural(
                profile.rewardsPending,
                t.identifyAvailableOne,
                fill(t.identifyAvailableMany, { n: profile.rewardsPending }),
              )}
            </p>

            {profile.rewardsPending > 0 ? (
              adjustingRedeem ? (
                <>
                  <div className="flex items-center justify-center gap-3">
                    <button
                      type="button"
                      onClick={() => setCustomRedeem((n) => Math.max(1, n - 1))}
                      disabled={customRedeem <= 1}
                      aria-label={t.identifyRedeemMinus}
                      className="btn glass-dark size-11 shrink-0 rounded-full text-[1.5rem] font-bold leading-none text-chalk disabled:opacity-30"
                    >
                      −
                    </button>
                    <span className="numeral w-12 text-center text-[2.5rem] font-bold leading-none text-amber">
                      {customRedeem}
                    </span>
                    <button
                      type="button"
                      onClick={() => setCustomRedeem((n) => Math.min(profile.rewardsPending, n + 1))}
                      disabled={customRedeem >= profile.rewardsPending}
                      aria-label={t.identifyRedeemPlus}
                      className="btn glass-dark size-11 shrink-0 rounded-full text-[1.5rem] font-bold leading-none text-chalk disabled:opacity-30"
                    >
                      +
                    </button>
                  </div>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => onConfirm(0, customRedeem)}
                    className="btn mt-auto w-full bg-amber px-4 py-3.5 text-[1rem] font-bold text-ink disabled:opacity-40"
                  >
                    {busy ? t.checking : fill(t.identifyRedeemAmountCta, { n: customRedeem })}
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => onConfirm(0, profile.rewardsPending)}
                    className="btn mt-auto w-full bg-amber px-4 py-3.5 text-[1rem] font-bold text-ink disabled:opacity-40"
                  >
                    {busy ? t.checking : fill(t.identifyRedeemAmountCta, { n: profile.rewardsPending })}
                  </button>
                  {profile.rewardsPending > 1 ? (
                    <button
                      type="button"
                      onClick={startAdjustingRedeem}
                      disabled={busy}
                      className="text-[0.75rem] font-semibold text-chalk/40 underline disabled:opacity-40"
                    >
                      {t.identifyRedeemAdjustCta}
                    </button>
                  ) : null}
                </>
              )
            ) : null}
          </section>
        </div>
      </div>
    </div>
  );
}
