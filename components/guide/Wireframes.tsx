import { cn } from "@/lib/cn";

/**
 * Maquetas esquemáticas de las pantallas reales de la app -para
 * /como-funciona-, no capturas: bloques y formas que recuerdan a cada
 * pantalla (la fila de sellos, el visor del escáner, el mapa radial...) sin
 * reproducir texto real, así que no hay que mantenerlas sincronizadas con
 * cada cambio de copy. El tono del propio marco -claro o "ink"- imita el
 * fondo real de esa pantalla: las de cliente son claras, las de mostrador y
 * panel son oscuras, igual que en la app.
 */
export function PhoneFrame({
  tone,
  caption,
  children,
}: {
  tone: "aurora" | "ink";
  caption: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex w-[5.5rem] shrink-0 flex-col items-center gap-2 sm:w-24">
      <div
        className={cn(
          "flex aspect-[9/18.5] w-full flex-col gap-1 overflow-hidden rounded-[1.15rem] border p-1.5",
          tone === "aurora" ? "aurora border-ink/20" : "aurora-night border-white/15",
        )}
      >
        {children}
      </div>
      <p className="text-center text-[0.6875rem] font-medium leading-tight text-chalk/55">{caption}</p>
    </div>
  );
}

/** Flecha fina entre dos marcos de teléfono, para leer la tira como secuencia. */
export function FlowArrow() {
  return (
    <svg viewBox="0 0 16 10" className="h-2.5 w-4 shrink-0 self-center text-chalk/25" aria-hidden>
      <path d="M0 5h13M9 1l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Fila de campos + botón: alta, invitación aceptada, login. */
export function WfForm() {
  return (
    <div className="flex flex-1 flex-col justify-center gap-1 px-0.5">
      <div className="h-1.5 w-3/5 rounded-full bg-ink/25" />
      <div className="mt-1 h-2.5 rounded-md bg-white/70" />
      <div className="h-2.5 rounded-md bg-white/70" />
      <div className="mt-1 h-2.5 rounded-md bg-lime" />
    </div>
  );
}

/** Fila horizontal de sellos, como StampCard: círculos llenos y en blanco. */
export function WfStampCard({ filled = 4, total = 8 }: { filled?: number; total?: number }) {
  return (
    <div className="flex flex-1 flex-col justify-center gap-1.5 px-0.5">
      <div className="h-1.5 w-2/5 rounded-full bg-ink/25" />
      <div className="mt-1 flex flex-wrap gap-[3px]">
        {Array.from({ length: total }, (_, i) => (
          <span
            key={i}
            className={cn(
              "size-2.5 rounded-full",
              i < filled ? "bg-lime" : "border border-ink/30 bg-transparent",
            )}
          />
        ))}
      </div>
    </div>
  );
}

/** Cuadrado blanco con retícula, como el QR mostrado al barista. */
export function WfQr() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-1.5">
      <div className="grid size-11 grid-cols-4 grid-rows-4 gap-[2px] rounded-sm bg-white p-1">
        {[1, 1, 0, 1, 0, 1, 1, 0, 1, 0, 0, 1, 1, 1, 0, 1].map((on, i) => (
          <span key={i} className={cn("rounded-[1px]", on ? "bg-ink" : "bg-transparent")} />
        ))}
      </div>
    </div>
  );
}

/** Botón grande + líneas de texto: invitar, enviar. */
export function WfInvite() {
  return (
    <div className="flex flex-1 flex-col justify-center gap-1.5 px-0.5">
      <div className="h-1.5 w-3/5 rounded-full bg-ink/25" />
      <div className="h-1.25 w-4/5 rounded-full bg-ink/15" />
      <div className="mt-1.5 flex items-center justify-center rounded-full bg-lime py-2">
        <span className="h-1.5 w-8 rounded-full bg-ink/50" />
      </div>
    </div>
  );
}

/** Visor de cámara con esquinas de escaneo, como Scanner. */
export function WfScanner() {
  return (
    <div className="relative flex flex-1 items-center justify-center">
      <div className="relative size-11">
        {[
          "left-0 top-0 border-l border-t",
          "right-0 top-0 border-r border-t",
          "left-0 bottom-0 border-l border-b",
          "right-0 bottom-0 border-r border-b",
        ].map((pos) => (
          <span key={pos} className={cn("absolute size-3 rounded-[2px] border-lime", pos)} />
        ))}
        <span className="absolute inset-x-1 top-1/2 h-px -translate-y-1/2 bg-lime/70" />
      </div>
    </div>
  );
}

const VERDICT_TONE: Record<"lime" | "amber" | "azure" | "coral" | "slate", string> = {
  lime: "bg-lime text-ink",
  amber: "bg-amber text-ink",
  azure: "bg-azure text-ink",
  coral: "bg-coral text-ink",
  slate: "bg-slate text-chalk",
};

/** Bloque de color plano a pantalla completa, como Verdict. */
export function WfVerdict({ tone }: { tone: keyof typeof VERDICT_TONE }) {
  return (
    <div className={cn("-m-1.5 flex flex-1 flex-col items-center justify-center gap-1.5 rounded-[0.9rem]", VERDICT_TONE[tone])}>
      <span className="size-6 rounded-full border-2 border-current opacity-70" />
      <span className="h-1.5 w-8 rounded-full bg-current opacity-70" />
    </div>
  );
}

/** Filas cortas apiladas: resultados de búsqueda, dispositivos, visitas. */
export function WfList({ rows = 3 }: { rows?: number }) {
  return (
    <div className="flex flex-1 flex-col justify-center gap-1 px-0.5">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-1 rounded-sm bg-white/8 px-1 py-1">
          <span className="size-1.5 shrink-0 rounded-full bg-lime/70" />
          <span className="h-1.25 flex-1 rounded-full bg-white/25" />
        </div>
      ))}
    </div>
  );
}

/** Punto central con líneas radiando a puntos más pequeños, como la constelación. */
export function WfMap() {
  const points = [
    [18, 8], [34, 16], [40, 30], [30, 42], [14, 40], [6, 26],
  ];
  return (
    <div className="flex flex-1 items-center justify-center">
      <svg viewBox="0 0 44 48" className="size-11" aria-hidden>
        {points.map(([x, y], i) => (
          <line key={i} x1={22} y1={24} x2={x} y2={y} stroke="rgba(255,255,255,.25)" strokeWidth="0.75" />
        ))}
        {points.map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r={i % 2 === 0 ? 2 : 1.4} fill="var(--color-lime)" opacity={0.85} />
        ))}
        <circle cx={22} cy={24} r={3.5} fill="var(--color-lime)" />
      </svg>
    </div>
  );
}

/** Rejilla de mini-tarjetas KPI, como el dashboard de métricas. */
export function WfDashboard() {
  return (
    <div className="grid flex-1 grid-cols-2 gap-1 px-0.5">
      {[0.75, 0.4, 0.9, 0.55].map((h, i) => (
        <div key={i} className="flex flex-col justify-end gap-0.5 rounded-sm bg-white/8 p-1">
          <span className="h-1 w-3/5 rounded-full bg-white/25" />
          <span className="rounded-sm bg-lime/80" style={{ height: `${h * 0.9}rem` }} />
        </div>
      ))}
    </div>
  );
}

/** Tira horizontal de marcos de teléfono conectados por flechas, con scroll en móvil. */
export function WireframeStrip({ children }: { children: React.ReactNode }) {
  return (
    <div className="scrollbar-hidden flex items-center gap-2 overflow-x-auto pb-3">{children}</div>
  );
}
