import { notFound } from "next/navigation";
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
}: {
  params: Promise<{ shop: string }>;
}) {
  const { shop: slug } = await params;
  const { locale, t } = await getI18n();

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
    <div className="aurora-night min-h-dvh w-full text-chalk" lang={locale}>
      <main className="mx-auto flex min-h-dvh w-full max-w-[42rem] flex-col items-center justify-center gap-[4vh] px-8 py-10 text-center">
        <div>
          <p className="eyebrow text-chalk/45">{shop.name}</p>
          <h1 className="display-tight mt-3 text-[clamp(1.75rem,5vw,3rem)]">
            {t.poster.eyebrow}
          </h1>
        </div>

        {/* La tarjeta del QR se queda blanca a propósito, gradiente o no
            detrás: menos contraste, más tarda el escáner en decodificar. */}
        <div className="w-full max-w-[min(70vw,26rem)] rounded-[2.5rem] bg-white p-[6%] shadow-[0_2rem_5rem_-1.5rem_rgba(7,9,8,0.55)]">
          <QrCode value={url} label={t.poster.eyebrow} className="w-full" />
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
