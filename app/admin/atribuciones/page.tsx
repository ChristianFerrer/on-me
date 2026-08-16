import Link from "next/link";
import { redirect } from "next/navigation";
import { BottomNav } from "@/components/admin/BottomNav";
import { HomeIcon, OrbitIcon } from "@/components/ui/Icons";
import { LangSwitch } from "@/components/ui/LangSwitch";
import { Screen } from "@/components/ui/Screen";
import { getAdminContext } from "@/lib/auth/admin";
import { cn } from "@/lib/cn";
import { db } from "@/lib/db/client";
import { STATE_BADGE_SKIN, stateBadgeLabel } from "@/lib/giftGraph/stateBadge";
import { formatDateTime } from "@/lib/i18n";
import { getI18n } from "@/lib/i18n/server";
import { firstName } from "@/lib/scan-service";

/**
 * Registro de atribuciones: la tabla de facturación y de auditoría.
 *
 * Es append-only. Si algo está mal, se marca `disputed`, no se borra — la
 * defensa de una factura es poder enseñar la fila y el escaneo que la generó.
 *
 * La constelación vive aparte, en /admin -la portada del panel-: es una
 * exploración a pantalla completa, no una tarjeta más de esta lista.
 */
export default async function AttributionsPage() {
  const ctx = await getAdminContext();
  if (!ctx) redirect("/admin");

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
    ? await db().from("customers").select("id, name").in("id", ids)
    : { data: [] };

  const names = new Map((people ?? []).map((row) => [row.id, firstName(row.name)]));

  return (
    <Screen tone="ink" className="gap-7 pb-28 lg:max-w-3xl">
      <header className="flex items-center justify-between gap-3 pt-2">
        <div className="flex items-center gap-3">
          <Link
            href="/inicio"
            prefetch={false}
            className="-m-2 p-2 text-chalk/45 transition-colors hover:text-chalk"
            aria-label={t.home.eyebrow}
          >
            <HomeIcon className="size-6" />
          </Link>
          <div>
            <p className="eyebrow text-chalk/35">{ctx.shop.name}</p>
            <h1 className="display mt-1 text-[1.75rem]">{t.admin.attributions}</h1>
          </div>
        </div>
        <LangSwitch locale={locale} tone="chalk" />
      </header>

      <Link
        href="/admin"
        prefetch={false}
        className="btn items-center gap-2 bg-lime px-6 py-4 text-[1rem] text-ink"
      >
        <OrbitIcon className="size-5" />
        {t.admin.viewReferralMap}
      </Link>

      {attributions.length === 0 ? (
        <p className="text-[0.9375rem] text-chalk/45">{t.admin.attrEmpty}</p>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {attributions.map((row) => (
            <li key={row.id} className="rounded-2xl bg-ink p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-[1.0625rem] font-semibold">
                    {names.get(row.ahijado_id) ?? "—"}
                  </p>
                  <p className="eyebrow mt-1.5 text-chalk/35">
                    {t.admin.attrPadrino} · {names.get(row.padrino_id) ?? "—"}
                  </p>
                </div>
                <span
                  className={cn(
                    "eyebrow shrink-0 rounded-full px-2.5 py-1",
                    STATE_BADGE_SKIN[row.state],
                  )}
                >
                  {stateBadgeLabel(row.state, t)}
                </span>
              </div>

              <dl className="numeral mt-4 grid grid-cols-2 gap-3 text-[0.75rem] text-chalk/45">
                <div>
                  <dt className="text-chalk/30">{t.admin.attrRedeemed}</dt>
                  <dd className="mt-0.5">{formatDateTime(row.redeemed_at, locale)}</dd>
                </div>
                <div>
                  <dt className="text-chalk/30">{t.admin.attrReturned}</dt>
                  <dd className="mt-0.5">
                    {row.returned_at ? formatDateTime(row.returned_at, locale) : "—"}
                  </dd>
                </div>
              </dl>
            </li>
          ))}
        </ul>
      )}

      <BottomNav t={t.admin} active="atribuciones" />
    </Screen>
  );
}
