import Link from "next/link";
import { FunnelBars } from "@/components/admin/FunnelBars";
import { GateCard } from "@/components/admin/GateCard";
import { LoginForm } from "@/components/admin/LoginForm";
import { LangSwitch } from "@/components/ui/LangSwitch";
import { Logo } from "@/components/ui/Logo";
import { Screen, Sheet } from "@/components/ui/Screen";
import { getAdminContext } from "@/lib/auth/admin";
import { loadFunnel } from "@/lib/funnel";
import { getI18n } from "@/lib/i18n/server";

export default async function AdminPage() {
  const { locale, t } = await getI18n();
  const ctx = await getAdminContext();

  if (!ctx) {
    return (
      <Screen tone="ink" className="justify-center gap-7">
        <Logo size="lg" />
        <LoginForm t={t.admin} />
      </Screen>
    );
  }

  const data = await loadFunnel(ctx.shop.id);

  return (
    <Screen tone="ink" className="gap-6 pb-10">
      <header className="flex items-center justify-between gap-3">
        <div>
          <p className="overline text-paper/50">{ctx.shop.name}</p>
          <h1 className="display text-[2rem] text-paper">{t.admin.title}</h1>
        </div>
        <LangSwitch locale={locale} label={t.common.switchTo} tone="paper" />
      </header>

      <section className="flex flex-col gap-3">
        <p className="overline text-paper/50">{t.admin.gates}</p>
        <GateCard gate={data.gates.p1} label={t.admin.gate1} t={t.admin} />
        <GateCard gate={data.gates.p2} label={t.admin.gate2} t={t.admin} />
        <GateCard gate={data.gates.p3} label={t.admin.gate3} t={t.admin} />
      </section>

      <Sheet className="border-paper/20 bg-transparent p-5 shadow-none">
        <FunnelBars data={data} t={t.admin} />
      </Sheet>

      <section>
        <p className="overline text-paper/50">{t.admin.ops}</p>
        <dl className="mt-3 grid grid-cols-2 gap-3">
          <Signal
            label={t.admin.scanTime}
            value={data.ops.avgScanMs === null ? "—" : `${(data.ops.avgScanMs / 1000).toFixed(1)} s`}
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
          <Signal label={t.admin.expiredInvites} value={String(data.ops.expiredInvites)} />
          <Signal label="scans · 7d" value={String(data.ops.scansLast7Days)} />
        </dl>
      </section>

      <Link
        href="/admin/atribuciones"
        className="riso btn-press mt-auto inline-flex w-full items-center justify-center rounded-2xl border-2 border-ink bg-saffron px-6 py-4 font-semibold text-ink"
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
      className={`rounded-2xl border-2 p-4 ${
        alarm ? "border-tomato bg-tomato/15" : "border-paper/20"
      }`}
    >
      <dt className="text-[0.8rem] leading-snug text-paper/60">{label}</dt>
      <dd className="numeral mt-1.5 text-[1.5rem] font-semibold">{value}</dd>
    </div>
  );
}
