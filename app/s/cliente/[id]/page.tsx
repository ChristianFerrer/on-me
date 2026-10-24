import { notFound, redirect } from "next/navigation";
import { CustomerVisit } from "@/components/barista/CustomerVisit";
import { getDeviceContext, pinRequired } from "@/lib/auth/device";
import { getCustomerProfile } from "@/lib/identify-service";
import { getI18n } from "@/lib/i18n/server";

/**
 * Ficha de un cliente encontrado por búsqueda manual -ver /s/buscar-. Mismo
 * panel que el flujo identificador (ver CustomerVisit.tsx): un cliente
 * encontrado a mano no merece una pantalla más pobre que uno escaneado.
 */
export default async function CustomerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const ctx = await getDeviceContext();
  if (!ctx) redirect("/s");

  const { id } = await params;
  const { locale, t } = await getI18n();

  const profile = await getCustomerProfile(ctx, id);
  if (profile.kind === "invalid") notFound();

  return (
    <CustomerVisit
      t={t.barista}
      locale={locale}
      shopName={ctx.shop.name}
      initialProfile={profile}
      pinRequired={pinRequired(ctx.device)}
      backHref="/s/buscar"
    />
  );
}
