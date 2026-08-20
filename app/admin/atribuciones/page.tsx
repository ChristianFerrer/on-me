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
  if (!ctx) redirect("/admin/constelacion-sol");

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
    guestName: peopleById.get(row.ahijado_id)?.name ?? "—",
    guestPhone: peopleById.get(row.ahijado_id)?.phone ?? "",
    referrerName: peopleById.get(row.padrino_id)?.name ?? "—",
    state: row.state,
    redeemedAt: row.redeemed_at,
    returnedAt: row.returned_at,
  }));

  return (
    <Screen tone="ink" className="gap-5 pb-28 lg:mx-0 lg:max-w-3xl lg:pb-10 lg:pl-72 lg:pr-10">
      <header className="sticky top-0 z-10 -mx-5 flex items-center gap-3 bg-ink/85 px-5 py-3.5 backdrop-blur-lg lg:mx-0 lg:rounded-2xl lg:px-5">
        <Link
          href="/inicio"
          prefetch={false}
          className="-m-2 p-2 text-chalk/45 transition-colors hover:text-chalk lg:hidden"
          aria-label={t.home.eyebrow}
        >
          <HomeIcon className="size-6" />
        </Link>
        <div>
          <p className="eyebrow text-chalk/35">{ctx.shop.name}</p>
          <h1 className="display mt-1 text-[1.75rem]">{t.admin.attributions}</h1>
        </div>
      </header>

      <AttributionsList rows={items} t={t} locale={locale} />

      <BottomNav t={t.admin} active="atribuciones" />
    </Screen>
  );
}
