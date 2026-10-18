"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CoffeeIcon, GiftIcon } from "@/components/ui/Icons";
import { fill, type Dict } from "@/lib/i18n";
import type { ArrivalItem } from "@/lib/arrivals";

type BaristaDict = Dict["barista"];

/** Cada cuánto pregunta la barra quién ha llegado. */
const POLL_MS = 3_000;

/**
 * Clientes que ya han escaneado el QR fijo de barra con su móvil -ver
 * lib/arrivals.ts-. El barista toca el nombre de quien tiene delante y se
 * abre su ficha: ni cámara, ni coger el móvil de nadie.
 *
 * Todos van a la misma ficha, invitados incluidos: es la que sella, canjea
 * cafés gratis y canjea invitaciones, con su PIN cuando toca.
 *
 * Vive en las dos cámaras -sellador e identificador- y se oculta mientras
 * la cámara enseña su propio resultado, para no tapar nada.
 */
export function ArrivalsTray({ t, hidden = false }: { t: BaristaDict; hidden?: boolean }) {
  const router = useRouter();
  const [arrivals, setArrivals] = useState<ArrivalItem[]>([]);
  const [now, setNow] = useState(() => Date.now());

  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/arrivals", { cache: "no-store" });
      if (!response.ok) return;
      const data = (await response.json()) as { arrivals: ArrivalItem[] };
      setArrivals(data.arrivals);
      setNow(Date.now());
    } catch {
      // Sin red: se queda la última lista y el siguiente sondeo lo reintenta.
    }
  }, []);

  useEffect(() => {
    // El primer sondeo va diferido como los demás: así ningún setState
    // ocurre dentro del propio efecto.
    const first = window.setTimeout(() => void refresh(), 0);
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, POLL_MS);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(timer);
    };
  }, [refresh]);

  function attend(arrival: ArrivalItem) {
    router.push(`/s/cliente/${arrival.customerId}?from=llegadas`);
  }

  if (hidden || arrivals.length === 0) return null;

  return (
    <section aria-label={t.arrivalsTitle} className="px-4 pb-3">
      <p className="eyebrow mb-2 px-1 text-on-surface/55">
        {t.arrivalsTitle} · {arrivals.length}
      </p>
      <ul className="flex gap-2 overflow-x-auto pb-1">
        {arrivals.map((arrival) => (
          <li key={arrival.id} className="shrink-0">
            <button
              type="button"
              onClick={() => attend(arrival)}
              aria-label={fill(t.arrivalsAttend, { name: arrival.name })}
              className="btn glass-dark flex min-h-16 flex-col items-start gap-1 rounded-2xl px-4 py-3 text-left text-on-surface"
            >
              <span className="flex items-baseline gap-2">
                <span className="text-[1.0625rem] font-bold leading-tight">{arrival.name}</span>
                <span className="numeral text-[0.8125rem] text-on-surface/50">·{arrival.phoneLast4}</span>
              </span>
              <span className="flex items-center gap-2 text-[0.75rem] font-semibold">
                <Badge arrival={arrival} t={t} />
                <span className="text-on-surface/45">{ago(arrival.createdAt, now, t)}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Lo que el barista tiene que saber antes de tocar: el color hace el trabajo. */
function Badge({ arrival, t }: { arrival: ArrivalItem; t: BaristaDict }) {
  if (arrival.invited) {
    return (
      <span className="flex items-center gap-1 rounded-full bg-azure px-2 py-0.5 text-ink">
        <GiftIcon className="size-3" />
        {t.arrivalsInvited}
      </span>
    );
  }
  if (arrival.rewardsPending > 0) {
    return (
      <span className="flex items-center gap-1 rounded-full bg-amber px-2 py-0.5 text-ink">
        <CoffeeIcon className="size-3" />
        {t.arrivalsFreeCoffee}
      </span>
    );
  }
  if (arrival.isNew) {
    return <span className="rounded-full bg-lime px-2 py-0.5 text-ink">{t.arrivalsNew}</span>;
  }
  return (
    <span className="numeral text-on-surface/70">
      {arrival.stamps}/{arrival.goal}
    </span>
  );
}

function ago(createdAt: string, now: number, t: BaristaDict): string {
  const seconds = Math.max(0, Math.round((now - Date.parse(createdAt)) / 1000));
  return seconds < 60
    ? fill(t.arrivalsSeconds, { n: seconds })
    : fill(t.arrivalsMinutes, { n: Math.floor(seconds / 60) });
}
