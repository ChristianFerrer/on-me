"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { SearchHit } from "@/app/api/search/route";
import { cn } from "@/lib/cn";
import type { Dict } from "@/lib/i18n";

type BaristaDict = Dict["barista"];

/**
 * Plan B de la barra: el cliente se dejó el móvil, la pantalla está rota o
 * no hay luz para la cámara. Se busca por los cuatro últimos dígitos.
 *
 * Si esta vía supera el 15% de los sellos, el escáner no funciona y eso es
 * lo primero que hay que arreglar — el panel lo vigila.
 */
export function ManualSearch({ t }: { t: BaristaDict }) {
  const [last4, setLast4] = useState("");
  /**
   * El resultado se guarda junto a la búsqueda que lo produjo, así se
   * descarta solo al teclear: no hace falta limpiarlo desde el efecto ni
   * mantener un indicador de carga aparte.
   */
  const [result, setResult] = useState<{ query: string; hits: SearchHit[] } | null>(
    null,
  );

  useEffect(() => {
    if (last4.length !== 4) return;

    const controller = new AbortController();

    fetch(`/api/search?last4=${last4}`, { signal: controller.signal })
      .then((response) => (response.ok ? response.json() : { hits: [] }))
      .then((data: { hits: SearchHit[] }) => setResult({ query: last4, hits: data.hits }))
      .catch(() => undefined);

    return () => controller.abort();
  }, [last4]);

  const hits = result?.query === last4 ? result.hits : null;
  const loading = last4.length === 4 && hits === null;

  return (
    <div className="flex flex-1 flex-col gap-6">
      <div>
        <label htmlFor="last4" className="overline text-ink-faint">
          {t.searchTitle}
        </label>
        <input
          id="last4"
          value={last4}
          onChange={(event) =>
            setLast4(event.target.value.replace(/\D/g, "").slice(0, 4))
          }
          inputMode="numeric"
          autoComplete="off"
          autoFocus
          placeholder={t.searchPlaceholder}
          aria-describedby="last4-hint"
          className="numeral field mt-2 text-center text-[2.5rem] tracking-[0.35em]"
        />
        <p id="last4-hint" className="mt-2 text-sm text-ink-faint">
          {t.searchHint}
        </p>
      </div>

      {loading ? <p className="overline text-ink-faint">···</p> : null}

      {hits && hits.length === 0 && !loading ? (
        <p className="text-[1.05rem] font-semibold text-ink-soft">
          {t.searchEmpty}
        </p>
      ) : null}

      <ul className="stagger flex flex-col gap-3">
        {(hits ?? []).map((hit) => (
          <li key={hit.id}>
            <Link
              href={`/s/cliente/${hit.id}`}
              prefetch={false}
              className={cn(
                "riso btn-press flex items-center justify-between gap-4 rounded-2xl border-2 border-ink px-5 py-4",
                hit.rewardPending ? "bg-saffron" : "bg-paper",
              )}
            >
              <span>
                <span className="block text-[1.2rem] font-bold leading-tight">
                  {hit.name}
                </span>
                <span className="numeral text-sm text-ink-soft">
                  ··{hit.last4}
                </span>
              </span>
              <span className="numeral shrink-0 text-[1.15rem] font-semibold">
                {hit.stamps}/{hit.goal}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
