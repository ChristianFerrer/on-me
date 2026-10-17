import { IBM_Plex_Mono, Outfit } from "next/font/google";
import { CardCarousel } from "@/components/client/CardCarousel";
import { OfflineBadge } from "@/components/client/OfflineBadge";
import { ButtonLink } from "@/components/ui/Button";
import { QrCode } from "@/components/ui/QrCode";
import { Screen, Slab } from "@/components/ui/Screen";
import { TopBar } from "@/components/ui/TopBar";
import { cn } from "@/lib/cn";
import { loadCard } from "@/lib/card";
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
    // Fondo verde -`aurora`, el mismo degradado que usaba esta pantalla
    // antes del carrusel-, no el morado oscuro de la spec original: es la
    // identidad de color de /c en el resto de la app; con `data-theme`
    // cambia de verdad entre los dos temas del local, y con `data-bg`
    // -solo importa junto a theme='light'- entre las dos variantes de
    // fondo claro -ver .aurora[data-theme="light"][data-bg="…"] en
    // globals.css-, no solo las superficies que flotan encima. `text-ink`,
    // a juego -convención de Screen.tsx-, para lo poco que queda
    // directamente sobre el degradado; las superficies oscuras (tarjeta,
    // iconos) fijan su
    // propio `text-chalk`, igual que ya hace `.slab` en el resto de la
    // app, así que no dependen de este valor para leerse bien. Sin
    // cabecera ni pie propios -la marca y el enlace de privacidad viven
    // ahora dentro de la propia tarjeta, en su reverso, ver
    // CardCarousel.tsx-: la tarjeta pasa a ocupar ella sola todo el
    // bloque superior, sin ceder una fila entera solo para un logo chico.
    <div
      data-theme={shop.theme}
      data-bg={shop.card_background}
      className={cn(
        "card-scope aurora relative flex h-svh w-full flex-col text-ink",
        outfit.variable,
        plexMono.variable,
      )}
      lang={locale}
    >
      <OfflineBadge label={t.card.offline} />

      <main className="flex min-h-0 flex-1 flex-col gap-[clamp(8px,1.8vh,14px)] py-[clamp(10px,2.2vh,16px)] pb-3">
        <CardCarousel
          customerFullName={card.customer.name}
          phoneLast4={card.customer.phone_last4}
          phone={card.customer.phone}
          shopName={shop.name}
          logoUrl={shop.logo_url}
          goal={shop.stamps_goal}
          bonusStamps={shop.bonus_stamps}
          light={shop.theme === "light"}
          cardStyle={shop.card_style}
          // El QR va renderizado desde aquí -componente async de servidor,
          // no se puede montar dentro de CardCarousel-, pero el carrusel
          // decide cuándo se ve: es su primera tarjeta, no algo aparte.
          qr={
            <QrCode value={card.customer.token} label={t.card.showToBarista} className="size-full" />
          }
          initial={{
            stamps: card.stamps,
            rewardsPendingCount: card.rewardsPendingCount,
            inviteCount: card.activeInvites.length + card.pendingGrants,
            returnedGuests: card.returnedGuests,
          }}
          labels={{
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
            profileLabel: t.card.profileLabel,
            profilePhoneHint: t.card.profilePhoneHint,
            eyebrow: t.card.eyebrow,
            consentLink: t.join.consentLink,
            flipLabel: t.card.flipLabel,
            tagline: t.card.tagline,
            showPhoneLabel: t.card.showPhoneLabel,
            hidePhoneLabel: t.card.hidePhoneLabel,
          }}
        />
      </main>
    </div>
  );
}
