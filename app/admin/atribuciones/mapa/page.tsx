import { redirect } from "next/navigation";
import { SaltosMap } from "@/components/admin/SaltosMap";
import { getAdminContext } from "@/lib/auth/admin";
import { loadRealGiftGraph } from "@/lib/giftGraph/loadRealGiftGraph";
import { getI18n } from "@/lib/i18n/server";

/**
 * El mapa a pantalla completa. Server Component solo para la parte que
 * tiene que serlo —sesión y datos—; el resto (arrastrar, zoom, selección)
 * es inevitablemente cliente, así que se le pasa el grafo ya resuelto.
 *
 * El HUD ya no toma sus números de /admin/embudo (loadFunnel): esa
 * pantalla cuenta histórico de toda la vida del negocio ("cuántas
 * invitaciones se han enviado alguna vez"), mientras que esta -un mapa
 * del grafo actual- necesita el estado de CADA punto ahora mismo, que es
 * justo lo que ya cuenta la leyenda. Para "facturable" ambas cuentas
 * coinciden porque es un estado terminal, pero para "enviada"/"abierta"
 * -estados de paso- un cliente puede haber pasado por ahí y seguir de
 * camino a otro; el histórico y la foto actual son, con toda razón,
 * números distintos. Enseñar los dos juntos con la misma etiqueta en la
 * misma pantalla, con valores distintos, se lee como un dato roto. El
 * HUD se calcula dentro de SaltosMap desde el propio grafo -misma fuente
 * que la leyenda-, así que las dos cifras nunca pueden discreparse.
 */
export default async function ReferralMapPage() {
  const ctx = await getAdminContext();
  if (!ctx) redirect("/admin");

  const { locale, t } = await getI18n();
  const graph = await loadRealGiftGraph(ctx.shop.id, ctx.shop.name);

  return <SaltosMap graph={graph} shopName={ctx.shop.name} stampsGoal={ctx.shop.stamps_goal} locale={locale} t={t} />;
}
