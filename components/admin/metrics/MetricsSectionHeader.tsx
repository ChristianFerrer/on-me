/**
 * Título de sección -spec §3-: 15px/700, con la pregunta que responde la
 * sección debajo en 12px al 32% de blanco. Sin versalitas -"nada de
 * versalitas sueltas"-, a diferencia del `.eyebrow` que usa el resto de la
 * app para encabezados: aquí el peso hace el trabajo, no el tracking.
 */
export function MetricsSectionHeader({ title, question }: { title: string; question?: string }) {
  return (
    <div>
      <h2 className="text-[15px] font-bold">{title}</h2>
      {question ? <p className="mt-0.5 text-[12px] text-white/32">{question}</p> : null}
    </div>
  );
}
