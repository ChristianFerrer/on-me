import { cn } from "@/lib/cn";

/**
 * Lienzo de una pantalla. Cliente y barra siguen sin tener a dónde navegar
 * —cada una es un destino, no una sección de una app más grande—, así que
 * ocupan el alto completo y el degradado trabaja sin estorbos.
 *
 * El ancho crece por *breakpoint*, no se queda fijo en el tamaño de móvil:
 * en tablet u ordenador la tarjeta respira en vez de flotar diminuta en
 * medio de la pantalla.
 */
export function Screen({
  children,
  className,
  tone = "aurora",
}: {
  children: React.ReactNode;
  className?: string;
  /** aurora: degradado de cliente · quiet: degradado apagado · ink: degradado nocturno, pantallas de trabajo */
  tone?: "aurora" | "quiet" | "ink";
}) {
  const skin = {
    aurora: "aurora text-ink",
    quiet: "aurora-quiet text-ink",
    ink: "aurora-night text-chalk",
  }[tone];

  return (
    <div className={cn("min-h-dvh w-full", skin)}>
      <main
        className={cn(
          "mx-auto flex min-h-dvh w-full max-w-[30rem] flex-col sm:max-w-[34rem] lg:max-w-[38rem]",
          "px-5 pt-[max(1rem,env(safe-area-inset-top))]",
          "pb-[max(1.5rem,env(safe-area-inset-bottom))]",
          className,
        )}
      >
        {children}
      </main>
    </div>
  );
}

/** Superficie de grafito: la unidad de composición sobre el degradado. */
export function Slab({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <section className={cn("slab", className)}>{children}</section>;
}

/** Superficie de vidrio: se apoya en el degradado en vez de taparlo. */
export function Glass({
  children,
  className,
  tone = "light",
}: {
  children: React.ReactNode;
  className?: string;
  tone?: "light" | "dark";
}) {
  return (
    <section className={cn(tone === "light" ? "glass" : "glass-dark", className)}>
      {children}
    </section>
  );
}

export function Eyebrow({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <p className={cn("eyebrow text-ink/45", className)}>{children}</p>;
}
