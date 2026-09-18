"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { HomeIcon, QrIcon, ScanIcon, SearchIcon } from "@/components/ui/Icons";
import { cn } from "@/lib/cn";
import type { Dict } from "@/lib/i18n";
import { CustomerProfilePanel } from "./CustomerProfilePanel";
import { IdentifyResult } from "./IdentifyResult";
import { PinPad } from "./PinPad";
import { useIdentifyFlow } from "./useIdentifyFlow";
import { useQrScanner } from "./useQrScanner";

type BaristaDict = Dict["barista"];

/**
 * Cámara del flujo identificador: escanear solo resuelve quién es -no
 * sella ni canjea nada-, y el perfil que aparece después es donde el
 * barista decide. Mismo cascarón que Scanner.tsx a propósito -misma
 * cabecera, mismo target-, pero es su propio componente: nada de lo de
 * aquí toca al flujo clásico.
 */
export function IdentifyScanner({
  t,
  shopName,
  shopSlug,
  deviceName,
  pinRequired,
  onSwitchMode,
}: {
  t: BaristaDict;
  shopName: string;
  shopSlug: string;
  deviceName: string;
  pinRequired: boolean;
  onSwitchMode: () => void;
}) {
  const [online, setOnline] = useState(true);
  const { phase, identify, apply, confirmPin, reset } = useIdentifyFlow(pinRequired);

  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  const { videoRef, status, retry } = useQrScanner({
    enabled: phase.step === "scanning" && online,
    onDecode: (token) => void identify(token),
  });

  const blocked = !online || status === "no_camera";

  return (
    <div className="fixed inset-0 overflow-hidden aurora-night text-chalk">
      <video
        ref={videoRef}
        playsInline
        muted
        autoPlay
        className={cn(
          "absolute inset-0 size-full object-cover transition-opacity duration-500",
          status === "ready" && !blocked ? "opacity-100" : "opacity-0",
        )}
      />

      <div className="absolute inset-0 flex flex-col">
        <header className="flex items-start justify-between gap-3 px-4 pt-[max(1rem,env(safe-area-inset-top))]">
          <div className="glass-dark min-w-0 px-4 py-2.5">
            <p className="truncate text-[0.9375rem] font-semibold leading-tight">{shopName}</p>
            <p className="eyebrow mt-0.5 truncate text-chalk/45">{deviceName}</p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/inicio"
              prefetch={false}
              aria-label={t.home}
              className="btn glass-dark size-11 rounded-full text-chalk"
            >
              <HomeIcon className="size-5" />
            </Link>
            <Link
              href={`/j/${shopSlug}/qr?from=/s`}
              prefetch={false}
              aria-label={t.signupQr}
              className="btn glass-dark size-11 rounded-full text-chalk"
            >
              <QrIcon className="size-5" />
            </Link>
            <Link
              href="/s/buscar"
              prefetch={false}
              className="btn glass-dark items-center gap-2 rounded-full px-5 py-3 text-[0.875rem] text-chalk"
            >
              <SearchIcon className="size-4" />
              {t.search}
            </Link>
            <button
              type="button"
              onClick={onSwitchMode}
              aria-label={t.switchToQuickMode}
              title={t.switchToQuickMode}
              className="btn glass-dark size-11 rounded-full text-lime"
            >
              <ScanIcon className="size-5" />
            </button>
          </div>
        </header>

        <div className="flex flex-1 items-center justify-center px-10">
          <Target active={phase.step === "scanning" && !blocked} />
        </div>

        <footer className="px-5 pb-[max(1.75rem,env(safe-area-inset-bottom))]">
          {blocked ? (
            <div className="glass-dark px-5 py-4 text-center">
              <p className="text-[1rem] font-semibold text-coral">
                {!online ? t.offline : t.noCamera}
              </p>
              <p className="mt-1 text-[0.875rem] text-chalk/60">
                {!online ? t.offlineBody : t.noCameraBody}
              </p>
              {status === "no_camera" ? (
                <button
                  type="button"
                  onClick={retry}
                  className="btn mt-3 rounded-full bg-chalk px-5 py-2.5 text-[0.875rem] font-semibold text-ink"
                >
                  {t.retryCamera}
                </button>
              ) : null}
            </div>
          ) : (
            <p className="text-center text-[0.9375rem] font-medium text-chalk/70">
              {phase.step === "identifying"
                ? t.checking
                : status === "booting"
                  ? t.opening
                  : t.identifyScanning}
            </p>
          )}
        </footer>
      </div>

      {phase.step === "profile" || phase.step === "applying" ? (
        <CustomerProfilePanel
          t={t}
          profile={phase.profile}
          busy={phase.step === "applying"}
          onCancel={reset}
          onConfirm={(addStamps, redeemCount) => apply(phase.profile, addStamps, redeemCount)}
        />
      ) : null}

      {phase.step === "pin" ? (
        <PinPad
          t={t}
          wrong={phase.wrong}
          busy={phase.busy}
          onSubmit={(pin) => void confirmPin(pin)}
          onCancel={reset}
        />
      ) : null}

      {phase.step === "result" ? (
        <IdentifyResult result={phase.result} t={t} onClose={reset} />
      ) : null}
    </div>
  );
}

/** Mirilla: cuatro esquinas finas. Copia deliberada de la de Scanner.tsx -no compartida-, ver la nota del componente. */
function Target({ active }: { active: boolean }) {
  return (
    <div
      className={cn(
        "relative aspect-square w-full max-w-[min(16rem,40vh)] transition-opacity duration-300",
        active ? "opacity-100" : "opacity-25",
      )}
    >
      {[
        "left-0 top-0 border-l-2 border-t-2 rounded-tl-3xl",
        "right-0 top-0 border-r-2 border-t-2 rounded-tr-3xl",
        "left-0 bottom-0 border-b-2 border-l-2 rounded-bl-3xl",
        "right-0 bottom-0 border-b-2 border-r-2 rounded-br-3xl",
      ].map((corner) => (
        <span key={corner} className={cn("absolute size-10 border-lime", corner)} />
      ))}
      {active ? (
        <span className="anim-scanline absolute inset-x-4 h-px bg-lime" />
      ) : null}
    </div>
  );
}
