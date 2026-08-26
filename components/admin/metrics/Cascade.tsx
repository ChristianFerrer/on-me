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
 * vistazo, sin hacer la resta a mano.
 */
export function Cascade({ steps }: { steps: CascadeStepView[] }) {
  const top = Math.max(...steps.map((s) => s.value), 1);

  return (
    <ol className="flex flex-col gap-4">
      {steps.map((step, index) => (
        <li key={step.label}>
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-[0.875rem] font-medium text-chalk/70">{step.label}</span>
            <span className="numeral text-[0.9375rem] font-semibold">
              {step.value}
              {step.drop !== null ? (
                <span className="ml-2 text-chalk/40">−{step.drop}</span>
              ) : null}
            </span>
          </div>
          <p className={"mt-0.5 text-[0.75rem] leading-snug " + (step.alarm ? "text-coral" : "text-chalk/35")}>
            {step.reason}
          </p>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/8">
            <div
              className="h-full rounded-full"
              style={{
                width: `${Math.max((step.value / top) * 100, step.value > 0 ? 2 : 0)}%`,
                background: rampColor(index),
              }}
            />
          </div>
        </li>
      ))}
    </ol>
  );
}
