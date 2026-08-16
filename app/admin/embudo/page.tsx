import Link from "next/link";
import { redirect } from "next/navigation";
import { BottomNav } from "@/components/admin/BottomNav";
import { FunnelBars } from "@/components/admin/FunnelBars";
import { WaveChart } from "@/components/admin/WaveChart";
import { HomeIcon } from "@/components/ui/Icons";
import { Screen } from "@/components/ui/Screen";
import { getAdminContext } from "@/lib/auth/admin";
import { loadFunnel } from "@/lib/funnel";
import { getI18n } from "@/lib/i18n/server";

export default async function FunnelPage() {
  const ctx = await getAdminContext();
  if (!ctx) redirect("/admin");

  const { t } = await getI18n();
  const data = await loadFunnel(ctx.shop.id);

  return (
    <Screen tone="ink" className="gap-8 pb-28 lg:max-w-5xl">
      <header className="flex items-center gap-3 pt-2">
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
          <h1 className="display mt-1 text-[1.75rem] lg:text-[2rem]">{t.admin.title}</h1>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 lg:items-start">
        <section className="rounded-[var(--radius-card)] bg-ink p-6">
          <div className="mt-1">
            <FunnelBars data={data} t={t.admin} />
          </div>
        </section>

        <section className="flex flex-col gap-5 rounded-[var(--radius-card)] bg-ink p-6">
          <WaveChart label={t.admin.signups} description={t.admin.signupsDesc} points={data.series.signups} accent="var(--color-lime)" />
          <WaveChart label={t.admin.dailyScans} description={t.admin.dailyScansDesc} points={data.series.scans} accent="var(--color-azure)" />
        </section>
      </div>

      <BottomNav t={t.admin} active="embudo" />
    </Screen>
  );
}
