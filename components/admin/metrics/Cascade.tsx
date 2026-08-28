import { rampColor } from "@/components/admin/metrics/palette";

export type CascadeStepView = {
  label: string;
  value: number;
  /** null en el primer escalón -no hay caída que mostrar todavía-. */
  drop: number | null;
  reason: string;
  alarm?: boolean;
};

/**
 * Seis escalones, barra proporcional al primero: la caída se lee de un
 * vistazo, sin hacer la resta a mano. Tracks de 30px con el número dentro
 * -spec §7.2, no la línea de 1.5px de antes-: el propio valor viaja sobre
 * el relleno en vez de al lado, así la barra ya no es solo decorativa.
 *
 * `mix-blend-mode: difference` en vez de elegir un color de texto fijo: el
 * relleno recorre toda la rampa -de gris a lima- y también hay tramo sin
 * rellenar -casi negro-, así que ningún color de texto único lee bien sobre
 * los dos extremos a la vez. Con difference sobre blanco el número se
 * invierte solo contra lo que tenga detrás y siempre queda legible, sin
 * lógica de contraste por color.
 */
export function Cascade({ steps }: { steps: CascadeStepView[] }) {
  const top = Math.max(...steps.map((s) => s.value), 1);

  return (
    <ol className="flex flex-col gap-4">
      {steps.map((step, index) => (
        <li key={step.label}>
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-[0.875rem] font-medium text-chalk/70">{step.label}</span>
            {step.drop !== null ? (
              <span className="numeral text-[0.8125rem] text-chalk/40">−{step.drop}</span>
            ) : null}
          </div>
          <div className="relative mt-2 h-[30px] w-full overflow-hidden rounded-[8px] bg-white/8">
            <div
              className="h-full rounded-[8px]"
              style={{
                width: `${Math.max((step.value / top) * 100, step.value > 0 ? 2 : 0)}%`,
                background: rampColor(index),
              }}
            />
            <span className="numeral absolute inset-y-0 left-3 flex items-center text-[0.8125rem] font-bold text-white mix-blend-difference">
              {step.value}
            </span>
          </div>
          <p className={"mt-1.5 text-[0.75rem] leading-snug " + (step.alarm ? "text-coral" : "text-chalk/35")}>
            {step.reason}
          </p>
        </li>
      ))}
    </ol>
  );
}
