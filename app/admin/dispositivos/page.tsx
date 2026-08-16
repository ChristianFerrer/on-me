import Link from "next/link";
import { redirect } from "next/navigation";
import { BottomNav } from "@/components/admin/BottomNav";
import { DeviceManager } from "@/components/admin/DeviceManager";
import { HomeIcon } from "@/components/ui/Icons";
import { Screen } from "@/components/ui/Screen";
import { getAdminContext } from "@/lib/auth/admin";
import { loadDevices } from "@/lib/devices";
import { env } from "@/lib/env";
import { getI18n } from "@/lib/i18n/server";

export default async function DevicesPage() {
  const ctx = await getAdminContext();
  if (!ctx) redirect("/admin");

  const { locale, t } = await getI18n();
  const devices = await loadDevices(ctx.shop.id);

  return (
    <Screen tone="ink" className="gap-7 pb-28 lg:max-w-3xl">
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
          <h1 className="display mt-1 text-[1.75rem]">{t.admin.devices}</h1>
        </div>
      </header>

      <DeviceManager t={t.admin} devices={devices} baseUrl={env.baseUrl} locale={locale} />

      <BottomNav t={t.admin} active="dispositivos" />
    </Screen>
  );
}
