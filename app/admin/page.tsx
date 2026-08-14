import Link from "next/link";
import { AdminNav } from "@/components/admin/AdminNav";
import { FunnelBars } from "@/components/admin/FunnelBars";
import { GateCard } from "@/components/admin/GateCard";
import { LoginForm } from "@/components/admin/LoginForm";
import { WaveChart } from "@/components/admin/WaveChart";
import { ChartIcon, HomeIcon, ShieldIcon } from "@/components/ui/Icons";
import { LangSwitch } from "@/components/ui/LangSwitch";
import { Logo } from "@/components/ui/Logo";
import { Screen } from "@/components/ui/Screen";
import { getAdminContext } from "@/lib/auth/admin";
import { cn } from "@/lib/cn";
import { loadFunnel } from "@/lib/funnel";
import { getI18n } from "@/lib/i18n/server";

export default async function AdminPage() {
  const { locale, t } = await getI18n();
  const ctx = await getAdminContext();

  if (!ctx) {
    return (
      <Screen tone="ink" className="gap-8">
        <Link
          href="/inicio"
          prefetch={false}
          className="pt-2 text-chalk/45 transition-colors hover:text-chalk"
          aria-label={t.home.eyebrow}
        >
          <HomeIcon className="size-6" />
        </Link>
        <div className="flex flex-1 flex-col items-center justify-center gap-8">
          <Logo size="lg" tone="chalk" />
          <LoginForm t={t.admin} />
        </div>
      </Screen>
    );
  }

  const data = await loadFunnel(ctx.shop.id);

  return (
    <Screen
      tone="ink"
      className="max-w-[30rem] gap-8 pb-10 lg:max-w-5xl lg:px-10"
    >
      <header className="flex items-center justify-between gap-3 pt-2">
        <div className="flex items-center gap-3">
          <Link
            href="/inicio"
            prefetch={false}
            className="text-chalk/45 transition-colors hover:text-chalk"
            aria-label={t.home.eyebrow}
          >
            <HomeIcon className="size-6" />
          </Link>
          <div>
            <p className="eyebrow text-chalk/35">{ctx.shop.name}</p>
            <h1 className="display mt-1 text-[1.75rem] lg:text-[2rem]">{t.admin.title}</h1>
          </div>
        </div>
        <LangSwitch locale={locale} tone="chalk" />
      </header>

      <AdminNav t={t.admin} />

      <section id="gates" className="scroll-mt-4 flex flex-col gap-3">
        <p className="eyebrow text-chalk/35">{t.admin.gates}</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <GateCard gate={data.gates.p1} label={t.admin.gate1} t={t.admin} />
          <GateCard gate={data.gates.p2} label={t.admin.gate2} t={t.admin} />
          <GateCard gate={data.gates.p3} label={t.admin.gate3} t={t.admin} />
        </div>
      </section>

      <div id="embudo" className="scroll-mt-4 grid grid-cols-1 gap-6 lg:grid-cols-2 lg:items-start">
        <section className="rounded-[var(--radius-card)] bg-ink p-6">
          <p className="eyebrow flex items-center gap-2 text-chalk/35">
            <ChartIcon className="size-4" />
            {t.admin.title}
          </p>
          <div className="mt-4">
            <FunnelBars data={data} t={t.admin} />
          </div>
        </section>

        <section className="flex flex-col gap-5 rounded-[var(--radius-card)] bg-ink p-6">
          <WaveChart label={t.admin.signups} points={data.series.signups} accent="var(--color-lime)" />
          <WaveChart label={t.admin.dailyScans} points={data.series.scans} accent="var(--color-azure)" />
        </section>
      </div>

      <section id="senales" className="scroll-mt-4">
        <p className="eyebrow text-chalk/35">{t.admin.ops}</p>
        <dl className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Signal
            label={t.admin.scanTime}
            value={
              data.ops.avgScanMs === null
                ? "—"
                : `${(data.ops.avgScanMs / 1000).toFixed(1)} s`
            }
            // El presupuesto son 3 segundos. Por encima, el barista sabotea.
            alarm={data.ops.avgScanMs !== null && data.ops.avgScanMs > 3000}
          />
          <Signal
            label={t.admin.manualRate}
            value={
              data.ops.manualRate === null
                ? "—"
                : `${Math.round(data.ops.manualRate * 100)}%`
            }
            alarm={data.ops.manualRate !== null && data.ops.manualRate > 0.15}
          />
          <Signal
            label={t.admin.expiredInvites}
            value={String(data.ops.expiredInvites)}
          />
          <Signal label="scans · 7d" value={String(data.ops.scansLast7Days)} />
        </dl>
      </section>

      <Link
        href="/privacidad?from=admin"
        className="btn mt-auto items-center gap-2 bg-ink-2 px-6 py-4 text-[1rem] text-chalk ring-1 ring-inset ring-chalk/15"
      >
        <ShieldIcon className="size-5" />
        {t.admin.linksPrivacy}
      </Link>
    </Screen>
  );
}

function Signal({
  label,
  value,
  alarm,
}: {
  label: string;
  value: string;
  alarm?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl p-5",
        alarm ? "bg-coral/15 ring-1 ring-coral/40" : "bg-ink",
      )}
    >
      <dt className="text-[0.8125rem] leading-snug text-chalk/45">{label}</dt>
      <dd
        className={cn(
          "numeral mt-2 text-[1.375rem] font-semibold",
          alarm && "text-coral",
        )}
      >
        {value}
      </dd>
    </div>
  );
}
