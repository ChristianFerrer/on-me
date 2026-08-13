import Link from "next/link";
import { FunnelBars } from "@/components/admin/FunnelBars";
import { GateCard } from "@/components/admin/GateCard";
import { LoginForm } from "@/components/admin/LoginForm";
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
      <Screen tone="ink" className="justify-center gap-8">
        <Logo size="lg" tone="chalk" />
        <LoginForm t={t.admin} />
      </Screen>
    );
  }

  const data = await loadFunnel(ctx.shop.id);

  return (
    <Screen tone="ink" className="gap-8 pb-10">
      <header className="flex items-center justify-between gap-3 pt-2">
        <div>
          <p className="eyebrow text-chalk/35">{ctx.shop.name}</p>
          <h1 className="display mt-1.5 text-[1.75rem]">{t.admin.title}</h1>
        </div>
        <LangSwitch locale={locale} tone="chalk" />
      </header>

      <section className="flex flex-col gap-3">
        <p className="eyebrow text-chalk/35">{t.admin.gates}</p>
        <GateCard gate={data.gates.p1} label={t.admin.gate1} t={t.admin} />
        <GateCard gate={data.gates.p2} label={t.admin.gate2} t={t.admin} />
        <GateCard gate={data.gates.p3} label={t.admin.gate3} t={t.admin} />
      </section>

      <section className="rounded-[var(--radius-card)] bg-ink p-6">
        <FunnelBars data={data} t={t.admin} />
      </section>

      <section>
        <p className="eyebrow text-chalk/35">{t.admin.ops}</p>
        <dl className="mt-3 grid grid-cols-2 gap-3">
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
        href="/admin/atribuciones"
        className="btn mt-auto w-full bg-lime px-6 py-4 text-[1rem] text-ink"
      >
        {t.admin.attributions} →
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
