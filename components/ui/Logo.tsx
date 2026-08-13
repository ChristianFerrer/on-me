import { cn } from "@/lib/cn";

/**
 * La marca reducida a lo mínimo: un punto y el nombre.
 * El punto es la taza vista desde arriba, y es lo único que lleva color.
 */
export function Mark({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn("block shrink-0 rounded-full bg-lime", className)}
    />
  );
}

export function Logo({
  className,
  size = "md",
  tone = "ink",
}: {
  className?: string;
  size?: "sm" | "md" | "lg";
  tone?: "ink" | "chalk";
}) {
  const type = {
    sm: "text-[1.0625rem]",
    md: "text-[1.25rem]",
    lg: "text-[2rem]",
  }[size];
  const dot = { sm: "size-2", md: "size-2.5", lg: "size-3.5" }[size];

  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      <Mark className={dot} />
      <span
        className={cn(
          "font-bold tracking-[-0.03em]",
          type,
          tone === "ink" ? "text-ink" : "text-chalk",
        )}
      >
        OnMe
      </span>
    </span>
  );
}
