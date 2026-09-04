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

      <CardLive
        customerId={card.customer.id}
        shopName={shop.name}
        goal={shop.stamps_goal}
        bonusStamps={shop.bonus_stamps}
        // El QR va renderizado desde aquí -componente async de servidor,
        // no se puede montar dentro de CardLive-, pero CardLive es quien
        // decide cuándo se ve: solo así los botones de cafés/invitaciones/
        // oráculo pueden hacerlo girar, compartiendo el mismo estado de
        // "cara activa". Token pelado, no una URL -cuantos menos módulos,
        // antes decodifica el escáner del barista-.
        qr={
          <QrCode
            value={card.customer.token}
            label={t.card.showToBarista}
            className="mx-auto w-full max-w-[9rem]"
          />
        }
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
          showToBarista: t.card.showToBarista,
          freeCoffees: t.card.freeCoffees,
          inviteRowLabel: t.card.inviteRowLabel,
          inviteCta: t.card.inviteCta,
          guestReturned: t.card.guestReturned,
          guestReturnedBody: t.card.guestReturnedBody,
          oracleLabel: t.card.oracleLabel,
          oracleCta: t.card.oracleCta,
          oracleMessages: t.card.oracleMessages,
        }}
      />

      <footer className="mt-auto flex items-center justify-end pt-3">
        <Link href="/privacidad" className="eyebrow text-ink/45 underline underline-offset-2">
          {t.join.consentLink}
        </Link>
      </footer>
    </Screen>
  );
}
