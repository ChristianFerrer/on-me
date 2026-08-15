import { redirect } from "next/navigation";
import { SaltosMap } from "@/components/admin/SaltosMap";
import { getAdminContext } from "@/lib/auth/admin";
import { loadRealGiftGraph } from "@/lib/giftGraph/loadRealGiftGraph";
import { getI18n } from "@/lib/i18n/server";

/**
 * El mapa a pantalla completa. Server Component solo para la parte que
 * tiene que serlo —sesión y datos—; el resto (arrastrar, zoom, selección)
 * es inevitablemente cliente, así que se le pasa el grafo ya resuelto.
 */
export default async function ReferralMapPage() {
  const ctx = await getAdminContext();
  if (!ctx) redirect("/admin");

  const { locale, t } = await getI18n();
  const graph = await loadRealGiftGraph(ctx.shop.id, ctx.shop.name);

  return <SaltosMap graph={graph} shopName={ctx.shop.name} stampsGoal={ctx.shop.stamps_goal} locale={locale} t={t} />;
}
