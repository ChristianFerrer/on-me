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
    <Screen className="gap-6">
      <header className="flex items-center justify-between gap-3">
        <Link href="/s" prefetch={false} className="overline text-ink-faint">
          ← {t.common.back}
        </Link>
        <span className="overline text-ink-faint">{ctx.device.name}</span>
      </header>

      <ManualSearch t={t.barista} />
    </Screen>
  );
}
