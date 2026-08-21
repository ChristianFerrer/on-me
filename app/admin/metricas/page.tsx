import Link from "next/link";
import { redirect } from "next/navigation";
import { BottomNav } from "@/components/admin/BottomNav";
import { FunnelBars } from "@/components/admin/FunnelBars";
import { GateCard } from "@/components/admin/GateCard";
import { WaveChart } from "@/components/admin/WaveChart";
import { HomeIcon, ShieldIcon } from "@/components/ui/Icons";
import { Screen } from "@/components/ui/Screen";
import { getAdminContext } from "@/lib/auth/admin";
import { cn } from "@/lib/cn";
import { loadFunnel } from "@/lib/funnel";
import { getI18n } from "@/lib/i18n/server";

/**
 * Métricas, todas juntas: el embudo -conteos brutos, paso a paso-, las tres
 * puertas -esos mismos conteos como ratio y veredicto pasa/no pasa- y las
 * señales de barra. Antes eran dos páginas propias -/admin/embudo y
 * /admin/metricas, que ya se había tragado /admin/senales-; separarlas solo
 * partía en dos una misma pregunta ("¿cómo va el negocio?") sin ganar nada.
 *
 * Las puertas no repiten el numerador/denominador de cada paso -GateCard ya
 * no lo pinta-: esos números están un scroll más arriba, en el propio
 * embudo. La ficha de una puerta añade el ratio y el veredicto, no la
 * cuenta bruta otra vez.
 */
export default async function MetricsPage() {
  const ctx = await getAdminContext();
  if (!ctx) redirect("/admin/constelacion-sol");

  const { t } = await getI18n();
  const data = await loadFunnel(ctx.shop.id);

  return (
    <Screen tone="ink" className="gap-8 pb-28 md:max-w-none md:pb-10 md:pl-72 md:pr-10">
      <header className="flex items-center gap-3 pt-2">
        <Link
          href="/inicio"
          prefetch={false}
          className="-m-2 p-2 text-chalk/45 transition-colors hover:text-chalk md:hidden"
          aria-label={t.home.eyebrow}
        >
          <HomeIcon className="size-6" />
        </Link>
        <div>
          <p className="eyebrow text-chalk/35">{ctx.shop.name}</p>
          <h1 className="display mt-1 text-[1.75rem] md:text-[2rem]">{t.admin.metricsTitle}</h1>
        </div>
      </header>

      <div className="flex flex-col gap-8 lg:grid lg:grid-cols-2 lg:items-start lg:gap-10">
        <div className="flex flex-col gap-8">
          <section className="glass-dark flex flex-col gap-3 p-6">
            <h2 className="eyebrow text-chalk/40">{t.admin.title}</h2>
            <FunnelBars data={data} t={t.admin} />
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="eyebrow text-chalk/40">{t.admin.gates}</h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
              <GateCard gate={data.gates.p1} label={t.admin.gate1} t={t.admin} />
              <GateCard gate={data.gates.p2} label={t.admin.gate2} t={t.admin} />
              <GateCard gate={data.gates.p3} label={t.admin.gate3} t={t.admin} />
            </div>
          </section>
        </div>

        <div className="flex flex-col gap-8">
          <section className="glass-dark flex flex-col gap-5 p-6">
            <h2 className="eyebrow text-chalk/40">{t.admin.trend}</h2>
            <WaveChart label={t.admin.signups} description={t.admin.signupsDesc} points={data.series.signups} accent="var(--color-lime)" />
            <WaveChart label={t.admin.dailyScans} description={t.admin.dailyScansDesc} points={data.series.scans} accent="var(--color-azure)" />
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="eyebrow text-chalk/40">{t.admin.ops}</h2>
            <dl className="grid grid-cols-1 gap-3 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
              <Signal
                label={t.admin.scanTime}
                value={data.ops.avgScanMs === null ? "—" : `${(data.ops.avgScanMs / 1000).toFixed(1)} s`}
                // El presupuesto son 3 segundos. Por encima, el barista sabotea.
                alarm={data.ops.avgScanMs !== null && data.ops.avgScanMs > 3000}
              />
              <Signal
                label={t.admin.manualRate}
                value={data.ops.manualRate === null ? "—" : `${Math.round(data.ops.manualRate * 100)}%`}
                alarm={data.ops.manualRate !== null && data.ops.manualRate > 0.15}
              />
              <Signal label={t.admin.expiredInvites} value={String(data.ops.expiredInvites)} />
            </dl>
          </section>
        </div>
      </div>

      <Link
        href="/privacidad?from=admin"
        className="btn mt-auto items-center gap-2 bg-ink-2 px-6 py-4 text-[1rem] text-chalk ring-1 ring-inset ring-chalk/15 lg:self-start"
      >
        <ShieldIcon className="size-5" />
        {t.admin.linksPrivacy}
      </Link>

      <BottomNav t={t.admin} active="metricas" />
    </Screen>
  );
}

function Signal({ label, value, alarm }: { label: string; value: string; alarm?: boolean }) {
  return (
    <div className={cn("glass-dark rounded-2xl p-5", alarm && "bg-coral/15 ring-1 ring-coral/40")}>
      <dt className="text-[0.8125rem] leading-snug text-chalk/45">{label}</dt>
      <dd className={cn("numeral mt-2 text-[1.375rem] font-semibold", alarm && "text-coral")}>{value}</dd>
    </div>
  );
}
