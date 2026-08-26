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
  fullWidth = false,
}: {
  children: React.ReactNode;
  className?: string;
  /** aurora: degradado de cliente · quiet: degradado apagado · ink: degradado nocturno, pantallas de trabajo */
  tone?: "aurora" | "quiet" | "ink";
  /**
   * Sin la cadena de max-w propia -pensada para que la tarjeta móvil crezca
   * por breakpoint, no para el panel de escritorio real-. `cn()` no
   * resuelve utilidades de Tailwind en conflicto -no es tailwind-merge-, así
   * que un className del caller como `md:max-w-none` no le gana a las reglas
   * `lg:`/`xl:` de este propio componente: en la hoja de estilos compilada
   * los breakpoints siempre quedan en orden ascendente sin importar el
   * className recibido, y la última regla de la cascada para esa propiedad
   * es la que gana -`lg:max-w-[40rem]`/`xl:max-w-[44rem]`, no el `md:` del
   * caller-. Cualquier página que necesite otro ancho en escritorio activa
   * `fullWidth` y pone su propio max-w por className, sin ninguna regla de
   * este componente con la que competir.
   */
  fullWidth?: boolean;
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
          "mx-auto flex min-h-dvh w-full flex-col",
          !fullWidth && "max-w-[30rem] sm:max-w-[34rem] lg:max-w-[40rem] xl:max-w-[44rem]",
          "pl-[max(1.25rem,env(safe-area-inset-left))] pr-[max(1.25rem,env(safe-area-inset-right))]",
          "pt-[max(1rem,env(safe-area-inset-top))]",
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
