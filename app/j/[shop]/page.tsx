import { notFound } from "next/navigation";
import { JoinForm } from "@/components/client/JoinForm";
import { LangSwitch } from "@/components/ui/LangSwitch";
import { Logo } from "@/components/ui/Logo";
import { Screen, Sheet } from "@/components/ui/Screen";
import { StampCard } from "@/components/ui/StampCard";
import { db } from "@/lib/db/client";
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

  const { data: shop } = await db()
    .from("shops")
    .select("slug, name, address, hours, stamps_goal")
    .eq("slug", slug)
    .maybeSingle();

  if (!shop) notFound();

  return (
    <Screen className="gap-7 pb-10">
      <header className="flex items-center justify-between">
        <Logo />
        <LangSwitch locale={locale} label={t.common.switchTo} />
      </header>

      <div className="stagger flex flex-col gap-6">
        <div className="relative">
          <span
            aria-hidden
            className="halftone halftone-lg anim-drift absolute -right-8 -top-10 -z-10 size-40 rounded-full text-saffron"
          />
          <p className="overline text-ink-faint">{shop.name}</p>
          <h1 className="display-tight mt-2 text-[clamp(2.6rem,13vw,3.6rem)]">
            {t.join.title}
          </h1>
          <p className="mt-3 max-w-[24ch] text-[1.1rem] font-medium leading-snug text-ink-soft">
            {t.join.subtitle}
          </p>
        </div>

        <Sheet className="bg-paper-deep p-5" tint="var(--color-jade)">
          <StampCard stamps={0} goal={shop.stamps_goal} />
        </Sheet>

        <JoinForm
          shop={shop.slug}
          shopName={shop.name}
          locale={locale}
          t={t.join}
          privacyHref="/privacidad"
        />
      </div>

      <footer className="mt-auto border-t-2 border-ink/15 pt-4">
        <p className="text-[0.85rem] leading-snug text-ink-faint">
          {shop.address}
          {shop.hours ? ` · ${shop.hours}` : ""}
        </p>
      </footer>
    </Screen>
  );
}
