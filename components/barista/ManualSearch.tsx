"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { SearchHit } from "@/app/api/search/route";
import { PhoneIcon } from "@/components/ui/Icons";
import { cn } from "@/lib/cn";
import type { Dict } from "@/lib/i18n";

type BaristaDict = Dict["barista"];

/** Tras esta pausa sin teclear se lanza la búsqueda: ni de letra en letra ni al salir del campo. */
const DEBOUNCE_MS = 400;
/** Menos dígitos que esto no es un móvil real todavía; no vale la pena preguntarle a Supabase. */
const MIN_DIGITS = 6;

/**
 * Plan B de la barra: el cliente se dejó el móvil, la pantalla está rota o
 * no hay luz para la cámara. Se busca por el móvil completo —el mismo que
 * se normaliza y se hashea en el alta— para encontrar exactamente a esa
 * persona, no a cualquiera que comparta los últimos cuatro dígitos.
 *
 * Si esta vía supera el 15% de los sellos, el escáner no funciona y eso es
 * lo primero que hay que arreglar — el panel lo vigila.
 */
export function ManualSearch({ t }: { t: BaristaDict }) {
  const [phone, setPhone] = useState("");
  /**
   * El resultado se guarda junto a la búsqueda que lo produjo, así se
   * descarta solo al teclear: no hace falta limpiarlo desde el efecto ni
   * mantener un indicador de carga aparte.
   */
  const [result, setResult] = useState<{ query: string; hits: SearchHit[] } | null>(
    null,
  );

  const digits = phone.replace(/\D/g, "").length;

  useEffect(() => {
    if (digits < MIN_DIGITS) return;

    const controller = new AbortController();
    const timer = setTimeout(() => {
      fetch(`/api/search?phone=${encodeURIComponent(phone)}`, {
        signal: controller.signal,
      })
        .then((response) => (response.ok ? response.json() : { hits: [] }))
        .then((data: { hits: SearchHit[] }) => setResult({ query: phone, hits: data.hits }))
        .catch(() => undefined);
    }, DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [phone, digits]);

  const hits = result?.query === phone ? result.hits : null;
  const loading = digits >= MIN_DIGITS && hits === null;

  return (
    <div className="flex flex-1 flex-col gap-7">
      <div>
        <label htmlFor="phone" className="eyebrow text-chalk/45">
          {t.searchTitle}
        </label>
        <div className="relative mt-3">
          <PhoneIcon className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-chalk/35" />
          <input
            id="phone"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            type="tel"
            inputMode="tel"
            autoComplete="off"
            autoFocus
            placeholder={t.searchPlaceholder}
            aria-describedby="phone-hint"
            className="numeral field pl-12 text-[1.375rem] font-semibold"
          />
        </div>
        <p id="phone-hint" className="mt-2.5 text-[0.875rem] text-chalk/40">
          {t.searchHint}
        </p>
      </div>

      {loading ? <p className="eyebrow text-chalk/35">···</p> : null}

      {hits && hits.length === 0 ? (
        <p className="text-[1rem] font-medium text-chalk/55">{t.searchEmpty}</p>
      ) : null}

      <ul className="stagger flex flex-col gap-2.5">
        {(hits ?? []).map((hit) => (
          <li key={hit.id}>
            <Link
              href={`/s/cliente/${hit.id}`}
              prefetch={false}
              className={cn(
                "btn w-full justify-between rounded-[var(--radius-card)] px-5 py-4 text-left",
                hit.rewardPending ? "bg-amber text-ink" : "bg-ink-2 text-chalk",
              )}
            >
              <span className="min-w-0">
                <span className="block truncate text-[1.0625rem] font-semibold">
                  {hit.name}
                </span>
                <span
                  className={cn(
                    "numeral text-[0.8125rem] font-normal",
                    hit.rewardPending ? "text-ink/55" : "text-chalk/45",
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
