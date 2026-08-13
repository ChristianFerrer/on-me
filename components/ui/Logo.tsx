import { cn } from "@/lib/cn";

/**
 * La marca: un anillo de taza visto desde arriba, impreso en dos tintas
 * con el registro desplazado. Sirve igual de logotipo y de icono de PWA.
 */
export function Mark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" aria-hidden className={cn("shrink-0", className)}>
      <circle cx="25.5" cy="25.5" r="17" className="fill-tomato" />
      <circle
        cx="22.5"
        cy="22.5"
        r="17"
        className="fill-saffron stroke-ink"
        strokeWidth="3"
      />
      <circle
        cx="22.5"
        cy="22.5"
        r="8.5"
        className="fill-none stroke-ink"
        strokeWidth="3"
      />
    </svg>
  );
}

export function Logo({
  className,
  tagline,
  size = "md",
}: {
  className?: string;
  tagline?: string;
  size?: "sm" | "md" | "lg";
}) {
  const type = {
    sm: "text-[1.35rem]",
    md: "text-[1.75rem]",
    lg: "text-[2.5rem]",
  }[size];
  const mark = { sm: "size-6", md: "size-8", lg: "size-11" }[size];

  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <Mark className={mark} />
      <span className="flex items-baseline gap-2">
        <span className={cn("display text-ink", type)}>
          On<span className="text-tomato">Me</span>
        </span>
        {tagline ? (
          <span className="overline text-ink-faint hidden sm:inline">
            {tagline}
          </span>
        ) : null}
      </span>
    </div>
  );
}
