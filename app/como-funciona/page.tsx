import { Screen, Slab } from "@/components/ui/Screen";
import { TopBar } from "@/components/ui/TopBar";
import { getI18n } from "@/lib/i18n/server";

/**
 * Explicación del flujo completo para quien recién se une al equipo: desde
 * que un cliente invita hasta que esa invitación se factura. Enlazada desde
 * el tile de "cómo funciona" en /inicio -pública, como el resto del portal
 * del equipo, porque no enseña ningún dato, solo el mecanismo.
 */
export default async function ComoFuncionaPage() {
  const { locale, t } = await getI18n();

  const steps = [
    { title: t.guide.step1Title, body: t.guide.step1Body },
    { title: t.guide.step2Title, body: t.guide.step2Body },
    { title: t.guide.step3Title, body: t.guide.step3Body },
    { title: t.guide.step4Title, body: t.guide.step4Body },
    { title: t.guide.step5Title, body: t.guide.step5Body },
  ];

  return (
    <Screen tone="ink" className="gap-7">
      <TopBar locale={locale} back="/inicio" backLabel={t.home.eyebrow} />

      <div>
        <p className="eyebrow text-chalk/40">{t.guide.eyebrow}</p>
        <h1 className="display mt-1.5 text-[2rem]">{t.guide.title}</h1>
        <p className="mt-3 text-[0.9375rem] leading-relaxed text-chalk/60">{t.guide.intro}</p>
      </div>

      <Slab className="flex flex-col gap-5 p-6">
        {steps.map((step, i) => (
          <div key={step.title} className="flex items-start gap-4">
            <span className="numeral flex size-8 shrink-0 items-center justify-center rounded-full bg-lime text-[0.8125rem] font-bold text-ink">
              {i + 1}
            </span>
            <div>
              <p className="font-semibold">{step.title}</p>
              <p className="mt-1 text-[0.875rem] leading-relaxed text-chalk/55">{step.body}</p>
            </div>
          </div>
        ))}
      </Slab>

      <div className="flex-1" />
    </Screen>
  );
}
