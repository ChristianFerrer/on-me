import Link from "next/link";
import { OfflineBadge } from "@/components/client/OfflineBadge";
import { ButtonLink } from "@/components/ui/Button";
import { QrCode } from "@/components/ui/QrCode";
import { Screen, Slab } from "@/components/ui/Screen";
import { StampCard } from "@/components/ui/StampCard";
import { TopBar } from "@/components/ui/TopBar";
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
      <Screen tone="quiet" className="gap-6">
        <TopBar />
        <div className="flex flex-1 flex-col justify-center">
          <Slab className="p-7">
            <h1 className="display text-[1.875rem]">{t.errors.notFound}</h1>
            <p className="mt-3 text-[0.9375rem] leading-relaxed text-chalk/60">
              {t.errors.notFoundBody}
            </p>
            <ButtonLink href="/inicio" tone="ink" size="md" className="mt-6">
              {t.errors.backHome}
            </ButtonLink>
          </Slab>
        </div>
      </Screen>
    );
  }

  const { shop, stamps, rewardPending, activeInvites, canCreateInvite } = card;
  const remaining = shop.stamps_goal - stamps;
  const invite = activeInvites[0];

  return (
    <Screen className="gap-4 pb-8">
      <TopBar />

      <div className="stagger flex flex-col gap-4">
        {/* ------------------------------------------------ estado de la tarjeta */}
        <Slab className="p-7">
          <div className="flex items-start justify-between gap-3">
            <p className="eyebrow text-chalk/65">{shop.name}</p>
            <OfflineBadge label={t.card.offline} />
          </div>

          {rewardPending ? (
            <>
              <h1 className="display-tight mt-5 text-[clamp(2.25rem,11vw,2.875rem)] text-lime">
                {t.card.rewardTitle}
              </h1>
              <p className="mt-4 text-[0.9375rem] leading-relaxed text-chalk/60">
                {t.card.rewardBody}
              </p>
            </>
          ) : (
            <>
              <p className="display-tight numeral mt-5 text-[3.25rem]">
                {stamps}
                <span className="text-chalk/30">/{shop.stamps_goal}</span>
              </p>
              <p className="mt-1 text-[0.9375rem] font-medium text-chalk/55">
                {remaining === 1
                  ? t.card.oneToGo
                  : fill(t.card.nToGo, { n: remaining })}
              </p>
              <StampCard
                stamps={stamps}
                goal={shop.stamps_goal}
                tone="dark"
                className="mt-7"
              />
              {stamps > 0 ? (
                <p className="mt-4 text-[0.8125rem] italic leading-snug text-chalk/45">
                  {t.card.stampJokes[(stamps - 1) % t.card.stampJokes.length]}
                </p>
              ) : null}
            </>
          )}
        </Slab>

        {/* ------------------------------------------------- código para la barra */}
        <section className="rounded-[var(--radius-card)] bg-white p-7">
          <p className="eyebrow text-center text-ink/40">{t.card.showToBarista}</p>
          {/*
            Fondo blanco puro y no vidrio: un QR sobre un degradado pierde
            contraste y el escáner tarda más. Lleva el token pelado, no una
            URL —cuantos menos módulos, antes decodifica— y va incrustado en
            el HTML para que se vea sin cobertura.
          */}
          <QrCode
            value={card.customer.token}
            label={t.card.showToBarista}
            className="mx-auto mt-5 w-full max-w-[14rem]"
          />
        </section>

        {/* --------------------------------------------------------- invitaciones */}
        {canCreateInvite ? (
          <Slab className="p-7">
            <p className="eyebrow text-lime">{t.card.inviteReady}</p>
            <p className="display mt-3 text-[1.625rem]">{t.invite.title}</p>
            <p className="mt-2 text-[0.9375rem] leading-relaxed text-chalk/55">
              {t.card.inviteBody}
            </p>
            <ButtonLink href="/c/invitar" tone="lime" size="md" className="mt-6">
              {t.card.inviteCta}
            </ButtonLink>
          </Slab>
        ) : invite ? (
          <Slab className="p-7">
            <p className="eyebrow text-chalk/65">{t.card.inviteActive}</p>
            <p className="code mt-3 text-[1.75rem] text-lime">{invite.code}</p>
            <p className="mt-2 text-[0.875rem] text-chalk/50">
              {fill(t.card.inviteActiveBody, {
                date: formatDate(invite.expires_at, locale),
              })}
            </p>
            <ButtonLink
              href="/c/invitar"
              tone="ghost-light"
              size="sm"
              block={false}
              className="mt-5"
            >
              {t.invite.sendWhatsapp}
            </ButtonLink>
          </Slab>
        ) : (
          // Bloque discreto en vez de nada: sin él, el mecanismo de invitar
          // era invisible durante toda la primera tarjeta -nadie navegaba
          // nunca hasta /c/invitar para descubrirlo- y el propio texto que
          // lo explica (quotaTitle/quotaBody en InvitePanel) era inalcanzable.
          <Link href="/c/invitar" className="block">
            <Slab className="p-6">
              <p className="text-[0.9375rem] font-semibold leading-snug">
                {t.card.inviteLocked}
              </p>
              <p className="mt-1.5 text-[0.8125rem] leading-relaxed text-chalk/50">
                {t.card.inviteLockedBody}
              </p>
            </Slab>
          </Link>
        )}

        {/* -------------------------------------------- el invitado volvió a pagar */}
        {card.returnedGuests > 0 ? (
          <section className="rounded-[var(--radius-card)] bg-lime p-6">
            <p className="eyebrow text-ink/50">{t.card.guestReturned}</p>
            <p className="mt-2 text-[1rem] font-semibold leading-snug">
              {fill(t.card.guestReturnedBody, { n: shop.bonus_stamps })}
            </p>
          </section>
        ) : null}
      </div>

      <footer className="mt-auto flex items-center justify-between gap-3 pt-6">
        <p className="numeral text-[0.8125rem] text-ink/45">
          {fill(t.card.cardsCompleted, { n: card.cardsCompleted })}
        </p>
        <Link
          href="/privacidad"
          className="eyebrow text-ink/45 underline underline-offset-2"
        >
          {t.join.consentLink}
        </Link>
      </footer>
    </Screen>
  );
}
