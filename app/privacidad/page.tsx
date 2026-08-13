import { LangSwitch } from "@/components/ui/LangSwitch";
import { Logo } from "@/components/ui/Logo";
import { Screen, Sheet } from "@/components/ui/Screen";
import { getI18n } from "@/lib/i18n/server";

/**
 * Texto de tratamiento de datos, enlazado desde el consentimiento del alta.
 *
 * El responsable del tratamiento es la cafetería; OnMe es encargado. Antes
 * de la primera alta real hace falta el contrato de encargo firmado.
 */
export default async function PrivacyPage() {
  const { locale, t } = await getI18n();

  return (
    <Screen className="gap-7">
      <header className="flex items-center justify-between">
        <Logo />
        <LangSwitch locale={locale} label={t.common.switchTo} />
      </header>

      <Sheet className="bg-cobalt p-6 text-paper" tint="var(--color-saffron)">
        <h1 className="display text-[2.2rem] leading-tight">{t.legal.privacyTitle}</h1>
        <p className="mt-4 text-[1rem] leading-relaxed text-paper/90">
          {t.legal.privacyBody}
        </p>
      </Sheet>
    </Screen>
  );
}
