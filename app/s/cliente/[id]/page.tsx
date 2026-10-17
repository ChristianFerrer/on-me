import { notFound, redirect } from "next/navigation";
import { CustomerVisit } from "@/components/barista/CustomerVisit";
import { getDeviceContext, pinRequired } from "@/lib/auth/device";
import { getCustomerProfile } from "@/lib/identify-service";
import { getI18n } from "@/lib/i18n/server";

/**
 * Ficha de un cliente encontrado por búsqueda manual -ver /s/buscar- o
 * tocado en la lista de llegadas -ver ArrivalsTray.tsx-. Mismo
 * panel que el flujo identificador (ver CustomerVisit.tsx): un cliente
 * encontrado a mano no merece una pantalla más pobre que uno escaneado.
 */
export default async function CustomerPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string }>;
}) {
  const ctx = await getDeviceContext();
  if (!ctx) redirect("/s");

  const { id } = await params;
  // Desde la lista de llegadas -ver ArrivalsTray.tsx- se vuelve a la
  // cámara, no a la búsqueda: el barista nunca estuvo buscando.
  const { from } = await searchParams;
  const backHref = from === "llegadas" ? "/s" : "/s/buscar";
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
      backHref={backHref}
    />
  );
}
