"use client";

import { useEffect, useState } from "react";
import { SparkleIcon } from "@/components/ui/Icons";
import { cn } from "@/lib/cn";

type StoredOracle = { stamps: number; message: string };

function storageKey(customerId: string): string {
  return `onme:oracle:${customerId}`;
}

/**
 * El oráculo del día -galleta de la suerte, no chiste por sello-: un sello
 * nuevo desbloquea una frase; tocar el botón la revela; hasta el próximo
 * sello, el botón queda deshabilitado con la frase ya vista al lado.
 *
 * El "ya abierto" vive en localStorage, indexado por sello -no por fecha-:
 * cuando `stamps` sube -por un sello nuevo, aunque llegue por el polling de
 * CardLive sin recargar la página- este componente lo nota solo y vuelve a
 * desbloquearse, sin que nadie tenga que decírselo explícitamente.
 */
export function OracleReveal({
  customerId,
  stamps,
  messages,
  ctaLabel,
  usedHint,
}: {
  customerId: string;
  stamps: number;
  messages: string[];
  ctaLabel: string;
  usedHint: string;
}) {
  const [opened, setOpened] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    // Igual que OfflineBadge: el propio efecto solo dispara la lectura, el
    // setState vive dentro de esta función -no como sentencia directa del
    // cuerpo del efecto-, para no encadenar renders sin control.
    function readStoredState() {
      let stored: StoredOracle | null = null;
      try {
        const raw = window.localStorage.getItem(storageKey(customerId));
        stored = raw ? JSON.parse(raw) : null;
      } catch {
        // Sin localStorage -modo privado, cuota llena-: el oráculo sigue
        // funcionando, solo que "olvida" el estado al recargar.
        stored = null;
      }

      if (cancelled) return;
      if (stored && stored.stamps === stamps) {
        setOpened(true);
        setMessage(stored.message);
      } else {
        setOpened(false);
        setMessage(null);
      }
    }

    readStoredState();
    return () => {
      cancelled = true;
    };
  }, [customerId, stamps]);

  if (stamps <= 0 || messages.length === 0) return null;

  function reveal() {
    if (opened) return;
    const picked = messages[Math.floor(Math.random() * messages.length)];
    setMessage(picked);
    setOpened(true);
    try {
      window.localStorage.setItem(
        storageKey(customerId),
        JSON.stringify({ stamps, message: picked } satisfies StoredOracle),
      );
    } catch {
      // Igual que arriba: no pasa nada si no se puede persistir.
    }
  }

  return (
    <div className="flex flex-col items-center gap-3 text-center">
      <button
        type="button"
        onClick={reveal}
        disabled={opened}
        aria-label={ctaLabel}
        className={cn(
          "flex items-center gap-2 rounded-full px-5 py-3 text-[0.9375rem] font-semibold transition-[transform,filter] active:scale-95",
          opened
            ? "cursor-default bg-white/6 text-chalk/35"
            : "anim-oracle-pulse bg-lime text-ink hover:brightness-110",
        )}
      >
        <SparkleIcon className="size-5" />
        {opened ? usedHint : ctaLabel}
      </button>

      {message ? (
        <p className="anim-flood max-w-[26rem] text-[1.0625rem] italic leading-snug text-chalk/80">
          “{message}”
        </p>
      ) : null}
    </div>
  );
}
