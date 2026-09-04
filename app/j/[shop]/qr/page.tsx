import Link from "next/link";
import { notFound } from "next/navigation";
import { HomeIcon } from "@/components/ui/Icons";
import { QrCode } from "@/components/ui/QrCode";
import { assertNoQueryError, db } from "@/lib/db/client";
import { env } from "@/lib/env";
import { getI18n } from "@/lib/i18n/server";

/**
 * Cartel del QR de alta, pensado para quedarse en pantalla: un monitor en
 * el mostrador, el móvil del barista apoyado en la barra, o el del propio
 * cliente. Por eso no lleva la maqueta de tarjeta de móvil del resto de
 * OnMe —ocupa el viewport entero y el tamaño del QR crece con él— ni nada
 * interactivo: es una pantalla para leer desde lejos, no para tocar.
 */
export default async function JoinQrPage({
  params,
  searchParams,
}: {
  params: Promise<{ shop: string }>;
  searchParams: Promise<{ from?: string }>;
}) {
  const { shop: slug } = await params;
  const { from } = await searchParams;
  const { locale, t } = await getI18n();

  // Solo rutas propias de la app: nunca un origen externo -abre esta
  // pantalla el barista desde el escáner (?from=/s), o cualquiera desde
  // /inicio-.
  const backHref = from === "/s" ? "/s" : "/inicio";

  const { data: shop, error } = await db()
    .from("shops")
    .select("slug, name")
    .eq("slug", slug)
    .maybeSingle();

  assertNoQueryError(error, `shops.slug=${slug}`);
  if (!shop) notFound();

  const url = `${env.baseUrl}/j/${shop.slug}`;
  const displayUrl = url.replace(/^https?:\/\//, "");

  return (
    // `svh`, no `dvh` -mismo motivo que Screen.tsx-: Safari iOS no calcula
    // `dvh` de forma fiable en la primera pintura, y este cartel puede
    // acabar abierto en un móvil -no solo en el monitor del mostrador- vía
    // `?from=/s`.
    <div className="aurora-night min-h-svh w-full text-chalk" lang={locale}>
      <Link
        href={backHref}
        prefetch={false}
        aria-label={t.home.eyebrow}
        className="fixed left-3 top-[max(0.75rem,calc(env(safe-area-inset-top)_-_0.5rem))] p-2 text-chalk/30 transition-colors hover:text-chalk/70"
      >
        <HomeIcon className="size-6" />
      </Link>

      <main className="mx-auto flex min-h-svh w-full max-w-[42rem] flex-col items-center justify-center gap-[4vh] py-10 pl-[max(2rem,env(safe-area-inset-left))] pr-[max(2rem,env(safe-area-inset-right))] text-center">
        <div>
          <p className="eyebrow text-chalk/65">{shop.name}</p>
          <h1 className="display-tight mt-3 text-[clamp(1.75rem,5vw,3rem)]">
            {t.poster.eyebrow}
          </h1>
        </div>

        {/* La tarjeta del QR se queda blanca a propósito, gradiente o no
            detrás: menos contraste, más tarda el escáner en decodificar. */}
        <div className="w-full max-w-[min(70vw,26rem)] rounded-[var(--radius-card)] bg-white p-[6%] shadow-[0_2rem_5rem_-1.5rem_rgba(7,9,8,0.55)]">
          <QrCode value={url} label={t.poster.eyebrow} className="aspect-square w-full" />
        </div>

        <div>
          <p className="text-[clamp(0.9375rem,2.2vw,1.125rem)] font-medium text-chalk/70">
            {t.poster.hint}
          </p>
          <p className="mt-2 text-[clamp(0.8125rem,1.8vw,1rem)] text-chalk/40">
            {t.poster.urlHint} <span className="font-semibold text-chalk/65">{displayUrl}</span>
          </p>
        </div>
      </main>
    </div>
  );
}
