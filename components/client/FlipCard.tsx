"use client";

import { cn } from "@/lib/cn";

/**
 * Giro 3D real -perspective + preserve-3d + backface-visibility-, no un
 * cross-fade: la idea que pidió el cliente es que el propio QR "gire" para
 * enseñar otra cara, así que el giro tiene que leerse como tal.
 *
 * Alto fijo, no `auto`: con las dos caras superpuestas -`absolute inset-0`,
 * necesario para que ambas ocupen el mismo hueco durante el giro- ninguna
 * puede dictar la altura del contenedor por sí sola.
 */
export function FlipCard({
  flipped,
  front,
  back,
  onBackClick,
  className,
}: {
  flipped: boolean;
  front: React.ReactNode;
  back: React.ReactNode;
  /** Tocar la cara trasera vuelve al QR -además del auto-revert por tiempo-. */
  onBackClick?: () => void;
  className?: string;
}) {
  return (
    <div className={cn("relative h-[13.5rem] [perspective:1600px]", className)}>
      <div
        className={cn(
          "relative size-full transition-transform duration-500 ease-out [transform-style:preserve-3d]",
          flipped && "[transform:rotateY(180deg)]",
        )}
      >
        <div className="absolute inset-0 [backface-visibility:hidden]">{front}</div>
        <div
          onClick={onBackClick}
          className="absolute inset-0 [backface-visibility:hidden] [transform:rotateY(180deg)]"
        >
          {back}
        </div>
      </div>
    </div>
  );
}
