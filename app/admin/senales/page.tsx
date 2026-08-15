import Link from "next/link";
import { redirect } from "next/navigation";
import { BottomNav } from "@/components/admin/BottomNav";
import { HomeIcon, ShieldIcon } from "@/components/ui/Icons";
import { LangSwitch } from "@/components/ui/LangSwitch";
import { Screen } from "@/components/ui/Screen";
import { getAdminContext } from "@/lib/auth/admin";
import { cn } from "@/lib/cn";
import { loadFunnel } from "@/lib/funnel";
import { getI18n } from "@/lib/i18n/server";

export default async function SignalsPage() {
  const ctx = await getAdminContext();
  if (!ctx) redirect("/admin");

  const { locale, t } = await getI18n();
  const data = await loadFunnel(ctx.shop.id);

  return (
    <Screen tone="ink" className="gap-8 pb-28 lg:max-w-3xl">
      <header className="flex items-center justify-between gap-3 pt-2">
        <div className="flex items-center gap-3">
          <Link
            href="/inicio"
            prefetch={false}
            className="-m-2 p-2 text-chalk/45 transition-colors hover:text-chalk"
            aria-label={t.home.eyebrow}
          >
            <HomeIcon className="size-6" />
          </Link>
          <div>
            <p className="eyebrow text-chalk/35">{ctx.shop.name}</p>
            <h1 className="display mt-1 text-[1.75rem] lg:text-[2rem]">{t.admin.ops}</h1>
          </div>
        </div>
        <LangSwitch locale={locale} tone="chalk" />
      </header>

      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Signal
          label={t.admin.scanTime}
          value={
            data.ops.avgScanMs === null ? "—" : `${(data.ops.avgScanMs / 1000).toFixed(1)} s`
          }
          // El presupuesto son 3 segundos. Por encima, el barista sabotea.
          alarm={data.ops.avgScanMs !== null && data.ops.avgScanMs > 3000}
        />
        <Signal
          label={t.admin.manualRate}
          value={
            data.ops.manualRate === null ? "—" : `${Math.round(data.ops.manualRate * 100)}%`
          }
          alarm={data.ops.manualRate !== null && data.ops.manualRate > 0.15}
        />
        <Signal label={t.admin.expiredInvites} value={String(data.ops.expiredInvites)} />
        <Signal label="scans · 7d" value={String(data.ops.scansLast7Days)} />
      </dl>

      <Link
        href="/privacidad?from=admin"
        className="btn mt-auto items-center gap-2 bg-ink-2 px-6 py-4 text-[1rem] text-chalk ring-1 ring-inset ring-chalk/15"
      >
        <ShieldIcon className="size-5" />
        {t.admin.linksPrivacy}
      </Link>

      <BottomNav t={t.admin} active="senales" />
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
