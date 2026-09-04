"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { CoffeeColdIcon, CoffeeIcon, GiftIcon, OrbitIcon, QrIcon, SparkleIcon } from "@/components/ui/Icons";
import { ClientConstellation } from "@/components/client/ClientConstellation";
import { cn } from "@/lib/cn";
import { fill } from "@/lib/i18n";

/** Cada cuánto se sondea mientras la pantalla está visible. */
const POLL_INTERVAL_MS = 8000;
/** Vuelta sola al código: 2-3 minutos en producción -spec §7-. */
const AUTO_BACK_MS = 150_000;
/** Mismo valor que el `gap` real del track -spec §5-: hace falta en JS para calcular `step()`. */
const TRACK_GAP_PX = 14;

const SLIDE_IDS = ["code", "free", "gift", "oracle", "constellation"] as const;
type SlideId = (typeof SLIDE_IDS)[number];

type Status = {
  stamps: number;
  rewardPending: boolean;
  cardsCompleted: number;
  inviteCount: number;
  returnedGuests: number;
  hasInvited: boolean;
};

type StoredOracle = { stamps: number; message: string };

function oracleStorageKey(customerId: string): string {
  return `onme:oracle:${customerId}`;
}

export function CardCarousel({
  customerId,
  customerFirstName,
  goal,
  bonusStamps,
  qr,
  initial,
  labels,
}: {
  customerId: string;
  customerFirstName: string;
  goal: number;
  bonusStamps: number;
  qr: React.ReactNode;
  initial: Status;
  labels: {
    ofGoal: string;
    oneToGo: string;
    nToGo: string;
    readyHint: string;
    codeLabel: string;
    showToBarista: string;
    freeCoffeeLabel: string;
    freeCoffeeTitleOne: string;
    freeCoffeeTitleMany: string;
    freeCoffeeBody: string;
    showCodeCta: string;
    giftLabel: string;
    giftTitleOne: string;
    giftTitleMany: string;
    giftBody: string;
    giftNotNow: string;
    giftChoose: string;
    guestReturned: string;
    guestReturnedBody: string;
    oracleLabel: string;
    oracleCta: string;
    oracleMessages: string[];
    constellationLabel: string;
    constellationLoading: string;
    constellationEmptyTitle: string;
    constellationEmptyBody: string;
  };
}) {
  const [status, setStatus] = useState<Status>(initial);
  const [idx, setIdx] = useState(0);
  const [touching, setTouching] = useState(false);
  const [oracleOpened, setOracleOpened] = useState(false);
  const [oracleMessage, setOracleMessage] = useState<string | null>(null);

  const trackRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const scrollDebounce = useRef<number | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      try {
        const response = await fetch("/api/card/status", { cache: "no-store" });
        if (!response.ok) return;
        const data = (await response.json()) as Status;
        if (!cancelled) setStatus(data);
      } catch {
        // Sin conexión: se reintenta en el siguiente ciclo.
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

  const { stamps, rewardPending, cardsCompleted, inviteCount, returnedGuests, hasInvited } = status;
  const remaining = goal - stamps;

  // El oráculo -galleta de la suerte, no chiste por sello-: un sello nuevo
  // desbloquea una frase nueva, elegida al azar y recordada en
  // localStorage mientras el conteo de sellos no cambie -misma lógica que
  // ya teníamos, la spec pedía una baraja fija por sello con "vista"
  // marcada en servidor, pero no hay ni el campo ni las barajas para eso
  // todavía-. Entrar en su tarjeta del carrusel es la propia revelación:
  // no hace falta un botón aparte dentro de una tarjeta a la que ya se
  // llegó a propósito.
  useEffect(() => {
    function readStoredState() {
      let stored: StoredOracle | null = null;
      try {
        const raw = window.localStorage.getItem(oracleStorageKey(customerId));
        stored = raw ? JSON.parse(raw) : null;
      } catch {
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

  useEffect(() => {
    function revealOnArrival() {
      if (idx !== 3 || oracleOpened) return;
      const picked = labels.oracleMessages[Math.floor(Math.random() * labels.oracleMessages.length)];
      setOracleMessage(picked);
      setOracleOpened(true);
      try {
        window.localStorage.setItem(
          oracleStorageKey(customerId),
          JSON.stringify({ stamps, message: picked } satisfies StoredOracle),
        );
      } catch {
        // Sin localStorage: el oráculo sigue funcionando, solo "olvida" el
        // estado al recargar.
      }
    }

    revealOnArrival();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx]);

  function step(): number {
    const first = trackRef.current?.querySelector<HTMLElement>("[data-slide]");
    return first ? first.getBoundingClientRect().width + TRACK_GAP_PX : 1;
  }

  function goTo(i: number, behavior: ScrollBehavior = "smooth") {
    const next = Math.max(0, Math.min(SLIDE_IDS.length - 1, i));
    setIdx(next);
    trackRef.current?.scrollTo({ left: next * step(), behavior });
    tabRefs.current[next]?.focus();
  }

  useEffect(() => {
    function onResize() {
      goTo(idx, "auto" as ScrollBehavior);
    }
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx]);

  function onTrackScroll() {
    window.clearTimeout(scrollDebounce.current);
    scrollDebounce.current = window.setTimeout(() => {
      const track = trackRef.current;
      if (!track) return;
      const n = Math.round(track.scrollLeft / step());
      const clamped = Math.max(0, Math.min(SLIDE_IDS.length - 1, n));
      setIdx((current) => (current === clamped ? current : clamped));
    }, 110);
  }

  function onTabsKeyDown(event: React.KeyboardEvent) {
    if (event.key === "ArrowRight") {
      event.preventDefault();
      goTo(idx + 1);
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      goTo(idx - 1);
    }
  }

  const oracleUnseen = !oracleOpened;
  const inviteHref = "/c/invitar";

  const icons: {
    id: SlideId;
    icon: React.ReactNode;
    label: string;
    ariaLabel?: string;
    badge?: number;
    disabled?: boolean;
  }[] = [
    { id: "code", icon: <QrIcon className="size-[62%]" />, label: labels.codeLabel },
    {
      id: "free",
      icon: <CoffeeIcon className="size-[62%]" />,
      label: labels.freeCoffeeLabel,
      badge: cardsCompleted,
      disabled: cardsCompleted === 0,
    },
    {
      id: "gift",
      icon: <GiftIcon className="size-[62%]" />,
      label: labels.giftLabel,
      badge: inviteCount,
      disabled: inviteCount === 0,
    },
    {
      id: "oracle",
      icon: <SparkleIcon className="size-[62%]" />,
      label: labels.oracleLabel,
      ariaLabel: labels.oracleCta,
      badge: oracleUnseen ? 1 : 0,
    },
    {
      id: "constellation",
      icon: <OrbitIcon className="size-[62%]" />,
      label: labels.constellationLabel,
      disabled: !hasInvited,
    },
  ];

  return (
    <>
      <div className="card-scope mx-4 flex-none rounded-[22px] border border-white/[.09] bg-black/60 p-[15px] text-chalk backdrop-blur-[14px]">
        <div className="flex items-baseline gap-2.5">
          <div className="flex flex-none items-baseline gap-[7px]">
            <b className="numeral text-[clamp(24px,5.4vh,32px)] font-medium leading-none tracking-[-0.05em] text-lime">
              {stamps}
            </b>
            <em className="text-[clamp(11.5px,1.9vh,13.5px)] font-medium not-italic text-chalk/55">
              {fill(labels.ofGoal, { goal })}
            </em>
          </div>
          <div className="ml-auto text-right text-[clamp(10.5px,1.75vh,12.5px)] leading-[1.25] text-chalk/55">
            {rewardPending ? labels.readyHint : remaining === 1 ? labels.oneToGo : fill(labels.nToGo, { n: remaining })}
          </div>
        </div>
        <div className="mt-[clamp(10px,1.9vh,14px)] grid grid-cols-10 gap-[clamp(4px,1.1vw,7px)]">
          {Array.from({ length: goal }, (_, i) => {
            const filled = i < stamps;
            const next = i === stamps;
            return (
              <span
                key={i}
                className={cn(
                  "flex aspect-square items-center justify-center rounded-[8px] border transition-colors duration-300",
                  filled
                    ? "border-lime bg-lime text-ink shadow-[0_0_12px_rgba(210,251,79,0.3)]"
                    : next
                      ? "anim-dot-pulse border-lime/60 text-lime"
                      : "border-white/15 text-chalk/22",
                )}
              >
                {filled ? <CoffeeIcon className="size-[56%]" /> : <CoffeeColdIcon className="size-[56%]" />}
              </span>
            );
          })}
        </div>
      </div>

      <div
        role="tablist"
        aria-label={labels.constellationLabel}
        onKeyDown={onTabsKeyDown}
        className="flex flex-none justify-center gap-[clamp(11px,3.6vw,20px)] px-4 pb-1 pt-0.5"
      >
        {icons.map((tab, i) => {
          const active = idx === i;
          const live = !active && !tab.disabled && (tab.badge ?? 0) > 0;
          return (
            <button
              key={tab.id}
              ref={(el) => {
                tabRefs.current[i] = el;
              }}
              type="button"
              role="tab"
              id={`card-tab-${tab.id}`}
              aria-selected={active}
              aria-controls={`card-slide-${tab.id}`}
              aria-label={tab.ariaLabel ?? tab.label}
              aria-disabled={tab.disabled}
              disabled={tab.disabled}
              tabIndex={tab.disabled ? -1 : active ? 0 : -1}
              onClick={() => {
                if (!tab.disabled) goTo(i);
              }}
              className={cn(
                "flex size-[clamp(44px,7.6vh,54px)] flex-col items-center justify-center gap-1 rounded-[17px] border transition-[transform,background,border-color] duration-200",
                tab.disabled
                  ? "cursor-not-allowed border-white/[.06] bg-black/25 text-chalk/20 opacity-50"
                  : cn(
                      "active:scale-[0.92]",
                      active
                        ? "border-lime bg-lime text-ink shadow-[0_6px_18px_rgba(210,251,79,0.28)]"
                        : live
                          ? "border-lime/36 bg-lime/[.13] text-lime"
                          : "border-white/[.09] bg-black/60 text-chalk/45",
                    ),
              )}
            >
              <span className="relative flex items-center justify-center">
                {tab.icon}
                {tab.badge ? (
                  <span className="numeral absolute -right-2.5 -top-2.5 flex min-w-[19px] items-center justify-center rounded-full border-2 border-white bg-[#ff3b30] px-1 text-[10px] font-semibold leading-[17px] text-white shadow-[0_2px_8px_rgba(0,0,0,.4)]">
                    {tab.badge}
                  </span>
                ) : null}
              </span>
              <small
                className={cn(
                  "text-[9px] font-medium not-italic transition-colors",
                  tab.disabled ? "text-chalk/20" : active ? "text-ink/75" : "text-chalk/30",
                )}
              >
                {tab.label}
              </small>
            </button>
          );
        })}
      </div>

      <div className="relative flex min-h-0 flex-1 items-center">
        <div
          ref={trackRef}
          onScroll={onTrackScroll}
          onPointerDown={() => setTouching(true)}
          onPointerUp={() => setTouching(false)}
          onPointerCancel={() => setTouching(false)}
          onPointerLeave={() => setTouching(false)}
          className="flex w-full snap-x snap-mandatory gap-3.5 overflow-x-auto overflow-y-hidden scroll-smooth py-1.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          style={{ paddingInline: "calc((100% - var(--cw)) / 2)" }}
        >
          {icons.map((tab, i) => (
            <div
              key={tab.id}
              data-slide
              role="tabpanel"
              id={`card-slide-${tab.id}`}
              aria-labelledby={`card-tab-${tab.id}`}
              className={cn(
                "relative aspect-square flex-none snap-center overflow-hidden rounded-[clamp(18px,3.3vh,26px)] transition-[transform,opacity] duration-300",
                idx === i ? "scale-100 opacity-100" : "scale-90 opacity-45",
              )}
              style={{ width: "var(--cw)" }}
            >
              {tab.id === "code" ? (
                <div className="flex size-full items-center justify-center bg-white p-[clamp(11px,2vh,17px)] shadow-[0_14px_44px_rgba(0,0,0,.38)]">
                  {qr}
                </div>
              ) : null}

              {tab.id === "free" ? (
                <div className="card-scope flex size-full flex-col items-center justify-center gap-[clamp(7px,1.4vh,12px)] border border-lime/30 bg-[linear-gradient(158deg,rgba(214,243,76,.22),rgba(10,14,13,.82))] p-[clamp(17px,3vh,26px)] text-center text-chalk backdrop-blur-[18px]">
                  <p className="numeral text-[clamp(36px,8.8vh,56px)] font-medium leading-none tracking-[-0.05em] text-lime">
                    {cardsCompleted}
                  </p>
                  <h2 className="text-[clamp(16px,3vh,21px)] font-extrabold leading-[1.16] tracking-[-0.025em]">
                    {cardsCompleted === 1 ? labels.freeCoffeeTitleOne : fill(labels.freeCoffeeTitleMany, { n: cardsCompleted })}
                  </h2>
                  <p className="text-[clamp(11.5px,1.95vh,13.5px)] leading-[1.45] text-white/72">{labels.freeCoffeeBody}</p>
                  <button
                    type="button"
                    onClick={() => goTo(0)}
                    className="mt-1 rounded-full bg-lime px-[18px] py-[clamp(10px,1.9vh,14px)] text-[clamp(12.5px,2vh,15px)] font-bold text-ink transition-[filter] hover:brightness-110 active:scale-[0.97]"
                  >
                    {labels.showCodeCta}
                  </button>
                  {idx === i ? <TimerBar touching={touching} onDone={() => goTo(0)} /> : null}
                </div>
              ) : null}

              {tab.id === "gift" ? (
                <div className="card-scope flex size-full flex-col items-center justify-center gap-[clamp(7px,1.4vh,12px)] border border-lime/30 bg-[linear-gradient(158deg,rgba(214,243,76,.22),rgba(10,14,13,.82))] p-[clamp(17px,3vh,26px)] text-center text-chalk backdrop-blur-[18px]">
                  {returnedGuests > 0 ? <p className="eyebrow text-lime">{labels.guestReturned}</p> : null}
                  <p className="numeral text-[clamp(36px,8.8vh,56px)] font-medium leading-none tracking-[-0.05em] text-lime">
                    {inviteCount}
                  </p>
                  <h2 className="text-[clamp(16px,3vh,21px)] font-extrabold leading-[1.16] tracking-[-0.025em]">
                    {inviteCount === 1 ? labels.giftTitleOne : fill(labels.giftTitleMany, { n: inviteCount })}
                  </h2>
                  <p className="text-[clamp(11.5px,1.95vh,13.5px)] leading-[1.45] text-white/72">
                    {returnedGuests > 0 ? fill(labels.guestReturnedBody, { n: bonusStamps }) : labels.giftBody}
                  </p>
                  <div className="mt-1 flex w-full gap-2">
                    <button
                      type="button"
                      onClick={() => goTo(0)}
                      className="flex-1 rounded-full border border-white/[.09] bg-white/10 px-[18px] py-[clamp(10px,1.9vh,14px)] text-[clamp(12.5px,2vh,15px)] font-bold text-white transition-[filter] hover:brightness-110 active:scale-[0.97]"
                    >
                      {labels.giftNotNow}
                    </button>
                    <Link
                      href={inviteHref}
                      prefetch={false}
                      onClick={(event) => event.stopPropagation()}
                      className="flex-1 rounded-full bg-lime px-[18px] py-[clamp(10px,1.9vh,14px)] text-[clamp(12.5px,2vh,15px)] font-bold text-ink transition-[filter] hover:brightness-110 active:scale-[0.97]"
                    >
                      {labels.giftChoose}
                    </Link>
                  </div>
                  {idx === i ? <TimerBar touching={touching} onDone={() => goTo(0)} /> : null}
                </div>
              ) : null}

              {tab.id === "oracle" ? (
                <div className="card-scope flex size-full flex-col items-center justify-center gap-[clamp(7px,1.4vh,12px)] border border-lime/30 bg-[linear-gradient(158deg,rgba(214,243,76,.22),rgba(10,14,13,.82))] p-[clamp(17px,3vh,26px)] text-center text-chalk backdrop-blur-[18px]">
                  <p className="text-[clamp(15px,3.1vh,22px)] italic leading-[1.4] text-white/94">
                    {oracleMessage ? `“${oracleMessage}”` : ""}
                  </p>
                  {idx === i ? <TimerBar touching={touching} onDone={() => goTo(0)} /> : null}
                </div>
              ) : null}

              {tab.id === "constellation" ? (
                <div className="card-scope relative flex size-full flex-col items-center justify-center border border-lime/30 bg-[linear-gradient(158deg,rgba(214,243,76,.22),rgba(10,14,13,.82))] text-chalk backdrop-blur-[18px]">
                  <ClientConstellation
                    customerName={customerFirstName}
                    loadingLabel={labels.constellationLoading}
                    emptyTitle={labels.constellationEmptyTitle}
                    emptyBody={labels.constellationEmptyBody}
                    emptyCta={labels.giftChoose}
                  />
                  {idx === i ? <TimerBar touching={touching} onDone={() => goTo(0)} /> : null}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </div>

      <p
        className={cn(
          "min-h-[14px] flex-none px-4 text-center text-[clamp(10px,1.6vh,11.5px)] font-semibold uppercase tracking-[0.15em] text-ink/55 transition-opacity duration-300",
          idx === 0 ? "opacity-100" : "opacity-0",
        )}
      >
        {idx === 0 ? labels.showToBarista : ""}
      </p>
    </>
  );
}

/**
 * Barra de vuelta automática: reutiliza `.drain` -mismo mecanismo que el
 * cierre automático del veredicto del barista, ver Verdict.tsx-, no un
 * `requestAnimationFrame` propio. `key` fuerza que la animación arranque
 * de cero cada vez que esta tarjeta pasa a ser la activa; `animationPlayState`
 * la pausa mientras el dedo sigue sobre el carrusel -sin perder el
 * progreso ya hecho, a diferencia de reiniciarla-.
 */
function TimerBar({ touching, onDone }: { touching: boolean; onDone: () => void }) {
  return (
    <div className="absolute inset-x-0 bottom-0 h-[3px] bg-white/[.08]">
      <div
        className="drain h-full bg-lime"
        style={{ ["--drain" as string]: `${AUTO_BACK_MS}ms`, animationPlayState: touching ? "paused" : "running" }}
        onAnimationEnd={onDone}
      />
    </div>
  );
}
