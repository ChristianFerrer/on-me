import { GiftUniverse } from "@/components/universe/GiftUniverse";
import { getI18n } from "@/lib/i18n/server";

/**
 * Revisión del universo 3D de la constelación contra datos de ejemplo, antes
 * de conectarlo a /admin. A diferencia del resto de
 * /preview, esta sí queda accesible en producción a propósito —Vercel
 * compila esta rama entera con NODE_ENV=production, así que el guardián
 * habitual (`if (NODE_ENV === "production") notFound()`) la escondía en
 * todas partes, no solo en el sitio real— para poder abrirla desde el
 * móvil mientras se revisa. Solo enseña datos de ejemplo, sin datos reales
 * ni autenticación de por medio.
 */
export default async function UniversePreviewPage() {
  const { t, locale } = await getI18n();

  return <GiftUniverse t={t} locale={locale} />;
}
