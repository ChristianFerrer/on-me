"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { SearchHit } from "@/app/api/search/route";
import { SearchIcon } from "@/components/ui/Icons";
import { cn } from "@/lib/cn";
import type { Dict } from "@/lib/i18n";

type BaristaDict = Dict["barista"];

/** Tras esta pausa sin teclear se lanza la búsqueda: ni de letra en letra ni al salir del campo. */
const DEBOUNCE_MS = 400;
/** Menos dígitos que esto no es un móvil real todavía; no vale la pena preguntarle a Supabase. */
const MIN_DIGITS = 6;
/** Menos letras que esto da demasiados falsos positivos como nombre -mismo umbral que /api/search/route.ts-. */
const MIN_NAME_CHARS = 2;

/**
 * Plan B de la barra: el cliente se dejó el móvil, la pantalla está rota o
 * no hay luz para la cámara. Un único campo busca por nombre o por el móvil
 * completo —el mismo que se normaliza y se hashea en el alta—, así no hace
 * falta que el barista sepa de antemano cuál de los dos recuerda.
 *
 * Si esta vía supera el 15% de los sellos, el escáner no funciona y eso es
 * lo primero que hay que arreglar — el panel lo vigila.
 */
export function ManualSearch({ t }: { t: BaristaDict }) {
  const [query, setQuery] = useState("");
  /**
   * El resultado se guarda junto a la búsqueda que lo produjo, así se
   * descarta solo al teclear: no hace falta limpiarlo desde el efecto ni
   * mantener un indicador de carga aparte.
   */
  const [result, setResult] = useState<{ query: string; hits: SearchHit[] } | null>(
    null,
  );

  const digits = query.replace(/\D/g, "").length;
  const trimmed = query.trim();
  const searchable = digits >= MIN_DIGITS || trimmed.length >= MIN_NAME_CHARS;

  useEffect(() => {
    if (!searchable) return;

    const controller = new AbortController();
    const timer = setTimeout(() => {
      fetch(`/api/search?q=${encodeURIComponent(query)}`, {
        signal: controller.signal,
      })
        .then((response) => (response.ok ? response.json() : { hits: [] }))
        .then((data: { hits: SearchHit[] }) => setResult({ query, hits: data.hits }))
        .catch(() => undefined);
    }, DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, searchable]);

  const hits = result?.query === query ? result.hits : null;
  const loading = searchable && hits === null;

  return (
    <div className="flex flex-1 flex-col gap-7">
      <div>
        <label htmlFor="query" className="eyebrow text-on-surface/45">
          {t.searchTitle}
        </label>
        <div className="relative mt-3">
          <SearchIcon className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-on-surface/35" />
          <input
            id="query"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            type="text"
            autoComplete="off"
            autoFocus
            placeholder={t.searchPlaceholder}
            aria-describedby="query-hint"
            className="field pl-12 text-[1.375rem] font-semibold"
          />
        </div>
        <p id="query-hint" className="mt-2.5 text-[0.875rem] text-on-surface/40">
          {t.searchHint}
        </p>
      </div>

      {loading ? <p className="eyebrow text-on-surface/35">···</p> : null}

      {hits && hits.length === 0 ? (
        <p className="text-[1rem] font-medium text-on-surface/55">{t.searchEmpty}</p>
      ) : null}

      <ul className="stagger flex flex-col gap-2.5">
        {(hits ?? []).map((hit) => (
          <li key={hit.id}>
            <Link
              href={`/s/cliente/${hit.id}`}
              prefetch={false}
              className={cn(
                "btn w-full justify-between rounded-[var(--radius-card)] px-5 py-4 text-left",
                hit.rewardPending ? "bg-amber text-ink" : "bg-surface-2 text-on-surface",
              )}
            >
              <span className="min-w-0">
                <span className="block truncate text-[1.0625rem] font-semibold">
                  {hit.name}
                </span>
                <span
                  className={cn(
                    "numeral text-[0.8125rem] font-normal",
                    hit.rewardPending ? "text-ink/55" : "text-on-surface/45",
                  )}
                >
                  ··{hit.last4}
                </span>
              </span>
              <span className="numeral shrink-0 text-[1.0625rem] font-semibold">
                {hit.stamps}/{hit.goal}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
