import { cn } from "@/lib/cn";

/**
 * Los sellos, en una cuadrícula que envuelve sola.
 *
 * `auto-fit`/`minmax` en vez de una fila `flex-1` fija: antes los círculos
 * se encogían lo que hiciera falta para caber siempre en una sola fila -con
 * tarjetas largas (goal > 8) quedaban minúsculos-. Con un mínimo generoso
 * por círculo, el propio grid decide cuántos caben por fila y pasa a una
 * segunda -o tercera- fila sola cuando no caben más, sin que haga falta
 * calcular nada por `goal`.
 */
export function StampCard({
  stamps,
  goal,
  className,
  tone = "light",
}: {
  stamps: number;
  goal: number;
  className?: string;
  tone?: "light" | "dark";
}) {
  return (
    <ul
      className={cn(
        "grid grid-cols-[repeat(auto-fit,minmax(2.75rem,1fr))] gap-2.5",
        className,
      )}
    >
      {Array.from({ length: goal }, (_, i) => {
        const filled = i < stamps;
        const next = i === stamps;

        return (
          <li
            key={i}
            className={cn(
              "numeral flex aspect-square items-center justify-center rounded-full text-[clamp(0.8125rem,3.2vw,1.125rem)] font-semibold transition-colors",
              filled
                ? tone === "dark"
                  ? "bg-lime text-ink"
                  : "bg-ink text-chalk"
                : tone === "dark"
                  ? "border border-white/20 text-chalk/35"
                  : "border border-ink/20 text-ink/35",
              next && (tone === "dark" ? "border-lime/60" : "border-ink/45"),
            )}
          >
            {i + 1}
          </li>
        );
      })}
    </ul>
  );
}
