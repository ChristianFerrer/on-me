"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { OfflineBadge } from "@/components/client/OfflineBadge";
import { FlipCard } from "@/components/client/FlipCard";
import { CoffeeIcon, GiftIcon, SparkleIcon } from "@/components/ui/Icons";
import { Slab } from "@/components/ui/Screen";
import { StampCard } from "@/components/ui/StampCard";
import { cn } from "@/lib/cn";
import { fill } from "@/lib/i18n";

/** Cada cuánto se sondea mientras la pantalla está visible. */
const POLL_INTERVAL_MS = 8000;

/** Cuánto tarda la tarjeta en volver sola al QR tras enseñar otra cara. */
const AUTO_REVERT_MS = 90_000;

type Status = {
  stamps: number;
  rewardPending: boolean;
  cardsCompleted: number;
  inviteCount: number;
  returnedGuests: number;
};

type Face = "qr" | "coffees" | "invite" | "oracle";

type StoredOracle = { stamps: number; message: string };

function oracleStorageKey(customerId: string): string {
  return `onme:oracle:${customerId}`;
}

/**
 * Todo lo que puede moverse solo en `/c` mientras el cliente la tiene
 * abierta -sellos, premio, cafés gratis, invitaciones, invitado que
 * volvió, el oráculo del día-, en un único componente cliente que sondea
 * `/api/card/status`.
 *
 * Sondeo, no Realtime de Supabase -ver el comentario en esa ruta para el
 * porqué-. Se pausa solo mientras la pestaña está oculta -`visibilitychange`,
 * no un simple `setInterval` ciego- y refresca al instante al volver a
 * mirarla, que es el momento real en que algo pudo haber cambiado.
 *
 * El QR vive aquí, no en la página: la única forma de que los botones de
 * cafés/invitaciones/oráculo lo hagan girar es que compartan el mismo
 * estado de "cara activa", y ese estado tiene que vivir en un componente
 * cliente. `qr` llega ya renderizado desde el server component -es un
 * componente async, no se puede montar dentro de uno de cliente- para no
 * perder el SVG incrustado en el HTML que lo hace funcionar sin cobertura.
 */
export function CardLive({
  customerId,
  shopName,
  goal,
  bonusStamps,
  qr,
  initial,
  labels,
}: {
  customerId: string;
  shopName: string;
  goal: number;
  bonusStamps: number;
  qr: React.ReactNode;
  initial: Status;
  labels: {
    offline: string;
    oneToGo: string;
    nToGo: string;
    rewardTitle: string;
    rewardBody: string;
    showToBarista: string;
    freeCoffees: string;
    inviteRowLabel: string;
    inviteCta: string;
    guestReturned: string;
    guestReturnedBody: string;
    oracleLabel: string;
    oracleCta: string;
    oracleMessages: string[];
  };
}) {
  const [status, setStatus] = useState<Status>(initial);
  const [face, setFace] = useState<Face>("qr");
  const [oracleOpened, setOracleOpened] = useState(false);
  const [oracleMessage, setOracleMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      try {
        const response = await fetch("/api/card/status", { cache: "no-store" });
        if (!response.ok) return;
        const data = (await response.json()) as Status;
        if (!cancelled) setStatus(data);
      } catch {
        // Sin conexión: se reintenta en el siguiente ciclo. OfflineBadge ya
        // avisa por su cuenta, no hace falta duplicar el aviso aquí.
      }
    }

    function onTick() {
      if (document.visibilityState === "visible") void poll();
    }

    void poll();
    const timer = window.setInterval(onTick, POLL_INTERVAL_MS);
    document.addEventListener("visibilitychange", onTick);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onTick);
    };
  }, []);

  const { stamps, rewardPending, cardsCompleted, inviteCount, returnedGuests } = status;
  const remaining = goal - stamps;

  // El oráculo -galleta de la suerte, no chiste por sello-: un sello nuevo
  // desbloquea una frase nueva. "Ya abierto" vive en localStorage, indexado
  // por sello -no por fecha-: cuando `stamps` sube -por el polling de
  // arriba, aunque no se recargue la página- este efecto lo nota solo y
  // vuelve a desbloquearlo, sin que nadie tenga que decírselo explícitamente.
  useEffect(() => {
    function readStoredState() {
      let stored: StoredOracle | null = null;
      try {
        const raw = window.localStorage.getItem(oracleStorageKey(customerId));
        stored = raw ? JSON.parse(raw) : null;
      } catch {
        // Sin localStorage -modo privado, cuota llena-: el oráculo sigue
        // funcionando, solo que "olvida" el estado al recargar.
        stored = null;
      }

      if (stored && stored.stamps === stamps) {
        setOracleOpened(true);
        setOracleMessage(stored.message);
      } else {
        setOracleOpened(false);
        setOracleMessage(null);
      }
    }

    readStoredState();
  }, [customerId, stamps]);

  // Vuelta sola al QR a los pocos minutos de enseñar otra cara: es la
  // cara que de verdad hace falta escanear, y no debería quedarse
  // escondida por haber tocado un botón hace rato y olvidado la tarjeta.
  useEffect(() => {
    if (face === "qr") return;
    const timer = window.setTimeout(() => setFace("qr"), AUTO_REVERT_MS);
    return () => window.clearTimeout(timer);
  }, [face]);

  function toggleFace(next: Face) {
    setFace((current) => (current === next ? "qr" : next));
  }

  function handleOracleClick() {
    if (!oracleOpened) {
      const picked =
        labels.oracleMessages[Math.floor(Math.random() * labels.oracleMessages.length)];
      setOracleMessage(picked);
      setOracleOpened(true);
      try {
        window.localStorage.setItem(
          oracleStorageKey(customerId),
          JSON.stringify({ stamps, message: picked } satisfies StoredOracle),
        );
      } catch {
        // Igual que arriba: no pasa nada si no se puede persistir.
      }
    }
    toggleFace("oracle");
  }

  const oracleAvailable = stamps > 0 && labels.oracleMessages.length > 0;

  return (
    <div className="stagger flex flex-col gap-3">
      <Slab className="p-5">
        <div className="flex items-start justify-between gap-3">
          <p className="eyebrow text-chalk/65">{shopName}</p>
          <OfflineBadge label={labels.offline} />
        </div>

        {rewardPending ? (
          <>
            <h1 className="display-tight mt-3 text-[clamp(2rem,10vw,2.5rem)] text-lime">
              {labels.rewardTitle}
            </h1>
            <p className="mt-3 text-[0.9375rem] leading-relaxed text-chalk/70">{labels.rewardBody}</p>
          </>
        ) : (
          <>
            {/* Sin el numeral grande -"N/goal"-: las propias esferas, más
                grandes ahora, ya dicen cuántas llevas sin obligar a leer un
                número aparte. Esta línea se queda porque no es un recuento,
                es ánimo -"te quedan 3"-, y eso las esferas no lo dicen. */}
            <p className="mt-1 text-[0.9375rem] font-medium text-chalk/80">
              {remaining === 1 ? labels.oneToGo : fill(labels.nToGo, { n: remaining })}
            </p>
            <StampCard stamps={stamps} goal={goal} tone="dark" className="mt-2.5" />
          </>
        )}
      </Slab>

      {/* Tres botones planos, no dos filas de texto: el icono y el badge ya
          dicen de qué van, y tocarlos gira el QR en vez de sumar más
          contenido fijo en pantalla -mismo hueco, tres accesos en vez de
          dos, y el oráculo deja de ocupar su propio bloque permanente-. */}
      <div className={cn("grid gap-2", oracleAvailable ? "grid-cols-3" : "grid-cols-2")}>
        <FaceButton
          icon={<CoffeeIcon className="size-5" />}
          badge={cardsCompleted}
          label={labels.freeCoffees}
          active={face === "coffees"}
          onClick={() => toggleFace("coffees")}
        />
        <FaceButton
          icon={<GiftIcon className="size-5" />}
          badge={inviteCount}
          label={labels.inviteRowLabel}
          active={face === "invite"}
          onClick={() => toggleFace("invite")}
        />
        {oracleAvailable ? (
          <FaceButton
            icon={<SparkleIcon className="size-5" />}
            label={labels.oracleLabel}
            active={face === "oracle"}
            pulse={!oracleOpened}
            ariaLabel={labels.oracleCta}
            onClick={handleOracleClick}
          />
        ) : null}
      </div>

      {returnedGuests > 0 ? (
        <section className="rounded-[var(--radius-card)] bg-lime p-4">
          <p className="eyebrow text-ink/50">{labels.guestReturned}</p>
          <p className="mt-1.5 text-[0.9375rem] font-semibold leading-snug">
            {fill(labels.guestReturnedBody, { n: bonusStamps })}
          </p>
        </section>
      ) : null}

      <FlipCard
        flipped={face !== "qr"}
        onBackClick={() => setFace("qr")}
        front={
          <div className="flex h-full flex-col items-center justify-center gap-2.5 rounded-[var(--radius-card)] bg-white p-4">
            <p className="eyebrow text-center text-ink/40">{labels.showToBarista}</p>
            {qr}
          </div>
        }
        back={
          <BackFace
            face={face}
            cardsCompleted={cardsCompleted}
            inviteCount={inviteCount}
            oracleMessage={oracleMessage}
            labels={labels}
          />
        }
      />
    </div>
  );
}

function FaceButton({
  icon,
  badge,
  label,
  ariaLabel,
  active,
  pulse = false,
  onClick,
}: {
  icon: React.ReactNode;
  badge?: number;
  label: string;
  ariaLabel?: string;
  active: boolean;
  pulse?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel ?? label}
      aria-pressed={active}
      className={cn(
        "glass-dark flex flex-col items-center justify-center gap-1 rounded-2xl py-2.5 transition-[filter] active:scale-95",
        active ? "brightness-125" : "hover:brightness-110",
      )}
    >
      <span
        className={cn(
          "relative flex size-8 items-center justify-center rounded-full text-lime",
          pulse && "anim-oracle-pulse",
        )}
      >
        {icon}
        {badge !== undefined && badge > 0 ? (
          <span className="numeral absolute -right-1.5 -top-1.5 flex min-w-[1.125rem] items-center justify-center rounded-full bg-lime px-1 text-[0.625rem] font-bold leading-[1.125rem] text-ink">
            {badge}
          </span>
        ) : null}
      </span>
      <span className="max-w-full truncate px-1 text-[0.6875rem] font-medium text-chalk/70">
        {label}
      </span>
    </button>
  );
}

function BackFace({
  face,
  cardsCompleted,
  inviteCount,
  oracleMessage,
  labels,
}: {
  face: Face;
  cardsCompleted: number;
  inviteCount: number;
  oracleMessage: string | null;
  labels: {
    freeCoffees: string;
    inviteRowLabel: string;
    inviteCta: string;
  };
}) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 rounded-[var(--radius-card)] bg-white p-4 text-center text-ink">
      {face === "coffees" ? (
        <>
          <p className="numeral text-[2.75rem] font-bold leading-none">{cardsCompleted}</p>
          <p className="text-[0.875rem] font-medium text-ink/60">{labels.freeCoffees}</p>
        </>
      ) : null}

      {face === "invite" ? (
        <>
          <p className="numeral text-[2.75rem] font-bold leading-none">{inviteCount}</p>
          <p className="text-[0.875rem] font-medium text-ink/60">{labels.inviteRowLabel}</p>
          <Link
            href="/c/invitar"
            prefetch={false}
            onClick={(event) => event.stopPropagation()}
            className="eyebrow mt-1 rounded-full bg-ink px-4 py-2 text-chalk transition-[filter] hover:brightness-125"
          >
            {labels.inviteCta}
          </Link>
        </>
      ) : null}

      {face === "oracle" ? (
        <p className="max-w-[16rem] text-[1.0625rem] italic leading-snug text-ink/80">
          “{oracleMessage}”
        </p>
      ) : null}
    </div>
  );
}
