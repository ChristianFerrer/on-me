"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { CoffeeIcon, HomeIcon, MenuIcon, QrIcon, SearchIcon, UserIcon } from "@/components/ui/Icons";
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
  onSwitchMode,
}: {
  t: BaristaDict;
  shopName: string;
  shopSlug: string;
  deviceName: string;
  pinRequired: boolean;
  /**
   * Botón para pasar al flujo identificador -ver BaristaModeSwitch.tsx-.
   * Opcional a propósito: este componente no depende de que exista ese
   * flujo, solo enseña el botón cuando alguien se lo pasa.
   */
  onSwitchMode?: () => void;
}) {
  const [online, setOnline] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Cerrar al tocar fuera o con Escape -mismo patrón que el menú de
  // configuración de BottomNav.tsx, el único otro menú flotante de la app-.
  useEffect(() => {
    if (!menuOpen) return;
    function onPointerDown(event: PointerEvent) {
      if (menuRef.current?.contains(event.target as Node)) return;
      setMenuOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setMenuOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [menuOpen]);

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
    <div className="fixed inset-0 overflow-hidden aurora-night text-on-surface">
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
            <p className="eyebrow mt-0.5 truncate text-on-surface/45">{deviceName}</p>
          </div>
          <div className="flex items-center gap-2">
            {/* Inicio, código de alta y cambiar de modo vivían sueltos acá,
                tres iconos más los de abajo: entre eso y la pastilla del
                local no entraban todos sin recortarse. Se agrupan en un
                menú -mismo patrón que el botón de configuración de
                BottomNav.tsx-, dejando "buscar" como único icono aparte,
                que es el que se usa a cada cliente, no una vez por turno. */}
            <div ref={menuRef} className="relative">
              <button
                type="button"
                onClick={() => setMenuOpen((v) => !v)}
                aria-expanded={menuOpen}
                aria-haspopup="menu"
                aria-label={t.menu}
                className="btn glass-dark size-11 rounded-full text-on-surface"
              >
                <MenuIcon className="size-5" />
              </button>
              {menuOpen ? (
                // `right-0`, no `left-0`: este botón vive cerca del borde
                // derecho de la cabecera -a la izquierda de "buscar"-, así
                // que anclar por la izquierda hacía que el menú se saliera
                // de la pantalla en vez de colgar hacia donde sí hay sitio.
                <div
                  role="menu"
                  className="glass-dark absolute right-0 top-full z-10 mt-2 flex w-56 flex-col gap-0.5 rounded-2xl p-1.5 shadow-[0_1rem_3rem_rgba(0,0,0,0.35)]"
                >
                  <Link
                    href="/inicio"
                    prefetch={false}
                    role="menuitem"
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-[0.8125rem] font-medium text-on-surface/80 transition-colors hover:bg-[rgba(var(--on-surface-rgb),.08)] hover:text-on-surface"
                  >
                    <HomeIcon className="size-4.5" />
                    {t.home}
                  </Link>
                  {/* Para dar de alta a alguien sin escanear su móvil
                      directamente: el barista enseña este código en la
                      pantalla del dispositivo. */}
                  <Link
                    href={`/j/${shopSlug}/qr?from=/s`}
                    prefetch={false}
                    role="menuitem"
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-[0.8125rem] font-medium text-on-surface/80 transition-colors hover:bg-[rgba(var(--on-surface-rgb),.08)] hover:text-on-surface"
                  >
                    <QrIcon className="size-4.5" />
                    {t.signupQr}
                  </Link>
                  {onSwitchMode ? (
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setMenuOpen(false);
                        onSwitchMode();
                      }}
                      className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[0.8125rem] font-medium text-on-surface/80 transition-colors hover:bg-[rgba(var(--on-surface-rgb),.08)] hover:text-on-surface"
                    >
                      <UserIcon className="size-4.5" />
                      {t.switchToIdentifyMode}
                    </button>
                  ) : null}
                </div>
              ) : null}
            </div>
            {/* Icono solo, no la pastilla con texto que tenía -"buscar"-: le
                quitaba tanto ancho a la fila que la pastilla del local, a la
                izquierda, se quedaba sin espacio y se cortaba a "The …". */}
            <Link
              href="/s/buscar"
              prefetch={false}
              aria-label={t.search}
              className="btn glass-dark size-11 rounded-full text-on-surface"
            >
              <SearchIcon className="size-5" />
            </Link>
          </div>
        </header>

        {phase.step === "idle" ? (
          <div className="flex justify-center px-4 pt-2">
            <div
              role="group"
              aria-label={t.quantityLabel}
              className="glass-dark flex items-center gap-0.5 rounded-full p-1.5 text-on-surface"
            >
              <span
                aria-hidden
                className={cn(
                  "flex size-8 shrink-0 items-center justify-center rounded-full transition-colors",
                  quantityChosen ? "text-on-surface/45" : "anim-dot-pulse bg-lime text-ink",
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
                    quantity === n ? "bg-lime text-ink" : "text-on-surface/55 hover:text-on-surface",
                  )}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <div className="flex flex-1 items-center justify-center px-10">
          {phase.step === "idle" && !blocked && !quantityChosen ? (
            // `glass-dark` -mismo material que la pastilla del local y la del
            // selector de arriba-, no texto suelto encima de la cámara: sin
            // nada detrás se perdía contra lo que estuviera enfocando en ese
            // momento, de ahí que se viera "casi transparente".
            <p className="glass-dark display-tight hyphens-auto break-words rounded-[2rem] px-8 py-7 text-center text-[clamp(1.5rem,7vw,2.75rem)] leading-[1.15] text-on-surface">
              {t.quantityPrompt}
            </p>
          ) : (
            <Target active={phase.step === "idle" && !blocked && quantityChosen} />
          )}
        </div>

        <footer className="px-5 pb-[max(1.75rem,env(safe-area-inset-bottom))]">
          {blocked ? (
            <div className="glass-dark px-5 py-4 text-center">
              <p className="text-[1rem] font-semibold text-coral">
                {!online ? t.offline : t.noCamera}
              </p>
              <p className="mt-1 text-[0.875rem] text-on-surface/60">
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
          ) : quantityChosen ? (
            <p className="text-center text-[0.9375rem] font-medium text-on-surface/70">
              {phase.step === "sending" ? t.checking : status === "booting" ? t.opening : t.scanning}
            </p>
          ) : null}
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
