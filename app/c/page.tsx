import Link from "next/link";
import { OfflineBadge } from "@/components/client/OfflineBadge";
import { ButtonLink } from "@/components/ui/Button";
import { LangSwitch } from "@/components/ui/LangSwitch";
import { Logo } from "@/components/ui/Logo";
import { QrCode } from "@/components/ui/QrCode";
import { Screen, Sheet } from "@/components/ui/Screen";
import { StampCard } from "@/components/ui/StampCard";
import { loadCard } from "@/lib/card";
import { fill, formatDate } from "@/lib/i18n";
import { getI18n } from "@/lib/i18n/server";
import { readCustomerToken } from "@/lib/session";

export default async function CardPage() {
  const { locale, t } = await getI18n();
  const token = await readCustomerToken();
  const card = token ? await loadCard(token) : null;

  if (!card) {
    return (
      <Screen className="justify-center gap-6">
        <Logo size="lg" />
        <Sheet className="bg-tomato p-6 text-paper" tint="var(--color-ink)">
          <h1 className="display text-[2rem] leading-tight">{t.errors.notFound}</h1>
          <p className="mt-3 text-[0.95rem] leading-snug text-paper/85">
            {t.errors.notFoundBody}
          </p>
        </Sheet>
      </Screen>
    );
  }

  const { shop, stamps, rewardPending, activeInvites, canCreateInvite } = card;
  const remaining = shop.stamps_goal - stamps;
  const invite = activeInvites[0];

  return (
    <Screen className="gap-5 pb-8">
      <header className="flex items-center justify-between gap-3">
        <Logo size="sm" />
        <div className="flex items-center gap-2">
          <OfflineBadge label={t.card.offline} />
          <LangSwitch locale={locale} label={t.common.switchTo} />
        </div>
      </header>

      <div className="stagger flex flex-col gap-5">
        {/* ---------------------------------------------- café gratis pendiente */}
        {rewardPending ? (
          <Sheet className="bg-saffron p-6" tint="var(--color-tomato)">
            <span
              aria-hidden
              className="halftone halftone-lg anim-drift absolute -right-10 -top-10 size-40 rounded-full text-ink"
            />
            <p className="overline text-ink/60">{shop.name}</p>
            <h1 className="display-tight mt-2 text-[clamp(2.6rem,13vw,3.4rem)]">
              {t.card.rewardTitle}
            </h1>
            <p className="mt-3 text-[1rem] font-medium leading-snug">
              {t.card.rewardBody}
            </p>
          </Sheet>
        ) : (
          <Sheet className="bg-paper-deep p-6" tint="var(--color-cobalt)">
            <p className="overline text-ink-faint">{shop.name}</p>
            <h1 className="display-tight numeral mt-2 text-[clamp(3rem,16vw,4rem)]">
              {stamps}
              <span className="text-ink-faint">/{shop.stamps_goal}</span>
            </h1>
            <p className="mt-1 text-[1.05rem] font-semibold text-ink-soft">
              {remaining === 1
                ? t.card.oneToGo
                : fill(t.card.nToGo, { n: remaining })}
            </p>
            <StampCard stamps={stamps} goal={shop.stamps_goal} className="mt-5" />
          </Sheet>
        )}

        {/* ------------------------------------------------- código para la barra */}
        <Sheet className="bg-paper p-6" tint="var(--color-jade)">
          <p className="overline text-center text-ink-faint">
            {t.card.showToBarista}
          </p>
          {/*
            El QR lleva el token pelado, no una URL: lo lee nuestro escáner y
            cuantos menos módulos tenga, antes decodifica. Va incrustado en el
            HTML para que siga viéndose sin cobertura.
          */}
          <QrCode
            value={card.customer.token}
            label={t.card.showToBarista}
            className="mx-auto mt-4 w-full max-w-[15rem]"
          />
        </Sheet>

        {/* ------------------------------------------------------- invitaciones */}
        {canCreateInvite ? (
          <Sheet className="bg-ink p-6 text-paper" tint="var(--color-fuchsia)">
            <p className="overline text-saffron">{t.card.inviteReady}</p>
            <p className="display mt-2 text-[1.75rem] leading-tight">
              {t.invite.title}
            </p>
            <p className="mt-2 text-[0.95rem] leading-snug text-paper/70">
              {t.card.inviteBody}
            </p>
            <ButtonLink href="/c/invitar" tone="saffron" size="lg" className="mt-5">
              {t.card.inviteCta}
            </ButtonLink>
          </Sheet>
        ) : invite ? (
          <Sheet className="bg-paper p-5" tint="var(--color-fuchsia)">
            <p className="overline text-ink-faint">{t.card.inviteActive}</p>
            <p className="numeral mt-2 text-[1.9rem] font-semibold tracking-[0.15em]">
              {invite.code}
            </p>
            <p className="mt-1 text-[0.9rem] text-ink-soft">
              {fill(t.card.inviteActiveBody, {
                date: formatDate(invite.expires_at, locale),
              })}
            </p>
            <Link
              href="/c/invitar"
              className="overline mt-3 inline-block text-cobalt underline"
            >
              {t.invite.sendWhatsapp}
            </Link>
          </Sheet>
        ) : null}

        {/* ------------------------------------------- el invitado volvió a pagar */}
        {card.returnedGuests > 0 ? (
          <Sheet className="bg-jade p-5" tint="var(--color-ink)">
            <p className="overline text-ink/60">{t.card.guestReturned}</p>
            <p className="mt-1.5 text-[1.05rem] font-semibold leading-snug">
              {fill(t.card.guestReturnedBody, { n: shop.bonus_stamps })}
            </p>
          </Sheet>
        ) : null}
      </div>

      <footer className="mt-auto flex items-center justify-between gap-3 border-t-2 border-ink/15 pt-4">
        <p className="numeral text-[0.8rem] text-ink-faint">
          {fill(t.card.cardsCompleted, { n: card.cardsCompleted })}
        </p>
        <Link href="/privacidad" className="overline text-ink-faint underline">
          {t.join.consentLink}
        </Link>
      </footer>
    </Screen>
  );
}
