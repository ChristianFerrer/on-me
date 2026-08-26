import Link from "next/link";
import { redirect } from "next/navigation";
import { AttributionsList, type AttributionRow } from "@/components/admin/AttributionsList";
import { BottomNav } from "@/components/admin/BottomNav";
import { HomeIcon } from "@/components/ui/Icons";
import { Screen } from "@/components/ui/Screen";
import { getAdminContext } from "@/lib/auth/admin";
import { db } from "@/lib/db/client";
import { getI18n } from "@/lib/i18n/server";
import { firstName } from "@/lib/scan-service";

/**
 * Registro de visitas -internamente sigue siendo la tabla `attributions`,
 * la de facturación y auditoría-: append-only, si algo está mal se marca
 * `disputed`, no se borra. La defensa de una factura es poder enseñar la
 * fila y el escaneo que la generó.
 */
export default async function AttributionsPage() {
  const ctx = await getAdminContext();
  if (!ctx) redirect("/admin/constelacion-sol?session=expired");

  const { locale, t } = await getI18n();

  const { data: rows } = await db()
    .from("attributions")
    .select("id, padrino_id, ahijado_id, redeemed_at, returned_at, state, disputed")
    .eq("shop_id", ctx.shop.id)
    .order("redeemed_at", { ascending: false })
    .limit(200);

  const attributions = rows ?? [];

  // Los nombres se resuelven en una sola consulta, sin depender del nombre
  // que Postgres le haya puesto a cada clave ajena.
  const ids = [
    ...new Set(attributions.flatMap((row) => [row.padrino_id, row.ahijado_id])),
  ];

  const { data: people } = ids.length
    ? await db().from("customers").select("id, name, phone_last4").in("id", ids)
    : { data: [] };

  const peopleById = new Map(
    (people ?? []).map((row) => [row.id, { name: firstName(row.name), phone: row.phone_last4 }]),
  );

  const items: AttributionRow[] = attributions.map((row) => ({
    id: row.id,
    guestCustomerId: row.ahijado_id,
    guestName: peopleById.get(row.ahijado_id)?.name ?? "—",
    guestPhone: peopleById.get(row.ahijado_id)?.phone ?? "",
    referrerName: peopleById.get(row.padrino_id)?.name ?? "—",
    state: row.state,
    redeemedAt: row.redeemed_at,
    returnedAt: row.returned_at,
  }));

  return (
    <Screen
      tone="ink"
      fullWidth
      className="gap-5 pb-28 transition-[padding-left] duration-200 ease-[var(--ease-out-soft)] md:mx-0 md:max-w-3xl md:pb-10 md:pl-[calc(var(--admin-sidebar-width,16rem)+2rem)] md:pr-10"
    >
      <header className="flex items-center gap-3 pt-2">
        <Link
          href="/inicio"
          prefetch={false}
          className="-m-2 p-2 text-chalk/45 transition-colors hover:text-chalk md:hidden"
          aria-label={t.home.eyebrow}
        >
          <HomeIcon className="size-6" />
        </Link>
        <div>
          <p className="eyebrow text-chalk/35">{ctx.shop.name}</p>
          <h1 className="display mt-1 text-[1.75rem]">{t.admin.attributions}</h1>
        </div>
      </header>

      <p className="-mt-2 text-[0.8125rem] leading-snug text-chalk/40">
        {t.admin.attrColorNote}
      </p>

      <AttributionsList rows={items} t={t} locale={locale} />

      <BottomNav t={t.admin} active="atribuciones" />
    </Screen>
  );
}
