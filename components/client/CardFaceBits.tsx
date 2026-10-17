import { FlipIcon } from "@/components/ui/Icons";
import { Mark } from "@/components/ui/Logo";
import { cn } from "@/lib/cn";

/**
 * Piezas compartidas entre las tres caras de la tarjeta -RealStampCard,
 * DigitalStampPanel y CardBack, ver CardCarousel.tsx-: el botón de girar y
 * la marca OnMe. Cada cara las monta dentro de su propio marcado -no como
 * overlay suelto encima de la pantalla-, en la misma esquina y con el
 * mismo tamaño en las tres, así que al girar la tarjeta ambas quedan fijas
 * en el mismo punto y giran con ella -son parte del objeto, no de la
 * pantalla-.
 *
 * `onLight` no es el tema del local: es si ESTA cara en concreto tiene
 * fondo claro -el panel digital en tema claro- u oscuro -el azul marino
 * fijo de RealStampCard, el panel digital en tema oscuro-, para elegir un
 * trazo que contraste con su propio fondo y no con `--color-on-surface`,
 * que sigue el tema global y no el de esta tarjeta en particular.
 */

/**
 * Sombra compartida por las tres caras -antes solo la tenía RealStampCard,
 * y con un alcance tan grande (`0 18px 40px`) que se notaba encima de los
 * tres botones de pestaña de abajo, a solo unos pocos píxeles de la
 * tarjeta-. Más corta y más tenue -`0 6px 16px`-, para que se quede
 * contenida en el hueco real entre la tarjeta y esos botones.
 */
export const CARD_SHADOW = "shadow-[0_6px_16px_rgba(2,6,23,0.3)]";
export function FlipButton({
  onClick,
  pressed,
  label,
  onLight,
}: {
  onClick: () => void;
  pressed: boolean;
  label: string;
  onLight: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={pressed}
      className={cn(
        "absolute right-3 top-3 z-10 flex size-7 items-center justify-center rounded-full transition-transform active:scale-90",
        onLight ? "bg-ink/8 text-ink/70" : "bg-white/12 text-white/85",
      )}
    >
      <FlipIcon className="size-[55%]" />
    </button>
  );
}

export function CardMark({ onLight }: { onLight: boolean }) {
  return (
    <span className="flex items-center gap-1.5">
      <Mark className="size-2" />
      <span className={cn("text-[0.6875rem] font-bold tracking-[-0.02em]", onLight ? "text-ink/70" : "text-white/70")}>
        OnMe
      </span>
    </span>
  );
}
