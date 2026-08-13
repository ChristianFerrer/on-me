import type { FunnelData } from "@/lib/funnel";
import type { Dict } from "@/lib/i18n";

type AdminDict = Dict["admin"];

/**
 * El embudo, de arriba abajo. Las barras se escalan contra el primer peldaño,
 * así que la caída entre etapas se ve sin leer un solo número — que es de lo
 * que va el piloto.
 */
export function FunnelBars({ data, t }: { data: FunnelData; t: AdminDict }) {
  const steps = [
    { label: t.signups, value: data.signups, ink: "bg-saffron" },
    { label: t.cards, value: data.cards, ink: "bg-tomato" },
    { label: t.sent, value: data.sent, ink: "bg-fuchsia" },
    { label: t.opened, value: data.opened, ink: "bg-cobalt" },
    { label: t.redeemed, value: data.redeemed, ink: "bg-jade" },
    { label: t.returns, value: data.returns, ink: "bg-paper" },
  ];

  const top = Math.max(...steps.map((step) => step.value), 1);

  return (
    <ul className="flex flex-col gap-3">
      {steps.map((step) => (
        <li key={step.label}>
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-[0.9rem] font-semibold text-paper/80">
              {step.label}
            </span>
            <span className="numeral text-[1.05rem] font-semibold">
              {step.value}
            </span>
          </div>
          <div className="mt-1.5 h-3.5 w-full overflow-hidden rounded-full border-2 border-paper/20">
            <div
              className={`h-full rounded-full ${step.ink}`}
              style={{ width: `${Math.max((step.value / top) * 100, step.value > 0 ? 4 : 0)}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
