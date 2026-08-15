import { redirect } from "next/navigation";
import { SaltosMap } from "@/components/admin/SaltosMap";
import { getAdminContext } from "@/lib/auth/admin";
import { loadRealGiftGraph } from "@/lib/giftGraph/loadRealGiftGraph";
import { getI18n } from "@/lib/i18n/server";
import { loadFunnel } from "@/lib/funnel";

/**
 * El mapa a pantalla completa. Server Component solo para la parte que
 * tiene que serlo —sesión y datos—; el resto (arrastrar, zoom, selección)
 * es inevitablemente cliente, así que se le pasa el grafo ya resuelto.
 *
 * El HUD (enviadas/abiertas/canjes/facturable) reutiliza literalmente los
 * mismos números que /admin/embudo -mismo loadFunnel(), no una cuenta
 * paralela sobre el grafo- para que el dueño nunca vea dos cifras
 * distintas para lo que él entiende como el mismo dato. Antes cada
 * pantalla las recalculaba a su manera y podían no coincidir: "enviadas"
 * en el grafo contaba TODAS las filas de invitations (incluidas las que
 * nunca llegaron a enviarse o acabaron caducadas/anuladas), mientras que
 * el embudo cuenta solo las que de verdad progresaron.
 */
export default async function ReferralMapPage() {
  const ctx = await getAdminContext();
  if (!ctx) redirect("/admin");

  const { locale, t } = await getI18n();
  const [graph, funnel] = await Promise.all([
    loadRealGiftGraph(ctx.shop.id, ctx.shop.name),
    loadFunnel(ctx.shop.id),
  ]);

  return (
    <SaltosMap
      graph={graph}
      shopName={ctx.shop.name}
      stampsGoal={ctx.shop.stamps_goal}
      hud={{ sent: funnel.sent, opened: funnel.opened, redeemed: funnel.redeemed, billable: funnel.returns }}
      locale={locale}
      t={t}
    />
  );
}
