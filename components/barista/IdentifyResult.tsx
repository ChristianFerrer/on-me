"use client";

import { cn } from "@/lib/cn";
import { fill, formatMonthYear, formatRelativeTime, plural, type Dict, type Locale } from "@/lib/i18n";
import type { IdentifyApplyResult } from "@/lib/identify-service";
import { GiftIcon, XIcon } from "@/components/ui/Icons";
import { TierBadge } from "./TierBadge";

type BaristaDict = Dict["barista"];

const AUTOCLOSE_MS = 15_000;
const INVALID_AUTOCLOSE_MS = 5_000;

/**
 * Resumen de cierre del flujo identificador: no es un flash de un segundo
 * como Verdict.tsx -aquí hay una ficha entera de fidelización que leer-,
 * así que se queda en pantalla más tiempo y dice desde el principio cómo
 * se cierra sola. `onClose` puede llegar antes -el barista pulsa la X-, no
 * hay que esperar a que se agote el tiempo.
 */
export function IdentifyResult({
  result,
  t,
  locale,
  shopName,
  onClose,
}: {
  result: IdentifyApplyResult;
  t: BaristaDict;
  locale: Locale;
  shopName: string;
  onClose: () => void;
}) {
  const autocloseMs = result.kind === "applied" ? AUTOCLOSE_MS : INVALID_AUTOCLOSE_MS;

  return (
    <div className="fixed inset-0 z-[60] flex flex-col overflow-y-auto aurora-night text-on-surface">
      <header className="flex items-center justify-between px-5 pt-[max(1.25rem,env(safe-area-inset-top))]">
        <p className="truncate text-[0.9375rem] font-semibold">{shopName}</p>
        <button
          type="button"
          onClick={onClose}
          aria-label={t.identifyClose}
          className="btn glass-dark size-10 shrink-0 rounded-full text-on-surface"
        >
          <XIcon className="size-4" />
        </button>
      </header>

      <div className="flex flex-1 flex-col gap-6 px-5 py-6">
        {result.kind === "applied" ? (
          <Applied result={result} t={t} locale={locale} />
        ) : (
          <Invalid result={result} t={t} />
        )}
      </div>

      <div className="px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        <p className="text-center text-[0.75rem] text-on-surface/40">{t.identifyClosingAutoCloseHint}</p>
        <div className="mt-2.5 h-0.5 w-full bg-[rgba(var(--on-surface-rgb),0.1)]">
          <div
            className="drain h-full w-full bg-[rgba(var(--on-surface-rgb),0.45)]"
            style={{ ["--drain" as string]: `${autocloseMs}ms` }}
          />
        </div>
      </div>
    </div>
  );
}

function Applied({
  result,
  t,
  locale,
}: {
  result: Extract<IdentifyApplyResult, { kind: "applied" }>;
  t: BaristaDict;
  locale: Locale;
}) {
  const { profile } = result;

  const memberSince = fill(t.identifyMemberSince, { date: formatMonthYear(profile.createdAt, locale) });
  const lastVisit = fill(t.identifyLastVisit, {
    when: profile.lastVisitAt
      ? formatRelativeTime(profile.lastVisitAt, locale, t.identifyJustNow)
      : t.identifyJustNow,
  });

  return (
    <>
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-2.5">
          <h1 className="display min-w-0 flex-1 break-words text-[2.25rem]">{profile.name}</h1>
          <TierBadge t={t} tier={profile.tier} position={profile.rankPosition} />
        </div>
        <p className="text-[0.8125rem] text-on-surface/45">{memberSince}</p>
        <p className="text-[0.8125rem] text-on-surface/45">{lastVisit}</p>
      </div>

      {result.invitationRedeemed ? (
        <p className="flex items-center gap-2 self-start rounded-full bg-azure px-4 py-2 text-[0.875rem] font-bold text-ink">
          <GiftIcon className="size-4" />
          {fill(t.identifyClosingInvitationRedeemed, { padrino: result.invitationRedeemed.padrino })}
        </p>
      ) : null}

      <section className="glass-dark p-5">
        <p className="eyebrow text-center text-on-surface/45">{t.identifyLoyaltySectionTitle}</p>

        <FidelizationRow label={t.identifyStampsSectionTitle}>
          <div className="flex flex-wrap justify-end gap-1.5">
            {Array.from({ length: profile.goal }, (_, i) => (
              <span
                key={i}
                className={cn(
                  "numeral flex size-7 items-center justify-center rounded-[6px] text-[0.6875rem] font-bold",
                  i < profile.stamps ? "bg-lime text-ink" : "border border-on-surface/20 text-on-surface/30",
                )}
              >
                {i + 1}
              </span>
            ))}
          </div>
        </FidelizationRow>

        <FidelizationRow label={t.identifyClosingRewardsLabel}>
          <div className="flex flex-col items-end gap-1 text-right">
            <Pill tone="lime">
              {plural(
                profile.rewardsClaimed,
                t.identifyRewardsClaimedChipOne,
                fill(t.identifyRewardsClaimedChipMany, { n: profile.rewardsClaimed }),
              )}
            </Pill>
            {profile.rewardsPending > 0 ? (
              <Pill tone="amber">
                {plural(
                  profile.rewardsPending,
                  t.identifyRewardsPendingChipOne,
                  fill(t.identifyRewardsPendingChipMany, { n: profile.rewardsPending }),
                )}
              </Pill>
            ) : null}
          </div>
        </FidelizationRow>

        <FidelizationRow label={t.identifyClosingInvitesLabel}>
          <div className="flex flex-col items-end gap-1 text-right">
            <Pill>
              {plural(
                profile.invitesAvailable,
                t.identifyAvailableOne,
                fill(t.identifyAvailableMany, { n: profile.invitesAvailable }),
              )}
            </Pill>
            <Pill>
              {plural(
                profile.invitesSent,
                t.identifyInvitesSentOne,
                fill(t.identifyInvitesSentMany, { n: profile.invitesSent }),
              )}
            </Pill>
            <Pill tone="mint">
              {plural(
                profile.newCustomersFromInvites,
                t.identifyInvitesActivatedOne,
                fill(t.identifyInvitesActivatedMany, { n: profile.newCustomersFromInvites }),
              )}
            </Pill>
          </div>
        </FidelizationRow>

        <FidelizationRow label={t.identifyClosingConsumptionLabel} last>
          <div className="flex flex-col items-end gap-1 text-right">
            <Pill>{fill(t.identifyConsumptionMonth, { n: profile.consumptionThisMonth })}</Pill>
            <Pill>{fill(t.identifyConsumptionTotal, { n: profile.consumptionTotal })}</Pill>
          </div>
        </FidelizationRow>
      </section>
    </>
  );
}

function FidelizationRow({
  label,
  children,
  last,
}: {
  label: string;
  children: React.ReactNode;
  last?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-start justify-between gap-3 py-3.5",
        !last && "border-b border-on-surface/10",
      )}
    >
      <span className="pt-1 text-[0.8125rem] font-semibold text-on-surface/60">{label}</span>
      {children}
    </div>
  );
}

const PILL_TONE = {
  default: "bg-[rgba(var(--on-surface-rgb),0.1)] text-on-surface/80",
  lime: "bg-lime/20 text-lime",
  amber: "bg-amber/20 text-amber",
  mint: "bg-mint/20 text-mint",
} as const;

function Pill({ tone = "default", children }: { tone?: keyof typeof PILL_TONE; children: React.ReactNode }) {
  return (
    <span className={cn("rounded-full px-3 py-1 text-[0.8125rem] font-semibold", PILL_TONE[tone])}>
      {children}
    </span>
  );
}

function Invalid({ result, t }: { result: Extract<IdentifyApplyResult, { kind: "invalid" }>; t: BaristaDict }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
      <h1 className="display text-[2rem] text-coral">{t.results.invalidTitle}</h1>
      <p className="text-[1.0625rem] font-medium text-on-surface/70">
        {result.reason === "other_shop"
          ? t.results.invalidOtherShop
          : result.reason === "network"
            ? t.results.invalidNetwork
            : result.reason === "device"
              ? t.results.invalidDevice
              : t.results.invalidUnknown}
      </p>
    </div>
  );
}
