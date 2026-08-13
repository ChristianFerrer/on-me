"use client";

import { useEffect, useState } from "react";

/**
 * Aviso de que no hay cobertura. La tarjeta sigue sirviendo: el QR está
 * incrustado en el HTML, así que en un sótano de Gràcia se enseña igual.
 */
export function OfflineBadge({ label }: { label: string }) {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    const update = () => setOffline(!navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  if (!offline) return null;

  return (
    <p className="overline rounded-full border-2 border-ink bg-smoke px-3.5 py-2 text-center text-paper">
      {label}
    </p>
  );
}
