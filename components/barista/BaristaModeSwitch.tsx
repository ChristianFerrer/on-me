"use client";

import { useEffect, useState } from "react";
import type { Dict, Locale } from "@/lib/i18n";
import { IdentifyScanner } from "./IdentifyScanner";
import { Scanner } from "./Scanner";

type BaristaDict = Dict["barista"];

type BaristaMode = "quick" | "identify";
const STORAGE_KEY = "onme_barista_mode";

/**
 * Elige entre el escáner clásico -sellador- y el identificador, por
 * dispositivo -localStorage, no por cliente ni por sesión-: es lo que
 * permite probar el flujo nuevo en la barra real sin tocar el de siempre
 * en el resto de dispositivos.
 *
 * Por defecto "quick": el primer pintado siempre es el flujo clásico, sin
 * depender de JS para acertar en el caso común -y sin arriesgar a nadie
 * que no haya elegido explícitamente el identificador-, y solo cambia tras
 * montar si este dispositivo ya lo había elegido antes.
 */
export function BaristaModeSwitch({
  t,
  locale,
  shopName,
  shopSlug,
  deviceName,
  pinRequired,
}: {
  t: BaristaDict;
  locale: Locale;
  shopName: string;
  shopSlug: string;
  deviceName: string;
  pinRequired: boolean;
}) {
  const [mode, setMode] = useState<BaristaMode>("quick");

  useEffect(() => {
    function readStoredMode() {
      try {
        if (window.localStorage.getItem(STORAGE_KEY) === "identify") {
          setMode("identify");
        }
      } catch {
        // Sin localStorage: se queda en "quick", que ya es el valor por defecto.
      }
    }

    readStoredMode();
  }, []);

  function switchMode() {
    setMode((prev) => {
      const next: BaristaMode = prev === "quick" ? "identify" : "quick";
      try {
        window.localStorage.setItem(STORAGE_KEY, next);
      } catch {
        // Cambia igual, solo no lo recuerda para la próxima.
      }
      return next;
    });
  }

  if (mode === "identify") {
    return (
      <IdentifyScanner
        t={t}
        locale={locale}
        shopName={shopName}
        shopSlug={shopSlug}
        deviceName={deviceName}
        pinRequired={pinRequired}
        onSwitchMode={switchMode}
      />
    );
  }

  return (
    <Scanner
      t={t}
      shopName={shopName}
      shopSlug={shopSlug}
      deviceName={deviceName}
      pinRequired={pinRequired}
      onSwitchMode={switchMode}
    />
  );
}
