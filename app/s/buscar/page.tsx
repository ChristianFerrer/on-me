import Link from "next/link";
import { redirect } from "next/navigation";
import { ManualSearch } from "@/components/barista/ManualSearch";
import { Screen } from "@/components/ui/Screen";
import { getDeviceContext } from "@/lib/auth/device";
import { getI18n } from "@/lib/i18n/server";

export default async function BuscarPage() {
  const ctx = await getDeviceContext();
  if (!ctx) redirect("/s");

  const { t } = await getI18n();

  return (
    <Screen tone="ink" className="gap-8">
      <header className="flex items-center justify-between gap-3 pt-2">
        <Link
          href="/s"
          prefetch={false}
          className="text-[0.9375rem] font-medium text-chalk/60 transition-colors hover:text-chalk"
        >
          ← {t.common.back}
        </Link>
        <span className="eyebrow text-chalk/35">{ctx.device.name}</span>
      </header>

      <ManualSearch t={t.barista} />
    </Screen>
  );
}
