"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { OrbitIcon, SearchIcon } from "@/components/ui/Icons";
import { cn } from "@/lib/cn";
import { STATE_BADGE_SKIN, stateBadgeLabel } from "@/lib/giftGraph/stateBadge";
import type { NodeState } from "@/lib/giftGraph/types";
import { formatDateTime, type Dict, type Locale } from "@/lib/i18n";

export type AttributionRow = {
  id: string;
  guestCustomerId: string;
  guestName: string;
  guestPhone: string;
  referrerName: string;
  state: NodeState;
  redeemedAt: string;
  returnedAt: string | null;
};

/** Minúsculas y sin acentos: así "Ángela" encuentra "angela" y viceversa. */
function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

/**
 * Lista de visitas con búsqueda en cliente: los datos ya viajaron completos
 * desde el servidor -son como mucho 200 filas, límite de la propia
 * consulta-, así que filtrar en el navegador es instantáneo y no hace
 * falta ida y vuelta al servidor por cada tecla.
 */
export function AttributionsList({
  rows,
  t,
  locale,
}: {
  rows: AttributionRow[];
  t: Dict;
  locale: Locale;
}) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = normalize(query.trim());
    if (!q) return rows;
    return rows.filter(
      (row) =>
        normalize(row.guestName).includes(q) ||
        normalize(row.referrerName).includes(q) ||
        row.guestPhone.includes(q),
    );
  }, [rows, query]);

  return (
    <div className="flex flex-col gap-2.5">
      <div className="relative md:max-w-sm">
        <SearchIcon className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-chalk/35" />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t.admin.attrSearchPlaceholder}
          aria-label={t.admin.attrSearchPlaceholder}
          className="field py-3 pl-11 text-[0.9375rem]"
        />
      </div>

      {rows.length === 0 ? (
        <p className="text-[0.9375rem] text-chalk/45">{t.admin.attrEmpty}</p>
      ) : filtered.length === 0 ? (
        <p className="text-[0.9375rem] text-chalk/45">{t.admin.attrSearchEmpty}</p>
      ) : (
        <>
          {/* Tarjetas: solo móvil, una columna estrecha lee mejor apilada
              que en una tabla con celdas diminutas. */}
          <ul className="flex flex-col gap-2 md:hidden">
            {filtered.map((row) => (
              <li key={row.id} className="glass-dark rounded-xl p-3.5">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-[0.9375rem] font-semibold">{row.guestName}</p>
                    <p className="eyebrow mt-0.5 text-chalk/35">
                      {t.admin.attrPadrino} · {row.referrerName}
                    </p>
                  </div>
                  <span
                    className={cn(
                      "eyebrow shrink-0 rounded-full px-2 py-0.5 text-[0.625rem]",
                      STATE_BADGE_SKIN[row.state],
                    )}
                  >
                    {stateBadgeLabel(row.state, t)}
                  </span>
                  <Link
                    href={`/admin/constelacion-sol?focus=${row.guestCustomerId}`}
                    prefetch={false}
                    aria-label={t.admin.attrViewInConstellation}
                    title={t.admin.attrViewInConstellation}
                    className="btn glass-dark size-8 shrink-0 text-chalk/60 hover:text-chalk"
                  >
                    <OrbitIcon className="size-4" />
                  </Link>
                </div>

                <dl className="numeral mt-2.5 flex flex-wrap gap-x-4 gap-y-1 text-[0.6875rem] text-chalk/40">
                  <div className="flex items-baseline gap-1">
                    <dt className="text-chalk/30">{t.admin.attrRedeemed}</dt>
                    <dd>{formatDateTime(row.redeemedAt, locale)}</dd>
                  </div>
                  <div className="flex items-baseline gap-1">
                    <dt className="text-chalk/30">{t.admin.attrReturned}</dt>
                    <dd>{row.returnedAt ? formatDateTime(row.returnedAt, locale) : "—"}</dd>
                  </div>
                </dl>
              </li>
            ))}
          </ul>

          {/* Tabla: desde md, con el mismo ancho de sobra que el resto del
              panel de escritorio aprovecha una fila por visita en vez de
              una tarjeta completa. */}
          <div className="glass-dark hidden overflow-x-auto rounded-xl md:block">
            <table className="w-full text-left text-[0.8125rem]">
              <thead>
                <tr className="text-chalk/40">
                  <th className="px-3.5 py-2.5 font-medium">{t.admin.attrGuest}</th>
                  <th className="px-3.5 py-2.5 font-medium">{t.admin.attrPadrino}</th>
                  <th className="px-3.5 py-2.5 font-medium">{t.admin.attrState}</th>
                  <th className="numeral px-3.5 py-2.5 font-medium">{t.admin.attrRedeemed}</th>
                  <th className="numeral px-3.5 py-2.5 font-medium">{t.admin.attrReturned}</th>
                  <th className="px-3.5 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((row) => (
                  <tr key={row.id} className="border-t border-white/8">
                    <td className="max-w-48 truncate px-3.5 py-2.5 font-semibold">{row.guestName}</td>
                    <td className="max-w-48 truncate px-3.5 py-2.5 text-chalk/60">{row.referrerName}</td>
                    <td className="px-3.5 py-2.5">
                      <span
                        className={cn(
                          "eyebrow rounded-full px-2 py-0.5 text-[0.625rem]",
                          STATE_BADGE_SKIN[row.state],
                        )}
                      >
                        {stateBadgeLabel(row.state, t)}
                      </span>
                    </td>
                    <td className="numeral px-3.5 py-2.5 text-chalk/60">
                      {formatDateTime(row.redeemedAt, locale)}
                    </td>
                    <td className="numeral px-3.5 py-2.5 text-chalk/60">
                      {row.returnedAt ? formatDateTime(row.returnedAt, locale) : "—"}
                    </td>
                    <td className="px-3.5 py-2.5 text-right">
                      <Link
                        href={`/admin/constelacion-sol?focus=${row.guestCustomerId}`}
                        prefetch={false}
                        aria-label={t.admin.attrViewInConstellation}
                        title={t.admin.attrViewInConstellation}
                        className="btn glass-dark inline-flex size-8 text-chalk/60 hover:text-chalk"
                      >
                        <OrbitIcon className="size-4" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
