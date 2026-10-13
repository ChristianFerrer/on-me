"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { CoffeeColdIcon, CoffeeIcon, GiftIcon, QrIcon, UserIcon } from "@/components/ui/Icons";
import { RealStampCard } from "@/components/client/RealStampCard";
import { cn } from "@/lib/cn";
import { fill } from "@/lib/i18n";

/** Cada cuánto se sondea mientras la pantalla está visible. */
const POLL_INTERVAL_MS = 8000;
/** Vuelta sola al código: 2-3 minutos en producción -spec §7-. */
const AUTO_BACK_MS = 150_000;
/** Mismo valor que el `gap` real del track -spec §5-: hace falta en JS para calcular `step()`. */
const TRACK_GAP_PX = 14;

const SLIDE_IDS = ["code", "free", "gift", "profile"] as const;
type SlideId = (typeof SLIDE_IDS)[number];

type Status = {
  stamps: number;
  /** Cafés gratis de verdad disponibles para canjear ahora -no el total de tarjetas completadas en toda la vida, ver lib/card.ts-. */
  rewardsPendingCount: number;
  inviteCount: number;
  returnedGuests: number;
};

/**
 * Clases por tema: el fondo `.aurora` -un degradado claro y vivo- no
 * cambia con el tema del local, solo las superficies que flotan encima.
 * En oscuro son cristal grafito con texto chalk -el aspecto de siempre-;
 * en claro, cristal blanco con texto ink, mismo material, mismos acentos
 * lima, nada más que el contraste invertido.
 */
function surfaceTone(light: boolean) {
  return light
    ? {
        slide: "border-lime/35 bg-[linear-gradient(158deg,rgba(210,251,79,.4),rgba(255,255,255,.92))] text-ink",
        eyebrow: "text-ink/45",
        body: "text-ink/65",
        ghostBtn: "border-ink/10 bg-ink/5 text-ink hover:brightness-95",
        disabledBtn: "cursor-not-allowed bg-ink/5 text-ink/30",
        panel: "border-ink/10 bg-white/70 text-ink",
        panelMuted: "text-ink/55",
        dotEmpty: "border-ink/15 text-ink/25",
        tabInactive: "border-ink/10 bg-white/70 text-ink/45",
        subtle60: "text-ink/60",
        subtle40: "text-ink/40",
      }
    : {
        slide: "border-lime/30 bg-[linear-gradient(158deg,rgba(214,243,76,.22),rgba(10,14,13,.82))] text-chalk",
        eyebrow: "text-white/45",
        body: "text-white/72",
        ghostBtn: "border-white/[.09] bg-white/10 text-white hover:brightness-110",
        disabledBtn: "cursor-not-allowed bg-white/10 text-chalk/30",
        panel: "border-white/[.09] bg-black/60 text-chalk",
        panelMuted: "text-chalk/55",
        dotEmpty: "border-white/15 text-chalk/22",
        tabInactive: "border-white/[.09] bg-black/60 text-chalk/45",
        subtle60: "text-white/60",
        subtle40: "text-white/40",
      };
}

export function CardCarousel({
  customerFullName,
  phoneLast4,
  shopName,
  logoUrl,
  goal,
  bonusStamps,
  light,
  cardStyle,
  qr,
  initial,
  labels,
}: {
  customerFullName: string;
  phoneLast4: string;
  shopName: string;
  logoUrl: string | null;
  goal: number;
  bonusStamps: number;
  /** `shop.theme === 'light'`, ver /admin/ajustes. */
  light: boolean;
  /** `shop.card_style`, ver /admin/ajustes: 'real' sustituye el panel de progreso por RealStampCard. */
  cardStyle: "digital" | "real";
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
    profileLabel: string;
    profilePhoneHint: string;
    eyebrow: string;
  };
}) {
  const [status, setStatus] = useState<Status>(initial);
  const [idx, setIdx] = useState(0);
  const [touching, setTouching] = useState(false);

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

  const { stamps, rewardsPendingCount, inviteCount, returnedGuests } = status;
  const remaining = goal - stamps;
  const tone = surfaceTone(light);

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

  const inviteHref = "/c/invitar";

  // Los cuatro iconos siempre se pueden tocar -son los que enseñan el
  // detalle de cada tarjeta, incluida la que está en 0-: lo que se
  // desactiva es la acción de dentro de cada tarjeta que no tiene nada que
  // hacer todavía (mostrar código, elegir a quién), no el acceso a verla.
  const icons: {
    id: SlideId;
    icon: React.ReactNode;
    label: string;
    ariaLabel?: string;
    badge?: number;
  }[] = [
    { id: "code", icon: <QrIcon className="size-[62%]" />, label: labels.codeLabel },
    {
      id: "free",
      icon: <CoffeeIcon className="size-[62%]" />,
      label: labels.freeCoffeeLabel,
      badge: rewardsPendingCount,
    },
    {
      id: "gift",
      icon: <GiftIcon className="size-[62%]" />,
      label: labels.giftLabel,
      badge: inviteCount,
    },
    {
      id: "profile",
      icon: <UserIcon className="size-[62%]" />,
      label: labels.profileLabel,
    },
  ];

  return (
    <>
      {cardStyle === "real" ? (
        <RealStampCard
          shopName={shopName}
          logoUrl={logoUrl}
          stamps={stamps}
          goal={goal}
          rewardsPendingCount={rewardsPendingCount}
          labels={labels}
        />
      ) : (
        <div
          className={cn(
            "card-scope mx-4 flex-none rounded-[22px] border p-[15px] backdrop-blur-[14px]",
            tone.panel,
          )}
        >
          <div className="flex items-baseline gap-2.5">
            <div className="flex flex-none items-baseline gap-[7px]">
              <b className="numeral text-[clamp(24px,5.4vh,32px)] font-medium leading-none tracking-[-0.05em] text-lime">
                {stamps}
              </b>
              <em className={cn("text-[clamp(11.5px,1.9vh,13.5px)] font-medium not-italic", tone.panelMuted)}>
                {fill(labels.ofGoal, { goal })}
              </em>
            </div>
            <div
              className={cn(
                "ml-auto text-right text-[clamp(10.5px,1.75vh,12.5px)] leading-[1.25]",
                tone.panelMuted,
              )}
            >
              {rewardsPendingCount > 0
                ? labels.readyHint
                : remaining === 1
                  ? labels.oneToGo
                  : fill(labels.nToGo, { n: remaining })}
            </div>
          </div>
          <div className="mt-[clamp(10px,1.8vh,14px)] grid grid-cols-10 gap-[clamp(4px,1.1vw,7px)]">
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
                        : tone.dotEmpty,
                  )}
                >
                  {filled ? <CoffeeIcon className="size-[56%]" /> : <CoffeeColdIcon className="size-[56%]" />}
                </span>
              );
            })}
          </div>
        </div>
      )}

      <div
        role="tablist"
        aria-label={labels.eyebrow}
        onKeyDown={onTabsKeyDown}
        className="flex flex-none justify-between px-4 py-1"
      >
        {icons.map((tab, i) => {
          const active = idx === i;
          const live = !active && (tab.badge ?? 0) > 0;
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
              tabIndex={active ? 0 : -1}
              onClick={() => goTo(i)}
              className={cn(
                "flex size-[clamp(44px,7.6vh,54px)] items-center justify-center rounded-[17px] border transition-[transform,background,border-color] duration-200 active:scale-[0.92]",
                active
                  ? "border-lime bg-lime text-ink shadow-[0_6px_18px_rgba(210,251,79,0.28)]"
                  : live
                    ? "border-lime/36 bg-lime/[.13] text-lime"
                    : tone.tabInactive,
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
            </button>
          );
        })}
      </div>

      <div className="relative flex min-h-0 flex-1 px-4">
        <div
          ref={trackRef}
          onScroll={onTrackScroll}
          onPointerDown={() => setTouching(true)}
          onPointerUp={() => setTouching(false)}
          onPointerCancel={() => setTouching(false)}
          onPointerLeave={() => setTouching(false)}
          className="flex h-full w-full snap-x snap-mandatory gap-3.5 overflow-x-auto overflow-y-hidden scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {icons.map((tab, i) => (
            <div
              key={tab.id}
              data-slide
              role="tabpanel"
              id={`card-slide-${tab.id}`}
              aria-labelledby={`card-tab-${tab.id}`}
              className={cn(
                "relative h-full w-full flex-none snap-center overflow-hidden rounded-[clamp(18px,3.3vh,26px)] transition-[transform,opacity] duration-300",
                idx === i ? "scale-100 opacity-100" : "scale-90 opacity-45",
              )}
            >
              {tab.id === "code" ? (
                <div className="flex size-full flex-col items-center gap-[clamp(6px,1.2vh,10px)] rounded-[clamp(18px,3.3vh,26px)] bg-white p-[clamp(11px,2vh,17px)] shadow-[0_14px_44px_rgba(0,0,0,.38)]">
                  <p className="eyebrow flex-none text-ink/40">{tab.label}</p>
                  <div className="flex min-h-0 w-full flex-1 items-center justify-center">{qr}</div>
                  <p className="flex-none text-[clamp(10px,1.6vh,11.5px)] font-semibold uppercase tracking-[0.15em] text-ink/45">
                    {labels.showToBarista}
                  </p>
                </div>
              ) : null}

              {tab.id === "free" ? (
                <div
                  className={cn(
                    "card-scope flex size-full flex-col items-center justify-center gap-[clamp(7px,1.4vh,12px)] rounded-[clamp(18px,3.3vh,26px)] border p-[clamp(17px,3vh,26px)] text-center backdrop-blur-[18px]",
                    tone.slide,
                  )}
                >
                  <p className={cn("eyebrow", tone.eyebrow)}>{tab.label}</p>
                  <p className="numeral text-[clamp(36px,8.8vh,56px)] font-medium leading-none tracking-[-0.05em] text-lime">
                    {rewardsPendingCount}
                  </p>
                  <h2 className="text-[clamp(16px,3vh,21px)] font-extrabold leading-[1.16] tracking-[-0.025em]">
                    {rewardsPendingCount === 1
                      ? labels.freeCoffeeTitleOne
                      : fill(labels.freeCoffeeTitleMany, { n: rewardsPendingCount })}
                  </h2>
                  <p className={cn("text-[clamp(11.5px,1.95vh,13.5px)] leading-[1.45]", tone.body)}>
                    {labels.freeCoffeeBody}
                  </p>
                  <button
                    type="button"
                    disabled={rewardsPendingCount === 0}
                    onClick={() => goTo(0)}
                    className={cn(
                      "mt-1 rounded-full px-[18px] py-[clamp(10px,1.9vh,14px)] text-[clamp(12.5px,2vh,15px)] font-bold transition-[filter]",
                      rewardsPendingCount === 0 ? tone.disabledBtn : "bg-lime text-ink hover:brightness-110 active:scale-[0.97]",
                    )}
                  >
                    {labels.showCodeCta}
                  </button>
                  {idx === i ? <TimerBar touching={touching} onDone={() => goTo(0)} /> : null}
                </div>
              ) : null}

              {tab.id === "gift" ? (
                <div
                  className={cn(
                    "card-scope flex size-full flex-col items-center justify-center gap-[clamp(7px,1.4vh,12px)] rounded-[clamp(18px,3.3vh,26px)] border p-[clamp(17px,3vh,26px)] text-center backdrop-blur-[18px]",
                    tone.slide,
                  )}
                >
                  <p className={cn("eyebrow", tone.eyebrow)}>{tab.label}</p>
                  {returnedGuests > 0 ? <p className="eyebrow text-lime">{labels.guestReturned}</p> : null}
                  <p className="numeral text-[clamp(36px,8.8vh,56px)] font-medium leading-none tracking-[-0.05em] text-lime">
                    {inviteCount}
                  </p>
                  <h2 className="text-[clamp(16px,3vh,21px)] font-extrabold leading-[1.16] tracking-[-0.025em]">
                    {inviteCount === 1 ? labels.giftTitleOne : fill(labels.giftTitleMany, { n: inviteCount })}
                  </h2>
                  <p className={cn("text-[clamp(11.5px,1.95vh,13.5px)] leading-[1.45]", tone.body)}>
                    {returnedGuests > 0 ? fill(labels.guestReturnedBody, { n: bonusStamps }) : labels.giftBody}
                  </p>
                  <div className="mt-1 flex w-full gap-2">
                    <button
                      type="button"
                      onClick={() => goTo(0)}
                      className={cn(
                        "flex-1 rounded-full border px-[18px] py-[clamp(10px,1.9vh,14px)] text-[clamp(12.5px,2vh,15px)] font-bold transition-[filter] active:scale-[0.97]",
                        tone.ghostBtn,
                      )}
                    >
                      {labels.giftNotNow}
                    </button>
                    {inviteCount > 0 ? (
                      <Link
                        href={inviteHref}
                        prefetch={false}
                        onClick={(event) => event.stopPropagation()}
                        className="flex-1 rounded-full bg-lime px-[18px] py-[clamp(10px,1.9vh,14px)] text-[clamp(12.5px,2vh,15px)] font-bold text-ink transition-[filter] hover:brightness-110 active:scale-[0.97]"
                      >
                        {labels.giftChoose}
                      </Link>
                    ) : (
                      <span aria-disabled="true" className={cn("flex-1 rounded-full px-[18px] py-[clamp(10px,1.9vh,14px)] text-[clamp(12.5px,2vh,15px)] font-bold", tone.disabledBtn)}>
                        {labels.giftChoose}
                      </span>
                    )}
                  </div>
                  {idx === i ? <TimerBar touching={touching} onDone={() => goTo(0)} /> : null}
                </div>
              ) : null}

              {tab.id === "profile" ? (
                <div
                  className={cn(
                    "card-scope flex size-full flex-col items-center justify-center gap-[clamp(7px,1.4vh,12px)] rounded-[clamp(18px,3.3vh,26px)] border p-[clamp(17px,3vh,26px)] text-center backdrop-blur-[18px]",
                    tone.slide,
                  )}
                >
                  <p className={cn("eyebrow", tone.eyebrow)}>{tab.label}</p>
                  <span className="flex size-[clamp(52px,9vh,68px)] items-center justify-center rounded-full border border-lime/30 bg-lime/[.13] text-lime">
                    <UserIcon className="size-[52%]" />
                  </span>
                  <h2 className="break-words text-[clamp(18px,3.4vh,24px)] font-extrabold leading-[1.16] tracking-[-0.025em]">
                    {customerFullName}
                  </h2>
                  <p className={cn("numeral text-[clamp(13px,2.2vh,15px)]", tone.subtle60)}>•••• {phoneLast4}</p>
                  <p className={cn("mt-1 text-[clamp(10.5px,1.75vh,12.5px)] leading-[1.45]", tone.subtle40)}>
                    {labels.profilePhoneHint}
                  </p>
                  {idx === i ? <TimerBar touching={touching} onDone={() => goTo(0)} /> : null}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </div>
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
