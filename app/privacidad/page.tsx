import Link from "next/link";
import { ArrowLeftIcon } from "@/components/ui/Icons";
import { Screen, Slab } from "@/components/ui/Screen";
import { TopBar } from "@/components/ui/TopBar";
import { getI18n } from "@/lib/i18n/server";

/**
 * Texto de tratamiento de datos, enlazado desde el consentimiento del alta
 * y también desde el panel. El "volver al panel" solo aparece si se llega
 * desde ahí (`?from=admin`): para un cliente que la abre desde el
 * consentimiento no hay panel al que volver.
 *
 * El responsable del tratamiento es la cafetería; OnMe es encargado. Antes
 * de la primera alta real hace falta el contrato de encargo firmado.
 */
export default async function PrivacyPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string }>;
}) {
  const { t } = await getI18n();
  const { from } = await searchParams;
  const fromAdmin = from === "admin";

  return (
    <Screen tone="quiet" className="gap-7">
      {fromAdmin ? (
        <Link
          href="/admin"
          prefetch={false}
          className="flex items-center gap-2 pt-2 text-[0.9375rem] font-medium text-ink/60 transition-colors hover:text-ink"
        >
          <ArrowLeftIcon className="size-4" />
          {t.admin.backToPanel}
        </Link>
      ) : (
        <TopBar />
      )}

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
