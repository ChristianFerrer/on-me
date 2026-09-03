"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { OfflineBadge } from "@/components/client/OfflineBadge";
import { OracleReveal } from "@/components/client/OracleReveal";
import { CoffeeIcon, GiftIcon } from "@/components/ui/Icons";
import { Slab } from "@/components/ui/Screen";
import { StampCard } from "@/components/ui/StampCard";
import { fill } from "@/lib/i18n";

/** Cada cuánto se sondea mientras la pantalla está visible. */
const POLL_INTERVAL_MS = 8000;

type Status = {
  stamps: number;
  rewardPending: boolean;
  cardsCompleted: number;
  inviteCount: number;
  returnedGuests: number;
};

/**
 * Todo lo que puede moverse solo en `/c` mientras el cliente la tiene
 * abierta -sellos, premio, cafés gratis, invitaciones, invitado que
 * volvió-, en un único componente cliente que sondea `/api/card/status`.
 *
 * Sondeo, no Realtime de Supabase -ver el comentario en esa ruta para el
 * porqué-. Se pausa solo mientras la pestaña está oculta -`visibilitychange`,
 * no un simple `setInterval` ciego- y refresca al instante al volver a
 * mirarla, que es el momento real en que algo pudo haber cambiado.
 */
export function CardLive({
  customerId,
  shopName,
  goal,
  bonusStamps,
  initial,
  labels,
}: {
  customerId: string;
  shopName: string;
  goal: number;
  bonusStamps: number;
  initial: Status;
  labels: {
    offline: string;
    oneToGo: string;
    nToGo: string;
    rewardTitle: string;
    rewardBody: string;
    freeCoffees: string;
    inviteRowLabel: string;
    guestReturned: string;
    guestReturnedBody: string;
    oracleCta: string;
    oracleUsedHint: string;
    oracleMessages: string[];
  };
}) {
  const [status, setStatus] = useState<Status>(initial);

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      try {
        const response = await fetch("/api/card/status", { cache: "no-store" });
        if (!response.ok) return;
        const data = (await response.json()) as Status;
        if (!cancelled) setStatus(data);
      } catch {
        // Sin conexión: se reintenta en el siguiente ciclo. OfflineBadge ya
        // avisa por su cuenta, no hace falta duplicar el aviso aquí.
      }
    }

    function onTick() {
      if (document.visibilityState === "visible") void poll();
    }

    void poll();
    const timer = window.setInterval(onTick, POLL_INTERVAL_MS);
    document.addEventListener("visibilitychange", onTick);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onTick);
    };
  }, []);

  const { stamps, rewardPending, cardsCompleted, inviteCount, returnedGuests } = status;
  const remaining = goal - stamps;

  return (
    <div className="stagger flex flex-col gap-3">
      <Slab className="p-5">
        <div className="flex items-start justify-between gap-3">
          <p className="eyebrow text-chalk/65">{shopName}</p>
          <OfflineBadge label={labels.offline} />
        </div>

        {rewardPending ? (
          <>
            <h1 className="display-tight mt-3 text-[clamp(2rem,10vw,2.5rem)] text-lime">
              {labels.rewardTitle}
            </h1>
            <p className="mt-3 text-[0.9375rem] leading-relaxed text-chalk/70">{labels.rewardBody}</p>
          </>
        ) : (
          <>
            {/* Sin el numeral grande -"N/goal"-: las propias esferas, más
                grandes ahora, ya dicen cuántas llevas sin obligar a leer un
                número aparte. Esta línea se queda porque no es un recuento,
                es ánimo -"te quedan 3"-, y eso las esferas no lo dicen. */}
            <p className="mt-1 text-[0.9375rem] font-medium text-chalk/80">
              {remaining === 1 ? labels.oneToGo : fill(labels.nToGo, { n: remaining })}
            </p>
            <StampCard stamps={stamps} goal={goal} tone="dark" className="mt-2.5" />
          </>
        )}
      </Slab>

      <OracleReveal
        customerId={customerId}
        stamps={stamps}
        messages={labels.oracleMessages}
        ctaLabel={labels.oracleCta}
        usedHint={labels.oracleUsedHint}
      />

      {/* Una sola fila, no dos apiladas -mismo trato visual de siempre, solo
          la mitad de alto-: en una pantalla que ya tiene que caber entera,
          esa segunda fila era el ítem más fácil de fundir sin perder nada. */}
      <div className="grid grid-cols-2 gap-2.5">
        <div className="glass-dark flex items-center gap-2 rounded-2xl px-3.5 py-2.5">
          <CoffeeIcon className="size-4 shrink-0 text-lime" />
          <span className="min-w-0 flex-1 truncate text-[0.8125rem] font-medium">{labels.freeCoffees}</span>
          <span className="numeral shrink-0 text-[0.9375rem] font-bold">{cardsCompleted}</span>
        </div>
        <Link
          href="/c/invitar"
          prefetch={false}
          className="glass-dark flex items-center gap-2 rounded-2xl px-3.5 py-2.5 transition-[filter] hover:brightness-125"
        >
          <GiftIcon className="size-4 shrink-0 text-lime" />
          <span className="min-w-0 flex-1 truncate text-[0.8125rem] font-medium">{labels.inviteRowLabel}</span>
          <span className="numeral shrink-0 text-[0.9375rem] font-bold">{inviteCount}</span>
        </Link>
      </div>

      {returnedGuests > 0 ? (
        <section className="rounded-[var(--radius-card)] bg-lime p-4">
          <p className="eyebrow text-ink/50">{labels.guestReturned}</p>
          <p className="mt-1.5 text-[0.9375rem] font-semibold leading-snug">
            {fill(labels.guestReturnedBody, { n: bonusStamps })}
          </p>
        </section>
      ) : null}
    </div>
  );
}
