"use client";

import { useState } from "react";
import { MetricsSidePanel } from "@/components/admin/metrics/MetricsSidePanel";
import { cn } from "@/lib/cn";

export type PadrinoStatus = "active" | "dormant" | "off";

export type PadrinoRow = {
  id: string;
  name: string;
  invited: number;
  opened: number;
  redeemed: number;
  stayed: number;
  status: PadrinoStatus;
};

type PadrinoLabels = {
  customer: string;
  invited: string;
  opened: string;
  redeemed: string;
  stayed: string;
  status: string;
};

const VISIBLE_ROWS = 8;

function PadrinoTableBody({
  rows,
  labels,
  statusLabels,
}: {
  rows: PadrinoRow[];
  labels: PadrinoLabels;
  statusLabels: Record<PadrinoStatus, string>;
}) {
  return (
    <table className="w-full text-left text-[0.8125rem]">
      <thead>
        <tr className="text-chalk/40">
          <th className="px-3.5 py-2.5 font-medium">{labels.customer}</th>
          <th className="numeral px-3.5 py-2.5 font-medium">{labels.invited}</th>
          <th className="numeral px-3.5 py-2.5 font-medium">{labels.opened}</th>
          <th className="numeral px-3.5 py-2.5 font-medium">{labels.redeemed}</th>
          <th className="numeral px-3.5 py-2.5 font-medium">{labels.stayed}</th>
          <th className="px-3.5 py-2.5 font-medium">{labels.status}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.id} className="border-t border-white/8">
            <td className="max-w-40 truncate px-3.5 py-2.5 font-semibold">{row.name}</td>
            <td className="numeral px-3.5 py-2.5 text-chalk/60">{row.invited}</td>
            <td className="numeral px-3.5 py-2.5 text-chalk/60">{row.opened}</td>
            <td className="numeral px-3.5 py-2.5 text-chalk/60">{row.redeemed}</td>
            <td className="numeral px-3.5 py-2.5 text-chalk/60">{row.stayed}</td>
            <td className="px-3.5 py-2.5">
              <span
                className={cn(
                  "eyebrow rounded-full px-2 py-0.5 text-[0.625rem]",
                  row.status === "active"
                    ? "bg-lime/15 text-lime"
                    : row.status === "dormant"
                      ? "bg-amber/15 text-amber"
                      : "bg-white/8 text-chalk/50",
                )}
              >
                {statusLabels[row.status]}
              </span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/**
 * Máximo 8 filas visibles -spec §7.6-, sin scroll interno: si hay más, un
 * enlace abre el panel lateral con la lista completa en vez de crecer la
 * propia tarjeta o esconder el resto detrás de un scroll.
 */
export function PadrinoTable({
  rows,
  labels,
  statusLabels,
  emptyLabel,
  seeAllLabel,
}: {
  rows: PadrinoRow[];
  labels: PadrinoLabels;
  statusLabels: Record<PadrinoStatus, string>;
  emptyLabel: string;
  seeAllLabel: string;
}) {
  const [showAll, setShowAll] = useState(false);

  if (!rows.length) return <p className="text-[0.9375rem] text-chalk/45">{emptyLabel}</p>;

  const visible = rows.slice(0, VISIBLE_ROWS);

  return (
    <div className="flex flex-col gap-3">
      <div className="metrics-card overflow-x-auto p-0">
        <PadrinoTableBody rows={visible} labels={labels} statusLabels={statusLabels} />
      </div>
      {rows.length > VISIBLE_ROWS ? (
        <button
          type="button"
          onClick={() => setShowAll(true)}
          className="btn self-start bg-white/6 px-4 py-2 text-[0.8125rem] text-chalk/70 hover:text-chalk"
        >
          {seeAllLabel}
        </button>
      ) : null}

      <MetricsSidePanel open={showAll} title={seeAllLabel} onClose={() => setShowAll(false)}>
        <div className="metrics-card overflow-x-auto p-0">
          <PadrinoTableBody rows={rows} labels={labels} statusLabels={statusLabels} />
        </div>
      </MetricsSidePanel>
    </div>
  );
}
