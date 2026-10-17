"use client";

import Link from "next/link";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { CARD_SHADOW, CardMark, FlipButton } from "@/components/client/CardFaceBits";
import { CoffeeColdIcon, CoffeeIcon, EyeIcon, EyeOffIcon, GiftIcon, QrIcon, UserIcon } from "@/components/ui/Icons";
import { RealStampCard } from "@/components/client/RealStampCard";
import { cn } from "@/lib/cn";
import { fill } from "@/lib/i18n";

/** Cada cuánto se sondea mientras la pantalla está visible. */
const POLL_INTERVAL_MS = 8000;
/** Vuelta sola al código: 2-3 minutos en producción -spec §7-. */
const AUTO_BACK_MS = 150_000;
/** Mismo valor que el `gap` real del track -spec §5-: hace falta en JS para calcular `step()`. */
const TRACK_GAP_PX = 14;
/** Duración del desplazamiento programático -tocar una pestaña-: scroll nativo
 * "smooth" no deja fijar cuánto tarda y en móvil suele ir muy lento, de ahí
 * `animateScrollTo` más abajo en vez de `scrollTo({ behavior: "smooth" })`. */
const SCROLL_MS = 220;
/** Debounce tras un swipe con el dedo antes de fijar la pestaña activa -spec
 * §5-: lo justo para no disparar con cada frame del scroll nativo. */
const SETTLE_DEBOUNCE_MS = 60;
/**
 * `useLayoutEffect` de verdad en el navegador -corre antes de que pinte,
 * así React nunca llega a pintar un fotograma intermedio donde una prop
 * ya cambió pero el estado que depende de ella en un efecto todavía no,
 * como el arranque del encogimiento de CardFlip más abajo-; `useEffect`
 * en el servidor, donde `useLayoutEffect` no corre y React avisa por
 * consola si se usa igual -el componente sí se renderiza en el servidor,
 * "use client" y todo, para el HTML inicial-.
 */
const useIsomorphicLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

// "profile" ya no es una pestaña del carrusel: vive en el reverso de la
// propia tarjeta -ver CardFlip más abajo-, junto con el enlace de
// privacidad que antes era el pie de app/c/page.tsx. Tres pestañas, no
// cuatro: código, café gratis, para regalar.
const SLIDE_IDS = ["code", "free", "gift"] as const;
type SlideId = (typeof SLIDE_IDS)[number];

type Status = {
  stamps: number;
  /** Cafés gratis de verdad disponibles para canjear ahora -no el total de tarjetas completadas en toda la vida, ver lib/card.ts-. */
  rewardsPendingCount: number;
  inviteCount: number;
  returnedGuests: number;
};

/**
 * Clases por tema: el fondo `.aurora` ya cambia de verdad entre claro y
 * oscuro -ver [data-theme="light"] .aurora en globals.css-; esto sigue
 * siendo para las superficies que flotan encima, mismo material en los
 * dos temas -cristal, mismos acentos lima-, solo el contraste invertido.
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
        // Sólido -no `bg-white/70`-: traslúcido sobre el fondo claro nuevo
        // -liso o con puntos, ver globals.css- se leía como "transparente",
        // sin el contraste que tenía contra el degradado saturado de antes.
        tabInactive: "border-ink/10 bg-[#f1f2ef] text-ink/45",
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

type Tone = ReturnType<typeof surfaceTone>;

/**
 * Sustituye `scrollTo({ behavior: "smooth" })`: el scroll "smooth" nativo no
 * deja fijar cuánto tarda -en móvil suele alargarse bastante más de lo que
 * parece en desktop-, así que para saltar de pestaña con un tacto se anima
 * `scrollLeft` a mano, con una duración fija y corta (`SCROLL_MS`). Un toque
 * repetido antes de que termine la anterior cancela esa animación en vez de
 * sumarse a ella -de ahí `cancelRef`, compartido entre llamadas-.
 */
function animateScrollLeft(
  el: HTMLElement,
  to: number,
  duration: number,
  cancelRef: React.MutableRefObject<number | undefined>,
) {
  if (cancelRef.current !== undefined) window.cancelAnimationFrame(cancelRef.current);
  const from = el.scrollLeft;
  const delta = to - from;
  if (Math.abs(delta) < 1) {
    el.scrollLeft = to;
    return;
  }
  const start = performance.now();
  function tick(now: number) {
    const t = Math.min(1, (now - start) / duration);
    const eased = 1 - (1 - t) ** 3;
    el.scrollLeft = from + delta * eased;
    cancelRef.current = t < 1 ? window.requestAnimationFrame(tick) : undefined;
  }
  cancelRef.current = window.requestAnimationFrame(tick);
}

export function CardCarousel({
  customerFullName,
  phoneLast4,
  phone,
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
  /** E.164 completo, en claro -`null` en clientes dados de alta antes de la
   * migración 0003, cuyo hash no se puede deshacer-: ver CustomerRow en
   * lib/db/types.ts. Sin él, el reverso de la tarjeta no ofrece el ojo que
   * enseña el número completo -nunca hubo nada que enseñar-. */
  phone: string | null;
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
    /** Enlace de privacidad -antes el pie de app/c/page.tsx-, ahora en el reverso de la tarjeta. */
    consentLink: string;
    /** Texto accesible del botón que voltea la tarjeta. */
    flipLabel: string;
    /** Subtítulo fijo bajo el nombre del local, frente de la tarjeta. */
    tagline: string;
    showPhoneLabel: string;
    hidePhoneLabel: string;
  };
}) {
  const [status, setStatus] = useState<Status>(initial);
  const [idx, setIdx] = useState(0);
  const [touching, setTouching] = useState(false);
  const [flipped, setFlipped] = useState(false);

  const trackRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const scrollDebounce = useRef<number | undefined>(undefined);
  const scrollAnim = useRef<number | undefined>(undefined);

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
  const tone = surfaceTone(light);

  function step(): number {
    const first = trackRef.current?.querySelector<HTMLElement>("[data-slide]");
    return first ? first.getBoundingClientRect().width + TRACK_GAP_PX : 1;
  }

  function goTo(i: number, behavior: ScrollBehavior = "smooth") {
    const next = Math.max(0, Math.min(SLIDE_IDS.length - 1, i));
    setIdx(next);
    const track = trackRef.current;
    if (track) {
      if (behavior === "smooth") {
        animateScrollLeft(track, next * step(), SCROLL_MS, scrollAnim);
      } else {
        if (scrollAnim.current !== undefined) window.cancelAnimationFrame(scrollAnim.current);
        track.scrollLeft = next * step();
      }
    }
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
    }, SETTLE_DEBOUNCE_MS);
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

  // Los tres iconos siempre se pueden tocar -son los que enseñan el
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
  ];

  const toggleFlip = () => setFlipped((v) => !v);

  return (
    <>
      <CardFlip
        flipped={flipped}
        front={
          cardStyle === "real" ? (
            <RealStampCard
              shopName={shopName}
              logoUrl={logoUrl}
              stamps={stamps}
              goal={goal}
              rewardsPendingCount={rewardsPendingCount}
              flipped={flipped}
              onFlip={toggleFlip}
              labels={labels}
            />
          ) : (
            <DigitalStampPanel
              shopName={shopName}
              stamps={stamps}
              goal={goal}
              rewardsPendingCount={rewardsPendingCount}
              flipped={flipped}
              onFlip={toggleFlip}
              light={light}
              tone={tone}
              labels={labels}
            />
          )
        }
        back={
          <CardBack
            isReal={cardStyle === "real"}
            tone={tone}
            customerFullName={customerFullName}
            phone={phone}
            phoneLast4={phoneLast4}
            flipped={flipped}
            onFlip={toggleFlip}
            light={light}
            labels={labels}
          />
        }
      />

      <div
        role="tablist"
        aria-label={labels.eyebrow}
        onKeyDown={onTabsKeyDown}
        className="flex flex-none items-center justify-center gap-x-[clamp(22px,7vw,40px)] px-4 py-1"
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
                "flex size-[clamp(40px,6.8vh,49px)] items-center justify-center rounded-[17px] border transition-[transform,background,border-color] duration-200 active:scale-[0.92]",
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
          className="flex h-full w-full snap-x snap-mandatory gap-3.5 overflow-x-auto overflow-y-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {icons.map((tab, i) => (
            <div
              key={tab.id}
              data-slide
              role="tabpanel"
              id={`card-slide-${tab.id}`}
              aria-labelledby={`card-tab-${tab.id}`}
              className={cn(
                "relative h-full w-full flex-none snap-center overflow-hidden rounded-[clamp(18px,3.3vh,26px)] transition-[transform,opacity] duration-150 ease-out",
                idx === i ? "z-10 scale-100 opacity-100" : "z-0 scale-[0.88] opacity-45",
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
                <div className="flex size-full flex-col items-center justify-center gap-[clamp(7px,1.4vh,12px)] rounded-[clamp(18px,3.3vh,26px)] bg-white p-[clamp(17px,3vh,26px)] text-center text-ink shadow-[0_14px_44px_rgba(0,0,0,.38)]">
                  <p className="eyebrow text-ink/40">{tab.label}</p>
                  <p className="numeral text-[clamp(36px,8.8vh,56px)] font-medium leading-none tracking-[-0.05em] text-lime">
                    {rewardsPendingCount}
                  </p>
                  <h2 className="text-[clamp(16px,3vh,21px)] font-extrabold leading-[1.16] tracking-[-0.025em]">
                    {rewardsPendingCount === 1
                      ? labels.freeCoffeeTitleOne
                      : fill(labels.freeCoffeeTitleMany, { n: rewardsPendingCount })}
                  </h2>
                  <p className="text-[clamp(11.5px,1.95vh,13.5px)] leading-[1.45] text-ink/65">
                    {labels.freeCoffeeBody}
                  </p>
                  <button
                    type="button"
                    disabled={rewardsPendingCount === 0}
                    onClick={() => goTo(0)}
                    className={cn(
                      "mt-1 rounded-full px-[18px] py-[clamp(10px,1.9vh,14px)] text-[clamp(12.5px,2vh,15px)] font-bold transition-[filter]",
                      rewardsPendingCount === 0
                        ? "cursor-not-allowed bg-ink/5 text-ink/30"
                        : "bg-lime text-ink hover:brightness-110 active:scale-[0.97]",
                    )}
                  >
                    {labels.showCodeCta}
                  </button>
                  {idx === i ? <TimerBar touching={touching} onDone={() => goTo(0)} /> : null}
                </div>
              ) : null}

              {tab.id === "gift" ? (
                <div className="flex size-full flex-col items-center justify-center gap-[clamp(7px,1.4vh,12px)] rounded-[clamp(18px,3.3vh,26px)] bg-white p-[clamp(17px,3vh,26px)] text-center text-ink shadow-[0_14px_44px_rgba(0,0,0,.38)]">
                  <p className="eyebrow text-ink/40">{tab.label}</p>
                  {returnedGuests > 0 ? <p className="eyebrow text-lime">{labels.guestReturned}</p> : null}
                  <p className="numeral text-[clamp(36px,8.8vh,56px)] font-medium leading-none tracking-[-0.05em] text-lime">
                    {inviteCount}
                  </p>
                  <h2 className="text-[clamp(16px,3vh,21px)] font-extrabold leading-[1.16] tracking-[-0.025em]">
                    {inviteCount === 1 ? labels.giftTitleOne : fill(labels.giftTitleMany, { n: inviteCount })}
                  </h2>
                  <p className="text-[clamp(11.5px,1.95vh,13.5px)] leading-[1.45] text-ink/65">
                    {returnedGuests > 0 ? fill(labels.guestReturnedBody, { n: bonusStamps }) : labels.giftBody}
                  </p>
                  <div className="mt-1 flex w-full gap-2">
                    <button
                      type="button"
                      onClick={() => goTo(0)}
                      className="flex-1 rounded-full border border-ink/10 bg-ink/5 px-[18px] py-[clamp(10px,1.9vh,14px)] text-[clamp(12.5px,2vh,15px)] font-bold text-ink transition-[filter] hover:brightness-95 active:scale-[0.97]"
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
                      <span aria-disabled="true" className="flex-1 cursor-not-allowed rounded-full bg-ink/5 px-[18px] py-[clamp(10px,1.9vh,14px)] text-[clamp(12.5px,2vh,15px)] font-bold text-ink/30">
                        {labels.giftChoose}
                      </span>
                    )}
                  </div>
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
 * Tarjeta digital -alternativa a RealStampCard-, con el nombre del local
 * como etiqueta propia: antes vivía en la cabecera de app/c/page.tsx, que
 * ya no existe -la marca y el nombre del local se mudaron aquí dentro,
 * ver CardFlip-. Sin el número grande de sellos en la cabecera -la propia
 * rejilla de abajo ya enseña el progreso, y ese número era lo que tapaba
 * el botón de girar en la versión "real"-: el dato que faltaba, "te falta
 * N cafés", baja al pie junto a la marca, igual que en RealStampCard.
 */
function DigitalStampPanel({
  shopName,
  stamps,
  goal,
  rewardsPendingCount,
  flipped,
  onFlip,
  light,
  tone,
  labels,
}: {
  shopName: string;
  stamps: number;
  goal: number;
  rewardsPendingCount: number;
  flipped: boolean;
  onFlip: () => void;
  light: boolean;
  tone: Tone;
  labels: { oneToGo: string; nToGo: string; readyHint: string; tagline: string; flipLabel: string };
}) {
  const remaining = goal - stamps;
  return (
    <div className={cn("card-scope relative rounded-[22px] border p-[15px] backdrop-blur-[14px]", tone.panel, CARD_SHADOW)}>
      <FlipButton onClick={onFlip} pressed={flipped} label={labels.flipLabel} onLight={light} />

      <div className="pr-8">
        <p className={cn("truncate text-[clamp(10.5px,1.7vh,12px)] font-bold uppercase tracking-[0.08em]", tone.panelMuted)}>
          {shopName}
        </p>
        <p className={cn("truncate text-[clamp(9px,1.4vh,10.5px)]", tone.subtle40)}>{labels.tagline}</p>
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

      <div className="mt-[clamp(10px,1.8vh,14px)] flex items-center justify-between gap-2">
        <CardMark onLight={light} />
        <p className={cn("text-right text-[clamp(10.5px,1.75vh,12.5px)] leading-[1.3]", tone.panelMuted)}>
          {rewardsPendingCount > 0
            ? labels.readyHint
            : remaining === 1
              ? labels.oneToGo
              : fill(labels.nToGo, { n: remaining })}
        </p>
      </div>
    </div>
  );
}

/**
 * Reverso de la tarjeta: perfil del cliente + el enlace de privacidad que
 * antes era el pie fijo de app/c/page.tsx en las cuatro pestañas por
 * igual. Mismo criterio de color que el frente -azul marino fijo para
 * "real", tone.panel para "digital"-, para que el giro se sienta como la
 * misma tarjeta, no una pantalla distinta.
 *
 * El teléfono se enseña enmascarado por defecto -el hash no se puede
 * deshacer, pero desde la migración 0003 sí se guarda el E.164 completo en
 * claro, ver CustomerRow en lib/db/types.ts-: el ojo lo revela a pedido del
 * propio cliente en vez de imprimirlo siempre. Sin `phone` -clientes de
 * antes de esa migración- no hay nada que revelar, así que no se muestra
 * el botón.
 */
function CardBack({
  isReal,
  tone,
  customerFullName,
  phone,
  phoneLast4,
  flipped,
  onFlip,
  light,
  labels,
}: {
  isReal: boolean;
  tone: Tone;
  customerFullName: string;
  phone: string | null;
  phoneLast4: string;
  flipped: boolean;
  onFlip: () => void;
  light: boolean;
  labels: {
    profileLabel: string;
    profilePhoneHint: string;
    consentLink: string;
    flipLabel: string;
    showPhoneLabel: string;
    hidePhoneLabel: string;
  };
}) {
  const [revealed, setRevealed] = useState(false);
  const onLight = isReal ? false : light;

  return (
    <div
      className={cn(
        "card-scope relative flex size-full flex-col items-center justify-center gap-2 rounded-[20px] border p-5 text-center",
        isReal ? "border-white/15 bg-[#0e1a38] text-white" : tone.panel,
        CARD_SHADOW,
      )}
    >
      <FlipButton onClick={onFlip} pressed={flipped} label={labels.flipLabel} onLight={onLight} />

      <p className={cn("eyebrow", isReal ? "text-white/45" : tone.eyebrow)}>{labels.profileLabel}</p>
      <span
        className={cn(
          "flex size-11 items-center justify-center rounded-full border",
          isReal ? "border-white/30 bg-white/5 text-white" : "border-lime/30 bg-lime/[.13] text-lime",
        )}
      >
        <UserIcon className="size-[52%]" />
      </span>
      <h2 className="break-words text-[1.0625rem] font-extrabold leading-[1.2] tracking-[-0.02em]">
        {customerFullName}
      </h2>
      <div className="flex items-center justify-center gap-1.5">
        <p className={cn("numeral text-[0.8125rem]", isReal ? "text-white/60" : tone.subtle60)}>
          {revealed && phone ? phone : `•••• ${phoneLast4}`}
        </p>
        {phone ? (
          <button
            type="button"
            onClick={() => setRevealed((v) => !v)}
            aria-pressed={revealed}
            aria-label={revealed ? labels.hidePhoneLabel : labels.showPhoneLabel}
            className={cn("flex size-[1.0625rem] items-center justify-center", isReal ? "text-white/50" : tone.subtle60)}
          >
            {revealed ? <EyeOffIcon className="size-full" /> : <EyeIcon className="size-full" />}
          </button>
        ) : null}
      </div>
      <p className={cn("text-[0.6875rem] leading-[1.45]", isReal ? "text-white/40" : tone.subtle40)}>
        {labels.profilePhoneHint}
      </p>
      <Link
        href="/privacidad"
        className={cn(
          "mt-1.5 text-[0.625rem] font-semibold uppercase tracking-[0.12em] underline underline-offset-2",
          isReal ? "text-white/45" : tone.subtle40,
        )}
      >
        {labels.consentLink}
      </Link>
    </div>
  );
}

/**
 * Giro de la tarjeta -no un cambio de pestaña-: el frente (sellos) y el
 * reverso (perfil, privacidad) son la misma tarjeta física, no dos
 * pantallas distintas, así que el gesto tiene que sentirse como voltear
 * un objeto, no como navegar.
 *
 * Cuatro intentos con un giro 3D de verdad -perspective + rotateY +
 * backface-visibility, cada vez con más capas (prefijo `-webkit-`,
 * `visibility:hidden`, desmontar del DOM del todo con un `sizer`
 * invisible aparte para no perder el alto)- y Safari/iOS seguía dejando
 * un fantasma en espejo de la cara oculta -el botón de girar del
 * frente, invertido, en la esquina opuesta del reverso-, incluso con la
 * cara realmente ausente del DOM. Eso último es lo que descarta que sea
 * un problema de *timing* o de qué propiedad CSS usar: si ni sacar el
 * nodo del documento lo arregla, el fantasma no viene de lo que hay
 * montado, viene de una capa compuesta que ese motor deja huérfana al
 * animar `rotateY` dentro de un `perspective`/`preserve-3d` anidado así,
 * y no la suelta sola.
 *
 * La única forma de no toparse con ese bug es no usar ese mecanismo:
 * nada de `perspective`, `rotateY`, `preserve-3d` ni `backface-visibility`
 * aquí. El giro se finge en 2D -`scaleX` de 1 a 0 y de 0 a 1 de nuevo-,
 * la misma idea que un naipe visto de canto: a mitad de camino, con la
 * tarjeta encogida a una línea vertical, es cuando el contenido real
 * cambia de frente a reverso -`shown`-, así que el cambio es invisible
 * -no hay ancho en ese instante- en vez de un salto. Una sola cara
 * montada a la vez, en flujo normal -nada de `absolute`/`inset-0`-, así
 * que la tarjeta ya no necesita ningún truco aparte para mantener su
 * alto: lo da, sin más, la que esté mostrando en cada momento.
 */
const FLIP_HALF_MS = 260;

function CardFlip({
  front,
  back,
  flipped,
}: {
  front: React.ReactNode;
  back: React.ReactNode;
  flipped: boolean;
}) {
  const [shown, setShown] = useState(flipped);
  const [squeezed, setSqueezed] = useState(false);
  const mounted = useRef(false);
  const swapTimer = useRef<number | undefined>(undefined);

  useIsomorphicLayoutEffect(() => {
    // El primer disparo es el propio montaje, no un giro real -`flipped`
    // "cambia" de nada a su valor inicial-, así que no hace falta animar nada.
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    window.clearTimeout(swapTimer.current);
    setSqueezed(true);
    swapTimer.current = window.setTimeout(() => {
      setShown(flipped);
      setSqueezed(false);
    }, FLIP_HALF_MS);
    return () => window.clearTimeout(swapTimer.current);
  }, [flipped]);

  return (
    <div className="relative mx-4 flex-none">
      <div
        className="transition-transform ease-[cubic-bezier(.4,0,.2,1)]"
        style={{ transform: squeezed ? "scaleX(0)" : "scaleX(1)", transitionDuration: `${FLIP_HALF_MS}ms` }}
      >
        {shown ? back : front}
      </div>
    </div>
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
    <div className="absolute inset-x-0 bottom-0 h-[3px] bg-ink/10">
      <div
        className="drain h-full bg-lime"
        style={{ ["--drain" as string]: `${AUTO_BACK_MS}ms`, animationPlayState: touching ? "paused" : "running" }}
        onAnimationEnd={onDone}
      />
    </div>
  );
}
