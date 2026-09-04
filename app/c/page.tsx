import { IBM_Plex_Mono, Outfit } from "next/font/google";
import Link from "next/link";
import { CardCarousel } from "@/components/client/CardCarousel";
import { OfflineBadge } from "@/components/client/OfflineBadge";
import { Mark } from "@/components/ui/Logo";
import { ButtonLink } from "@/components/ui/Button";
import { QrCode } from "@/components/ui/QrCode";
import { Screen, Slab } from "@/components/ui/Screen";
import { TopBar } from "@/components/ui/TopBar";
import { cn } from "@/lib/cn";
import { loadCard } from "@/lib/card";
import { firstName } from "@/lib/scan-service";
import { getI18n } from "@/lib/i18n/server";
import { readCustomerToken } from "@/lib/session";

/**
 * Tipografía propia de /c -spec de la tarjeta de cliente §10-, misma
 * desviación deliberada que /admin/metricas (ver ese page.tsx): Outfit
 * para títulos y texto, IBM Plex Mono para todo número -sobre `.numeral`-,
 * ninguna de las dos la familia única del resto de la app. Variables
 * propias -`--font-card`/`--font-card-mono`-, no las de métricas: cada
 * pantalla carga su propio par, para que quede claro cuál cargó cuál.
 */
const outfit = Outfit({ subsets: ["latin"], variable: "--font-card", display: "swap" });
const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-card-mono",
  display: "swap",
});

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
    // `svh`, no `dvh` -mismo motivo que Screen.tsx-, y fijo, no `min-`: el
    // carrusel de más abajo necesita un padre de alto acotado para que su
    // `flex:1` absorba justo el espacio sobrante, no crecer sin límite.
    <div
      className={cn(
        "card-scope aurora-night flex h-svh w-full flex-col text-chalk",
        outfit.variable,
        plexMono.variable,
      )}
      lang={locale}
    >
      <OfflineBadge label={t.card.offline} />

      <header className="flex-none px-4 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <div className="glass-dark flex items-center gap-2.5 rounded-full px-[18px] py-[clamp(10px,1.9vh,14px)]">
          <Mark className="anim-oracle-pulse size-2" />
          <span className="text-[clamp(15px,2.6vh,17px)] font-extrabold tracking-[-0.02em]">OnMe</span>
          <span className="ml-auto truncate text-[clamp(10px,1.7vh,11.5px)] font-semibold uppercase tracking-[0.2em] text-chalk/55">
            {shop.name}
          </span>
        </div>
      </header>

      <main
        className="flex min-h-0 flex-1 flex-col gap-[clamp(9px,2.1vh,16px)] py-[clamp(9px,2.1vh,16px)] pb-[max(0.75rem,env(safe-area-inset-bottom))]"
        style={{ ["--cw" as string]: "min(80vw, 44vh, 400px)" }}
      >
        <CardCarousel
          customerId={card.customer.id}
          customerFirstName={firstName(card.customer.name)}
          goal={shop.stamps_goal}
          bonusStamps={shop.bonus_stamps}
          // El QR va renderizado desde aquí -componente async de servidor,
          // no se puede montar dentro de CardCarousel-, pero el carrusel
          // decide cuándo se ve: es su primera tarjeta, no algo aparte.
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
            ofGoal: t.card.ofGoal,
            oneToGo: t.card.oneToGo,
            nToGo: t.card.nToGo,
            readyHint: t.card.readyHint,
            codeLabel: t.card.codeLabel,
            showToBarista: t.card.showToBarista,
            freeCoffeeLabel: t.card.freeCoffeeLabel,
            freeCoffeeTitleOne: t.card.freeCoffeeTitleOne,
            freeCoffeeTitleMany: t.card.freeCoffeeTitleMany,
            freeCoffeeBody: t.card.freeCoffeeBody,
            showCodeCta: t.card.showCodeCta,
            giftLabel: t.card.giftLabel,
            giftTitleOne: t.card.giftTitleOne,
            giftTitleMany: t.card.giftTitleMany,
            giftBody: t.card.giftBody,
            giftNotNow: t.card.giftNotNow,
            giftChoose: t.card.giftChoose,
            guestReturned: t.card.guestReturned,
            guestReturnedBody: t.card.guestReturnedBody,
            oracleLabel: t.card.oracleLabel,
            oracleCta: t.card.oracleCta,
            oracleMessages: t.card.oracleMessages,
            constellationLabel: t.card.constellationLabel,
            constellationLoading: t.card.constellationLoading,
            constellationEmptyTitle: t.card.constellationEmptyTitle,
            constellationEmptyBody: t.card.constellationEmptyBody,
          }}
        />
      </main>

      <footer className="flex-none px-4 pb-[max(0.5rem,env(safe-area-inset-bottom))] text-right">
        <Link href="/privacidad" className="eyebrow text-chalk/45 underline underline-offset-2">
          {t.join.consentLink}
        </Link>
      </footer>
    </div>
  );
}
