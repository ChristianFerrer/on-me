import { Screen, Slab } from "@/components/ui/Screen";
import { TopBar } from "@/components/ui/TopBar";
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
    <Screen tone="quiet" className="gap-7">
      <TopBar locale={locale} />

      <Slab className="p-7">
        <h1 className="display text-[2rem]">{t.legal.privacyTitle}</h1>
        <p className="mt-5 text-[0.9375rem] leading-relaxed text-chalk/65">
          {t.legal.privacyBody}
        </p>
      </Slab>

      <div className="flex-1" />
    </Screen>
  );
}
