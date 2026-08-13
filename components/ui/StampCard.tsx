import { cn } from "@/lib/cn";

/**
 * Los sellos, en una sola fila.
 *
 * Una fila se lee de un vistazo como una barra de progreso; una cuadrícula
 * obliga a contar. El sello es un punto lleno y lo que falta es un aro fino:
 * no hace falta nada más para saber cuánto queda.
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
    <ul className={cn("flex items-center gap-[max(0.4rem,1.6%)]", className)}>
      {Array.from({ length: goal }, (_, i) => {
        const filled = i < stamps;
        const next = i === stamps;

        return (
          <li
            key={i}
            className={cn(
              "aspect-square min-w-0 flex-1 rounded-full transition-colors",
              filled
                ? tone === "dark"
                  ? "bg-lime"
                  : "bg-ink"
                : tone === "dark"
                  ? "border border-white/20"
                  : "border border-ink/20",
              next && (tone === "dark" ? "border-lime/60" : "border-ink/45"),
            )}
          />
        );
      })}
    </ul>
  );
}
