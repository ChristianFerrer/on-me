import { cn } from "@/lib/cn";

/**
 * Lienzo de una pantalla de cliente. No hay barra de navegación en ningún
 * sitio de OnMe: sin cuentas no hay a dónde navegar, así que cada pantalla
 * ocupa el alto completo y el color puede trabajar sin estorbos.
 */
export function Screen({
  children,
  className,
  tone = "paper",
}: {
  children: React.ReactNode;
  className?: string;
  tone?: "paper" | "ink";
}) {
  return (
    <main
      className={cn(
        "relative mx-auto flex min-h-dvh w-full max-w-[30rem] flex-col",
        "px-5 pt-[max(1.25rem,env(safe-area-inset-top))]",
        "pb-[max(1.5rem,env(safe-area-inset-bottom))]",
        tone === "ink" ? "admin" : "bg-paper text-ink",
        className,
      )}
    >
      {children}
    </main>
  );
}

/** Bloque de papel con registro desplazado. La unidad de composición. */
export function Sheet({
  children,
  className,
  tint,
}: {
  children: React.ReactNode;
  className?: string;
  /** Tinta de la sombra desplazada, para diferenciar bloques de un vistazo. */
  tint?: string;
}) {
  return (
    <section
      className={cn(
        "relative overflow-hidden rounded-[var(--radius-card)] border-2 border-ink",
        tint ? "riso-tint" : "riso",
        className,
      )}
      style={tint ? ({ "--riso-tint": tint } as React.CSSProperties) : undefined}
    >
      {children}
    </section>
  );
}

/** Antetítulo en mono, el conector tipográfico de todo el sistema. */
export function Eyebrow({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <p className={cn("overline text-ink-faint", className)}>{children}</p>
  );
}
