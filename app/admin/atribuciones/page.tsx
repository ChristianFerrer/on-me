import Link from "next/link";
import { redirect } from "next/navigation";
import { Screen } from "@/components/ui/Screen";
import { getAdminContext } from "@/lib/auth/admin";
import { cn } from "@/lib/cn";
import { db } from "@/lib/db/client";
import { formatDateTime } from "@/lib/i18n";
import { getI18n } from "@/lib/i18n/server";
import { firstName } from "@/lib/scan-service";

const STATE_SKIN = {
  billable: "bg-jade text-ink",
  window: "bg-saffron text-ink",
  discarded: "bg-smoke text-paper",
} as const;

/**
 * Registro de atribuciones: la tabla de facturación y de auditoría.
 *
 * Es append-only. Si algo está mal, se marca `disputed`, no se borra — la
 * defensa de una factura es poder enseñar la fila y el escaneo que la generó.
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

  const label = {
    billable: t.admin.attrBillable,
    window: t.admin.attrWindow,
    discarded: t.admin.attrDiscarded,
  } as const;

  return (
    <Screen tone="ink" className="gap-6 pb-10">
      <header className="flex items-center justify-between gap-3">
        <Link href="/admin" prefetch={false} className="overline text-paper/50">
          ← {t.common.back}
        </Link>
        <span className="numeral text-[0.8rem] text-paper/50">
          {attributions.length}
        </span>
      </header>

      <h1 className="display text-[2rem] text-paper">{t.admin.attributions}</h1>

      {attributions.length === 0 ? (
        <p className="text-[0.95rem] text-paper/60">{t.admin.attrEmpty}</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {attributions.map((row) => (
            <li
              key={row.id}
              className="rounded-2xl border-2 border-paper/20 p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[1.05rem] font-semibold leading-tight">
                    {names.get(row.ahijado_id) ?? "—"}
                  </p>
                  <p className="overline mt-1 text-paper/50">
                    {t.admin.attrPadrino}: {names.get(row.padrino_id) ?? "—"}
                  </p>
                </div>
                <span
                  className={cn(
                    "overline shrink-0 rounded-full border-2 border-ink px-2.5 py-1",
                    STATE_SKIN[row.state],
                  )}
                >
                  {label[row.state]}
                </span>
              </div>

              <dl className="numeral mt-3 grid grid-cols-2 gap-2 text-[0.78rem] text-paper/60">
                <div>
                  <dt className="opacity-70">{t.admin.attrRedeemed}</dt>
                  <dd>{formatDateTime(row.redeemed_at, locale)}</dd>
                </div>
                <div>
                  <dt className="opacity-70">{t.admin.attrReturned}</dt>
                  <dd>
                    {row.returned_at
                      ? formatDateTime(row.returned_at, locale)
                      : "—"}
                  </dd>
                </div>
              </dl>
            </li>
          ))}
        </ul>
      )}
    </Screen>
  );
}
