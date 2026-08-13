"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import type { Dict } from "@/lib/i18n";
import { PinPad } from "./PinPad";
import { useQrScanner } from "./useQrScanner";
import { useScanFlow } from "./useScanFlow";
import { Verdict } from "./Verdict";

type BaristaDict = Dict["barista"];

export function Scanner({
  t,
  shopName,
  deviceName,
  pinRequired,
}: {
  t: BaristaDict;
  shopName: string;
  deviceName: string;
  pinRequired: boolean;
}) {
  const [online, setOnline] = useState(true);

  /**
   * Instante en que la barra queda lista para el siguiente cliente. La
   * distancia entre esto y el resultado en pantalla es el número que decide
   * si el piloto es viable, así que se mide de verdad y se guarda en `scans`.
   */
  const readyAtRef = useRef<number>(0);
  const markReady = useCallback(() => {
    readyAtRef.current = Date.now();
  }, []);

  const { phase, submit, confirm, reset } = useScanFlow({
    endpoint: "/api/scan",
    pinRequired,
    onReset: markReady,
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

  const { videoRef, status } = useQrScanner({
    enabled: phase.step === "idle" && online,
    onDecode: (token) =>
      void submit({ token, durationMs: Date.now() - readyAtRef.current }),
  });

  const blocked = !online || status === "no_camera";

  return (
    <div className="fixed inset-0 overflow-hidden bg-ink text-paper">
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
        <header className="flex items-start justify-between gap-3 px-5 pt-[max(1rem,env(safe-area-inset-top))]">
          <div className="rounded-2xl bg-ink/70 px-3.5 py-2 backdrop-blur-sm">
            <p className="text-[0.95rem] font-semibold leading-tight">{shopName}</p>
            <p className="overline text-paper/60">{deviceName}</p>
          </div>
          <Link
            href="/s/buscar"
            prefetch={false}
            className="overline riso-sm rounded-full border-2 border-ink bg-paper px-4 py-2.5 text-ink"
          >
            {t.search}
          </Link>
        </header>

        <div className="flex flex-1 items-center justify-center px-8">
          <Target active={phase.step === "idle" && !blocked} />
        </div>

        <footer className="px-6 pb-[max(1.75rem,env(safe-area-inset-bottom))] text-center">
          {blocked ? (
            <div className="riso rounded-2xl border-2 border-ink bg-tomato px-5 py-4">
              <p className="text-[1.05rem] font-bold">
                {!online ? t.offline : t.noCamera}
              </p>
              <p className="mt-1 text-[0.9rem] opacity-90">
                {!online ? t.offlineBody : t.noCameraBody}
              </p>
            </div>
          ) : (
            <p className="text-[1.05rem] font-semibold text-paper/85 drop-shadow-[0_1px_6px_rgba(0,0,0,0.7)]">
              {status === "booting" ? t.opening : t.scanning}
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

/** Mirilla. Sin ella la gente no sabe dónde poner el móvil del cliente. */
function Target({ active }: { active: boolean }) {
  return (
    <div
      className={cn(
        "relative aspect-square w-full max-w-[17rem] transition-opacity duration-300",
        active ? "opacity-100" : "opacity-30",
      )}
    >
      {[
        "left-0 top-0 border-l-4 border-t-4 rounded-tl-2xl",
        "right-0 top-0 border-r-4 border-t-4 rounded-tr-2xl",
        "left-0 bottom-0 border-b-4 border-l-4 rounded-bl-2xl",
        "right-0 bottom-0 border-b-4 border-r-4 rounded-br-2xl",
      ].map((corner) => (
        <span
          key={corner}
          className={cn("absolute size-12 border-saffron", corner)}
        />
      ))}
      {active ? (
        <span className="anim-scanline absolute inset-x-3 h-0.5 rounded-full bg-saffron shadow-[0_0_14px_var(--color-saffron)]" />
      ) : null}
    </div>
  );
}
