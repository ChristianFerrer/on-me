"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import type { Dict, Locale } from "@/lib/i18n";
import { CustomerProfilePanel } from "./CustomerProfilePanel";
import { IdentifyResult } from "./IdentifyResult";
import { PinPad } from "./PinPad";
import { useIdentifyFlow, type IdentifyProfile } from "./useIdentifyFlow";

type BaristaDict = Dict["barista"];

/**
 * Ficha de un cliente ya conocido -llegado desde /s/buscar, no desde la
 * cámara-: arranca directamente en la fase "profile" del propio flujo
 * identificador -mismo panel, mismo canje, mismo resumen de cierre-, así
 * que editar su nombre/teléfono vive aquí y no solo cuando se escanea su
 * QR. No hay cámara a la que volver: al llegar a "scanning" -tras cancelar
 * o tras cerrar el resumen- se vuelve a la búsqueda.
 */
export function CustomerVisit({
  t,
  locale,
  shopName,
  initialProfile,
  pinRequired,
  backHref,
}: {
  t: BaristaDict;
  locale: Locale;
  shopName: string;
  initialProfile: IdentifyProfile;
  pinRequired: boolean;
  backHref: string;
}) {
  const router = useRouter();
  const { phase, apply, confirmPin, updateProfile, reset } = useIdentifyFlow(pinRequired, initialProfile);

  useEffect(() => {
    if (phase.step === "scanning") router.replace(backHref);
  }, [phase.step, router, backHref]);

  if (phase.step === "pin") {
    return (
      <PinPad
        t={t}
        wrong={phase.wrong}
        busy={phase.busy}
        onSubmit={(pin) => void confirmPin(pin)}
        onCancel={reset}
      />
    );
  }

  if (phase.step === "result") {
    return <IdentifyResult result={phase.result} t={t} locale={locale} shopName={shopName} onClose={reset} />;
  }

  if (phase.step === "profile" || phase.step === "applying") {
    return (
      <CustomerProfilePanel
        t={t}
        locale={locale}
        profile={phase.profile}
        busy={phase.step === "applying"}
        onCancel={() => router.replace(backHref)}
        onConfirm={(addStamps, redeemCount) => apply(phase.profile, addStamps, redeemCount)}
        onUpdateProfile={(name, phone) => updateProfile(phase.profile.customerId, name, phone)}
      />
    );
  }

  // "scanning"/"identifying": transitorio, el efecto de arriba ya está
  // redirigiendo de vuelta a la búsqueda.
  return null;
}
