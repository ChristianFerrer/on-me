"use client";

import { useState } from "react";
import { MetricsSidePanel } from "@/components/admin/metrics/MetricsSidePanel";
import { cn } from "@/lib/cn";
import { fill } from "@/lib/i18n";

export type TodoRow = { id: string; primary: string; secondary?: string };
export type TodoCategory = { key: string; tabLabel: string; rows: TodoRow[] };

const VISIBLE_ROWS = 6;

function TodoRowItem({ row, whatsappDisabledLabel }: { row: TodoRow; whatsappDisabledLabel: string }) {
  return (
    <li className="flex items-center justify-between gap-3 rounded-xl bg-white/4 px-3.5 py-2.5">
      <div className="min-w-0">
        <p className="truncate text-[0.875rem] font-medium">{row.primary}</p>
        {row.secondary ? <p className="text-[0.75rem] text-chalk/40">{row.secondary}</p> : null}
      </div>
      <button
        type="button"
        disabled
        title={whatsappDisabledLabel}
        aria-label={whatsappDisabledLabel}
        className="btn shrink-0 cursor-not-allowed bg-white/6 px-3 py-2 text-[0.75rem] text-chalk/30"
      >
        WhatsApp
      </button>
    </li>
  );
}

/**
 * "Qué hacer hoy" en una sola tarjeta -spec §6-: un selector segmentado con
 * el recuento de cada categoría arriba, una sola lista visible a la vez
 * -máximo 6 filas-, un panel lateral para ver la lista completa y un botón
 * masivo, siempre con el mismo candado de WhatsApp que cada fila suelta:
 * OnMe no guarda todavía ningún consentimiento de contacto comercial -solo
 * el de tratamiento de datos de la tarjeta, una base legal distinta-, así
 * que no se envía nada hasta que ese campo exista.
 */
export function TodoPanel({
  categories,
  emptyLabel,
  whatsappDisabledLabel,
  seeAllTemplate,
  bulkNotifyTemplate,
}: {
  categories: TodoCategory[];
  emptyLabel: string;
  whatsappDisabledLabel: string;
  /** Plantilla con {n}, p.ej. "ver los {n}". */
  seeAllTemplate: string;
  /** Plantilla con {n}, p.ej. "avisar a los {n} de la lista". */
  bulkNotifyTemplate: string;
}) {
  const [activeKey, setActiveKey] = useState(categories[0]?.key ?? "");
  const [panelOpen, setPanelOpen] = useState(false);
  const active = categories.find((c) => c.key === activeKey) ?? categories[0];
  const rows = active?.rows ?? [];
  const visible = rows.slice(0, VISIBLE_ROWS);
  const seeAllLabel = fill(seeAllTemplate, { n: rows.length });

  function selectCategory(key: string) {
    setActiveKey(key);
    setPanelOpen(false);
  }

  return (
    <div className="metrics-card flex h-full flex-col gap-3.5 p-[18px]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-wrap gap-1.5">
          {categories.map((cat) => (
            <button
              key={cat.key}
              type="button"
              onClick={() => selectCategory(cat.key)}
              aria-pressed={cat.key === active?.key}
              className={cn(
                "eyebrow rounded-full px-3 py-1.5 text-[0.625rem] transition-colors",
                cat.key === active?.key ? "bg-lime/15 text-lime" : "bg-white/6 text-chalk/50 hover:text-chalk/70",
              )}
            >
              {cat.tabLabel} <span className="numeral">({cat.rows.length})</span>
            </button>
          ))}
        </div>
        <button
          type="button"
          disabled
          title={whatsappDisabledLabel}
          aria-label={whatsappDisabledLabel}
          className="btn shrink-0 cursor-not-allowed bg-white/6 px-3.5 py-2 text-[0.75rem] text-chalk/30"
        >
          {fill(bulkNotifyTemplate, { n: rows.length })}
        </button>
      </div>

      {rows.length === 0 ? (
        <p className="text-[0.8125rem] text-chalk/35">{emptyLabel}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {visible.map((row) => (
            <TodoRowItem key={row.id} row={row} whatsappDisabledLabel={whatsappDisabledLabel} />
          ))}
        </ul>
      )}

      {rows.length > VISIBLE_ROWS ? (
        <button
          type="button"
          onClick={() => setPanelOpen(true)}
          className="btn self-start bg-white/6 px-4 py-2 text-[0.8125rem] text-chalk/70 hover:text-chalk"
        >
          {seeAllLabel}
        </button>
      ) : null}

      <MetricsSidePanel open={panelOpen} title={seeAllLabel} onClose={() => setPanelOpen(false)}>
        <ul className="flex flex-col gap-2">
          {rows.map((row) => (
            <TodoRowItem key={row.id} row={row} whatsappDisabledLabel={whatsappDisabledLabel} />
          ))}
        </ul>
      </MetricsSidePanel>
    </div>
  );
}
