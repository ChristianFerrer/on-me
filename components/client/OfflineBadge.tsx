"use client";

import { useEffect, useRef, useState } from "react";

/** Cada cuánto se reconfirma que hay cobertura real, no solo adaptador activo. */
const PING_INTERVAL_MS = 20_000;
const PING_TIMEOUT_MS = 4_000;

/**
 * Aviso de que no hay cobertura. La tarjeta sigue sirviendo: el QR está
 * incrustado en el HTML, así que en un sótano de Gràcia se enseña igual.
 *
 * `navigator.onLine` -CLI-24- solo dice si el adaptador de red está activo,
 * no si hay cobertura de verdad: con wifi cautivo o señal débil real puede
 * decir "online" mientras cualquier petición real falla igual. Se completa
 * con un ping propio -HEAD al manifest, ya servido y minúsculo, sin ruta
 * nueva que mantener- cada vez que el navegador cree estar conectado.
 */
export function OfflineBadge({ label }: { label: string }) {
  const [offline, setOffline] = useState(false);
  const pingIdRef = useRef(0);

  useEffect(() => {
    let cancelled = false;

    async function ping() {
      const id = ++pingIdRef.current;
      if (!navigator.onLine) {
        if (!cancelled) setOffline(true);
        return;
      }

      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), PING_TIMEOUT_MS);
      try {
        await fetch("/manifest.webmanifest", {
          method: "HEAD",
          cache: "no-store",
          signal: controller.signal,
        });
        // Una respuesta más reciente ya pudo cambiar el estado: no pisarla.
        if (!cancelled && id === pingIdRef.current) setOffline(false);
      } catch {
        if (!cancelled && id === pingIdRef.current) setOffline(true);
      } finally {
        window.clearTimeout(timeout);
      }
    }

    void ping();
    const timer = window.setInterval(() => void ping(), PING_INTERVAL_MS);
    window.addEventListener("online", ping);
    window.addEventListener("offline", ping);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
      window.removeEventListener("online", ping);
      window.removeEventListener("offline", ping);
    };
  }, []);

  if (!offline) return null;

  return (
    <p className="eyebrow rounded-full bg-ink px-3.5 py-2 text-chalk">{label}</p>
  );
}
