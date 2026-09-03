import Link from "next/link";
import { CardLive } from "@/components/client/CardLive";
import { ButtonLink } from "@/components/ui/Button";
import { QrCode } from "@/components/ui/QrCode";
import { Screen, Slab } from "@/components/ui/Screen";
import { TopBar } from "@/components/ui/TopBar";
import { loadCard } from "@/lib/card";
import { getI18n } from "@/lib/i18n/server";
import { readCustomerToken } from "@/lib/session";

export default async function CardPage() {
  const { t } = await getI18n();
  const token = await readCustomerToken();
  const card = token ? await loadCard(token) : null;

  if (!card) {
    return (
      <Screen tone="quiet" className="gap-6">
        <TopBar />
        <div className="flex flex-1 flex-col justify-center">
          <Slab className="p-7">
            <h1 className="display text-[1.875rem]">{t.errors.notFound}</h1>
            <p className="mt-3 text-[0.9375rem] leading-relaxed text-chalk/70">
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

  const { shop } = card;

  return (
    <Screen className="gap-3 pb-4">
      <TopBar />

      {/* Sin `stagger` aquí: CardLive ya trae el suyo para su propio
          contenido -tenerlos anidados solo reiniciaba la cascada dos veces
          sin aportar nada-. */}
      <div className="flex flex-col gap-3">
        <CardLive
          customerId={card.customer.id}
          shopName={shop.name}
          goal={shop.stamps_goal}
          bonusStamps={shop.bonus_stamps}
          initial={{
            stamps: card.stamps,
            rewardPending: card.rewardPending,
            cardsCompleted: card.cardsCompleted,
            inviteCount: card.activeInvites.length + card.pendingGrants,
            returnedGuests: card.returnedGuests,
          }}
          labels={{
            offline: t.card.offline,
            oneToGo: t.card.oneToGo,
            nToGo: t.card.nToGo,
            rewardTitle: t.card.rewardTitle,
            rewardBody: t.card.rewardBody,
            freeCoffees: t.card.freeCoffees,
            inviteRowLabel: t.card.inviteRowLabel,
            guestReturned: t.card.guestReturned,
            guestReturnedBody: t.card.guestReturnedBody,
            oracleCta: t.card.oracleCta,
            oracleUsedHint: t.card.oracleUsedHint,
            oracleMessages: t.card.oracleMessages,
          }}
        />

        {/* ------------------------------------------------- código para la barra */}
        <section className="rounded-[var(--radius-card)] bg-white p-4">
          <p className="eyebrow text-center text-ink/40">{t.card.showToBarista}</p>
          {/*
            Fondo blanco puro y no vidrio: un QR sobre un degradado pierde
            contraste y el escáner tarda más. Lleva el token pelado, no una
            URL —cuantos menos módulos, antes decodifica— y va incrustado en
            el HTML para que se vea sin cobertura. Más pequeño que antes -a
            la distancia a la que el barista lo escanea de tu propio móvil no
            hace falta tan grande, y aquí la pantalla entera tiene que caber
            sin scroll-.
          */}
          <QrCode
            value={card.customer.token}
            label={t.card.showToBarista}
            className="mx-auto mt-2.5 w-full max-w-[9rem]"
          />
        </section>
      </div>

      <footer className="mt-auto flex items-center justify-end pt-3">
        <Link href="/privacidad" className="eyebrow text-ink/45 underline underline-offset-2">
          {t.join.consentLink}
        </Link>
      </footer>
    </Screen>
  );
}
