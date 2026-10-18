"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Slab } from "@/components/ui/Screen";
import { fill, type Dict } from "@/lib/i18n";

type CheckInDict = Dict["checkin"];

/** Cada cuánto pregunta si ya le han atendido. Lo mismo que tarda un barista en tocar. */
const POLL_MS = 3_000;

type Phase =
  | { step: "sending" }
  | { step: "waiting"; arrivalId: string }
  | { step: "expired" }
  | { step: "error"; rate: boolean };

/**
 * Pantalla de quien ya tiene tarjeta y escanea el QR fijo de barra: en vez
 * del alta, avisa a la barra -ver lib/arrivals.ts- y espera a que el
 * barista le atienda. Cuando lo hace, salta sola a la tarjeta, que ya trae
 * el sello nuevo.
 *
 * El aviso se manda con POST al montar, nunca desde el propio GET de la
 * página: las vistas previas de enlaces y el prefetch harían check-in solos.
 */
export function CheckIn({
  shop,
  name,
  t,
  joinHref,
}: {
  shop: string;
  name: string;
  t: CheckInDict;
  /** Alta de otra persona desde este mismo móvil. */
  joinHref: string;
}) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>({ step: "sending" });
  const sentRef = useRef(false);

  const arrive = useCallback(async () => {
    setPhase({ step: "sending" });
    try {
      const response = await fetch("/api/arrive", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ shop }),
      });

      if (!response.ok) {
        setPhase({ step: "error", rate: response.status === 429 });
        return;
      }

      const data = (await response.json()) as { arrivalId: string };
      setPhase({ step: "waiting", arrivalId: data.arrivalId });
    } catch {
      setPhase({ step: "error", rate: false });
    }
  }, [shop]);

  useEffect(() => {
    // Una sola vez aunque React monte dos veces en desarrollo. Si se
    // colara un segundo aviso tampoco pasaría nada: el servidor lo alarga.
    if (sentRef.current) return;
    sentRef.current = true;
    void arrive();
  }, [arrive]);

  const arrivalId = phase.step === "waiting" ? phase.arrivalId : null;

  useEffect(() => {
    if (!arrivalId) return;

    let stopped = false;
    const timer = window.setInterval(async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const response = await fetch(`/api/arrive?id=${arrivalId}`, { cache: "no-store" });
        if (!response.ok || stopped) return;
        const { status } = (await response.json()) as { status: string };
        if (status === "handled") {
          stopped = true;
          router.replace("/c");
        } else if (status === "expired") {
          stopped = true;
          setPhase({ step: "expired" });
        }
      } catch {
        // Sin red un momento: el siguiente intento lo vuelve a preguntar.
      }
    }, POLL_MS);

    return () => {
      stopped = true;
      window.clearInterval(timer);
    };
  }, [arrivalId, router]);

  return (
    <div className="flex flex-col gap-4">
      <Slab className="p-7 text-center">
        {phase.step === "sending" ? (
          <p className="text-[1rem] font-medium text-chalk/70">{t.sending}</p>
        ) : phase.step === "waiting" ? (
          <>
            <p className="eyebrow text-lime">{t.eyebrow}</p>
            <h1 className="display mt-3 text-[1.875rem]">{fill(t.title, { name })}</h1>
            <p className="mx-auto mt-3 max-w-[30ch] text-[0.9375rem] leading-relaxed text-chalk/70">
              {t.body}
            </p>
            <span aria-hidden className="anim-dot-pulse mx-auto mt-6 block size-3 rounded-full bg-lime" />
          </>
        ) : phase.step === "expired" ? (
          <>
            <h1 className="display text-[1.75rem]">{t.expiredTitle}</h1>
            <p className="mt-3 text-[0.9375rem] leading-relaxed text-chalk/70">{t.expiredBody}</p>
            <Button tone="lime" size="md" className="mt-6" onClick={() => void arrive()}>
              {t.retry}
            </Button>
          </>
        ) : (
          <>
            <p className="text-[1rem] font-semibold text-coral">{phase.rate ? t.rate : t.error}</p>
            {phase.rate ? null : (
              <Button tone="lime" size="md" className="mt-6" onClick={() => void arrive()}>
                {t.retry}
              </Button>
            )}
          </>
        )}
      </Slab>

      <ButtonLink href="/c" tone="ink" size="md" block>
        {t.seeCard}
      </ButtonLink>

      <a
        href={joinHref}
        className="text-center text-[0.8125rem] text-ink/50 underline underline-offset-2"
      >
        {fill(t.notMe, { name })}
      </a>
    </div>
  );
}
