import { notFound } from "next/navigation";
import { JoinForm } from "@/components/client/JoinForm";
import { Screen } from "@/components/ui/Screen";
import { StampCard } from "@/components/ui/StampCard";
import { TopBar } from "@/components/ui/TopBar";
import { assertNoQueryError, db } from "@/lib/db/client";
import { getI18n } from "@/lib/i18n/server";

/**
 * Alta desde el QR pegado en la barra. Es la primera pantalla que ve nadie
 * y la que decide el abandono, así que arriba va lo que se gana y abajo lo
 * que cuesta — nunca al revés.
 */
export default async function JoinPage({
  params,
}: {
  params: Promise<{ shop: string }>;
}) {
  const { shop: slug } = await params;
  const { locale, t } = await getI18n();

  const { data: shop, error } = await db()
    .from("shops")
    .select("slug, name, address, hours, stamps_goal")
    .eq("slug", slug)
    .maybeSingle();

  assertNoQueryError(error, `shops.slug=${slug}`);
  if (!shop) notFound();

  return (
    <Screen className="gap-7 pb-10">
      <TopBar />

      <div className="stagger flex flex-col gap-7">
        <div className="pt-4 text-center">
          <p className="eyebrow text-ink/45">{shop.name}</p>
          <h1 className="display-tight mt-3 text-[clamp(2.5rem,12vw,3.25rem)]">
            {t.join.title}
          </h1>
          <p className="mx-auto mt-4 max-w-[26ch] text-[1rem] font-medium leading-relaxed text-ink/65">
            {t.join.subtitle}
          </p>
        </div>

        <StampCard stamps={0} goal={shop.stamps_goal} className="px-6" />

        <JoinForm
          shop={shop.slug}
          shopName={shop.name}
          locale={locale}
          t={t.join}
          privacyHref="/privacidad"
        />
      </div>

      <footer className="mt-auto pt-6 text-center">
        <p className="text-[0.8125rem] leading-relaxed text-ink/45">
          {shop.address}
          {shop.hours ? ` · ${shop.hours}` : ""}
        </p>
      </footer>
    </Screen>
  );
}
