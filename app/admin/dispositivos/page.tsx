import Link from "next/link";
import { redirect } from "next/navigation";
import { DeviceManager } from "@/components/admin/DeviceManager";
import { ArrowLeftIcon } from "@/components/ui/Icons";
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
    <Screen tone="ink" className="gap-7 pb-10">
      <header className="flex items-center justify-between gap-3 pt-2">
        <Link
          href="/admin"
          prefetch={false}
          className="flex items-center gap-1.5 text-[0.9375rem] font-medium text-chalk/60 transition-colors hover:text-chalk"
        >
          <ArrowLeftIcon className="size-4" />
          {t.common.back}
        </Link>
        <span className="numeral text-[0.8125rem] text-chalk/35">{devices.length}</span>
      </header>

      <h1 className="display text-[1.75rem]">{t.admin.devices}</h1>

      <DeviceManager t={t.admin} devices={devices} baseUrl={env.baseUrl} locale={locale} />
    </Screen>
  );
}
