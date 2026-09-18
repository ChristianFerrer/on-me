"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { CoffeeIcon, HomeIcon, QrIcon, SearchIcon } from "@/components/ui/Icons";
import { cn } from "@/lib/cn";
import { fill, type Dict } from "@/lib/i18n";
import { PinPad } from "./PinPad";
import { useQrScanner } from "./useQrScanner";
import { useScanFlow } from "./useScanFlow";
import { Verdict } from "./Verdict";

type BaristaDict = Dict["barista"];

/** Cuántos cafés de una vez se pueden pedir desde el selector, sin desplazarse. */
const QUANTITIES = [1, 2, 3, 4, 5];

export function Scanner({
  t,
  shopName,
  shopSlug,
  deviceName,
  pinRequired,
}: {
  t: BaristaDict;
  shopName: string;
  shopSlug: string;
  deviceName: string;
  pinRequired: boolean;
}) {
  const [online, setOnline] = useState(true);

  /**
   * Cafés a sellar en el próximo escaneo. Empieza sin elegir -`null`, la
   * taza del selector es lo que se ve resaltado- a propósito: el escáner
   * no decodifica nada hasta que el barista dice cuántos cafés está
   * cobrando, así que no hay sello por accidente antes de saberlo. Vuelve
   * a `null` en cuanto se cierra el veredicto -cada cliente obliga a
   * elegir de nuevo, no hay "recordar" cantidad de un cliente a otro-.
   */
  const [quantity, setQuantity] = useState<number | null>(null);

  /**
   * Instante en que la barra queda lista para el siguiente cliente. La
   * distancia entre esto y el resultado en pantalla es el número que decide
   * si el piloto es viable, así que se mide de verdad y se guarda en `scans`.
   */
  const readyAtRef = useRef<number>(0);
  const markReady = useCallback(() => {
    readyAtRef.current = Date.now();
  }, []);

  /** Como markReady, pero también para el mostrador: cada cliente nuevo vuelve a pedir cantidad. */
  const resetForNextCustomer = useCallback(() => {
    markReady();
    setQuantity(null);
  }, [markReady]);

  const { phase, submit, confirm, reset } = useScanFlow({
    endpoint: "/api/scan",
    pinRequired,
    onReset: resetForNextCustomer,
  });

  useEffect(() => {
    markReady();
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, [markReady]);

  const quantityChosen = quantity !== null;

  const { videoRef, status, retry } = useQrScanner({
    enabled: phase.step === "idle" && online && quantityChosen,
    onDecode: (token) =>
      void submit({ token, durationMs: Date.now() - readyAtRef.current, quantity: quantity ?? 1 }),
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
            {/* Para dar de alta a alguien sin escanear su móvil directamente:
                el barista enseña este código en la pantalla del dispositivo. */}
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
          </div>
        </header>

        {phase.step === "idle" ? (
          <div className="flex justify-center px-4 pt-2">
            <div
              role="group"
              aria-label={t.quantityLabel}
              className="glass-dark flex items-center gap-0.5 rounded-full p-1.5 text-chalk"
            >
              <span
                aria-hidden
                className={cn(
                  "flex size-8 shrink-0 items-center justify-center rounded-full transition-colors",
                  quantityChosen ? "text-chalk/45" : "anim-dot-pulse bg-lime text-ink",
                )}
              >
                <CoffeeIcon className="size-4" />
              </span>
              {QUANTITIES.map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setQuantity(n)}
                  aria-pressed={quantity === n}
                  aria-label={fill(t.quantityOption, { n })}
                  className={cn(
                    "numeral flex size-8 items-center justify-center rounded-full text-[0.875rem] font-bold transition-colors",
                    quantity === n ? "bg-lime text-ink" : "text-chalk/55 hover:text-chalk",
                  )}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <div className="flex flex-1 items-center justify-center px-10">
          <Target active={phase.step === "idle" && !blocked && quantityChosen} />
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
              {phase.step === "sending"
                ? t.checking
                : status === "booting"
                  ? t.opening
                  : !quantityChosen
                    ? t.quantityPrompt
                    : t.scanning}
            </p>
          )}
        </footer>
      </div>

      {phase.step === "result" ? (
        <Verdict
          result={phase.result}
          t={t}
          onClose={reset}
          onConfirm={() => void confirm()}
        />
      ) : null}

      {phase.step === "pin" ? (
        <PinPad
          t={t}
          wrong={phase.wrong}
          busy={phase.busy}
          onSubmit={(pin) => void confirm(pin)}
          onCancel={reset}
        />
      ) : null}
    </div>
  );
}

/** Mirilla: cuatro esquinas finas. Sin ella nadie sabe dónde poner el móvil. */
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
