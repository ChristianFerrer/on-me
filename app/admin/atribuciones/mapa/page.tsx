import { redirect } from "next/navigation";
import { ReferralUniverse } from "@/components/admin/ReferralUniverse";
import { getAdminContext } from "@/lib/auth/admin";
import { getI18n } from "@/lib/i18n/server";
import { loadReferralTree } from "@/lib/referralTree";

/**
 * El mapa a pantalla completa. Server Component solo para la parte que
 * tiene que serlo —sesión y datos—; el resto (arrastrar, zoom) es
 * inevitablemente cliente, así que se le pasa el árbol ya resuelto.
 */
export default async function ReferralMapPage() {
  const ctx = await getAdminContext();
  if (!ctx) redirect("/admin");

  const { t } = await getI18n();
  const roots = await loadReferralTree(ctx.shop.id);

  return <ReferralUniverse roots={roots} shopName={ctx.shop.name} t={t} />;
}
