import Link from "next/link";
import { BottomNav } from "@/components/admin/BottomNav";
import { GateCard } from "@/components/admin/GateCard";
import { LoginForm } from "@/components/admin/LoginForm";
import { HomeIcon } from "@/components/ui/Icons";
import { LangSwitch } from "@/components/ui/LangSwitch";
import { Logo } from "@/components/ui/Logo";
import { Screen } from "@/components/ui/Screen";
import { getAdminContext } from "@/lib/auth/admin";
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
          className="-m-2 mt-0 p-2 text-chalk/45 transition-colors hover:text-chalk"
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
            <h1 className="display mt-1 text-[1.75rem] lg:text-[2rem]">{t.admin.gates}</h1>
          </div>
        </div>
        <LangSwitch locale={locale} tone="chalk" />
      </header>

      <section className="flex flex-col gap-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <GateCard gate={data.gates.p1} label={t.admin.gate1} t={t.admin} />
          <GateCard gate={data.gates.p2} label={t.admin.gate2} t={t.admin} />
          <GateCard gate={data.gates.p3} label={t.admin.gate3} t={t.admin} />
        </div>
      </section>

      <BottomNav t={t.admin} active="gates" />
    </Screen>
  );
}
