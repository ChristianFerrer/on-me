import { notFound } from "next/navigation";
import { GiftUniverse } from "@/components/universe/GiftUniverse";
import { getI18n } from "@/lib/i18n/server";

/**
 * Revisión del universo 3D del mapa de saltos contra datos de ejemplo, antes
 * de conectarlo a /admin/atribuciones/mapa. Como el resto de /preview: no
 * se enlaza desde ningún sitio y devuelve 404 en producción.
 */
export default async function UniversePreviewPage() {
  if (process.env.NODE_ENV === "production") notFound();

  const { t, locale } = await getI18n();

  return <GiftUniverse t={t} locale={locale} />;
}
