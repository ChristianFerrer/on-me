import { cn } from "@/lib/cn";

/** Tintas de la rotativa. Cada sello sale en una y el conjunto parece impreso. */
const INKS = [
  "bg-saffron",
  "bg-tomato",
  "bg-jade",
  "bg-cobalt",
  "bg-fuchsia",
] as const;

/** Desviaciones fijas por índice: un sello a mano nunca cae recto, pero
 *  tienen que ser deterministas o el servidor y el cliente no coinciden. */
const TILT = [-7, 5, -3, 8, -5, 4, -8, 6, -2, 7];

export function StampCard({
  stamps,
  goal,
  className,
  animateLast = false,
}: {
  stamps: number;
  goal: number;
  className?: string;
  /** Da el golpe de tinta al último sello, al volver de la barra. */
  animateLast?: boolean;
}) {
  const cells = Array.from({ length: goal }, (_, i) => i);
  const columns = goal % 5 === 0 ? 5 : goal % 4 === 0 ? 4 : 5;

  return (
    <ul
      className={cn("grid gap-2.5 sm:gap-3", className)}
      style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
    >
      {cells.map((i) => {
        const filled = i < stamps;
        const isLast = i === stamps - 1;
        const isNext = i === stamps;

        if (!filled) {
          return (
            <li
              key={i}
              className={cn(
                "relative aspect-square rounded-full border-2 border-dashed",
                isNext ? "border-ink/45" : "border-ink/20",
              )}
            >
              {isNext ? (
                <span className="absolute inset-1.5 rounded-full border-2 border-dotted border-ink/25" />
              ) : null}
            </li>
          );
        }

        return (
          <li key={i} className="relative aspect-square">
            {/* registro desplazado: la segunda tinta asoma por debajo */}
            <span
              aria-hidden
              className="absolute inset-0 translate-x-[2.5px] translate-y-[2.5px] rounded-full bg-ink/25"
            />
            <span
              className={cn(
                "absolute inset-0 flex items-center justify-center rounded-full border-2 border-ink",
                INKS[i % INKS.length],
                animateLast && isLast && "anim-punch",
              )}
              style={{ transform: `rotate(${TILT[i % TILT.length]}deg)` }}
            >
              <span className="block size-[38%] rounded-full border-2 border-ink" />
            </span>
          </li>
        );
      })}
    </ul>
  );
}
