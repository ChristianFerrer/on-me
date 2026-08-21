import type { FunnelData } from "@/lib/funnel";
import type { Dict } from "@/lib/i18n";

type AdminDict = Dict["admin"];

/**
 * El embudo, de arriba abajo. Las barras se escalan contra el primer peldaño,
 * así que la caída entre etapas se ve sin leer un solo número — que es de lo
 * que va el piloto.
 *
 * Un solo color: aquí lo que informa es la longitud, no el tono.
 */
export function FunnelBars({ data, t }: { data: FunnelData; t: AdminDict }) {
  const steps = [
    { label: t.signups, description: t.signupsDesc, value: data.signups },
    { label: t.cards, description: t.cardsDesc, value: data.cards },
    { label: t.sent, description: t.sentDesc, value: data.sent },
    { label: t.opened, description: t.openedDesc, value: data.opened },
    { label: t.redeemed, description: t.redeemedDesc, value: data.redeemed },
    { label: t.returns, description: t.returnsDesc, value: data.returns },
  ];

  const top = Math.max(...steps.map((step) => step.value), 1);

  return (
    <ul className="flex flex-col gap-4">
      {steps.map((step, index) => (
        <li key={step.label}>
          {index === 2 ? (
            // A partir de aquí las barras miden invitaciones de terceros, no
            // clientes propios como las dos primeras: sin este rótulo, la
            // caída de "tarjetas completadas" a "invitaciones enviadas" se
            // lee como abandono, cuando en realidad es un cambio de unidad.
            <p className="mb-3 mt-1 eyebrow text-chalk/35">
              {t.funnelInvitesLabel}
            </p>
          ) : null}
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-[0.875rem] font-medium text-chalk/65">
              {step.label}
            </span>
            <span className="numeral text-[0.9375rem] font-semibold">
              {step.value}
            </span>
          </div>
          <p className="mt-0.5 text-[0.75rem] leading-snug text-chalk/35">{step.description}</p>
          <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-white/8">
            <div
              className={index === steps.length - 1 ? "h-full bg-lime" : "h-full bg-chalk/70"}
              style={{
                width: `${Math.max((step.value / top) * 100, step.value > 0 ? 2 : 0)}%`,
              }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
