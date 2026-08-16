import { Screen } from "@/components/ui/Screen";
import { StampCard } from "@/components/ui/StampCard";
import { TopBar } from "@/components/ui/TopBar";
import { getI18n } from "@/lib/i18n/server";

/**
 * Portada. Nadie llega aquí desde el flujo real —se entra por el QR de la
 * barra o por un enlace de WhatsApp—, así que su único trabajo es explicar
 * qué es esto a quien teclee el dominio.
 */
export default async function HomePage() {
  const { t } = await getI18n();

  return (
    <Screen className="gap-8">
      <TopBar />

      <div className="stagger flex flex-col gap-9 pt-[7vh] text-center">
        <div>
          <h1 className="display-tight text-balance text-[clamp(2.75rem,13vw,3.75rem)]">
            {t.join.title}
          </h1>
          <p className="mx-auto mt-5 max-w-[24ch] text-[1.0625rem] font-medium leading-relaxed text-ink/65">
            {t.join.subtitle}
          </p>
        </div>

        <div className="glass-dark p-7 text-left">
          <p className="eyebrow text-chalk/40">{t.card.eyebrow}</p>
          <StampCard stamps={7} goal={10} tone="dark" className="mt-5" />
          <p className="numeral mt-5 text-[0.875rem] text-chalk/50">
            {t.card.stampsOf.replace("{n}", "7").replace("{goal}", "10")}
          </p>
        </div>
      </div>

      <footer className="mt-auto pb-2 pt-10 text-center">
        <p className="text-[0.875rem] leading-relaxed text-ink/45">
          {t.errors.notFoundBody}
        </p>
      </footer>
    </Screen>
  );
}
