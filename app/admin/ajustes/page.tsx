import Link from "next/link";
import { redirect } from "next/navigation";
import { BottomNav } from "@/components/admin/BottomNav";
import { ShopSettingsForm } from "@/components/admin/ShopSettingsForm";
import { HomeIcon } from "@/components/ui/Icons";
import { Screen } from "@/components/ui/Screen";
import { getAdminContext } from "@/lib/auth/admin";
import { getI18n } from "@/lib/i18n/server";

/**
 * Ajustes del local: no es una quinta pestaña del BottomNav -esa barra son
 * "cuatro páginas de verdad", ver BottomNav.tsx-, así que se llega aquí
 * desde el enlace en la cabecera de /admin/dispositivos, igual que
 * /admin/usuarios.
 */
export default async function SettingsPage() {
  const ctx = await getAdminContext();
  if (!ctx) redirect("/admin/constelacion-sol?session=expired");

  const { t } = await getI18n();

  const header = (
    <header className="flex items-center gap-3 pt-2">
      <Link
        href="/inicio"
        prefetch={false}
        className="-m-2 p-2 text-on-surface/45 transition-colors hover:text-on-surface nav:hidden"
        aria-label={t.home.eyebrow}
      >
        <HomeIcon className="size-6" />
      </Link>
      <div>
        <p className="eyebrow text-on-surface/35">{ctx.shop.name}</p>
        <h1 className="display mt-1 text-[1.75rem]">{t.admin.settingsTitle}</h1>
      </div>
      <Link
        href="/admin/dispositivos"
        prefetch={false}
        className="ml-auto text-[0.8125rem] font-medium text-on-surface/55 transition-colors hover:text-on-surface"
      >
        {t.admin.devices}
      </Link>
    </header>
  );

  if (ctx.role !== "owner") {
    return (
      <Screen
        tone="ink"
        fullWidth
        className="gap-7 pb-28 md:pb-10 nav:pl-[calc(var(--admin-sidebar-width,16rem)+2rem)] nav:pr-10"
      >
        {header}
        <p className="text-[0.9375rem] text-on-surface/55">{t.admin.settingsAccessDenied}</p>
        <BottomNav t={t.admin} email={ctx.email} />
      </Screen>
    );
  }

  return (
    <Screen
      tone="ink"
      fullWidth
      className="gap-7 pb-28 md:pb-10 nav:pl-[calc(var(--admin-sidebar-width,16rem)+2rem)] nav:pr-10"
    >
      {header}

      <ShopSettingsForm
        t={t.admin}
        maxStampsPerScan={ctx.shop.max_stamps_per_scan}
        theme={ctx.shop.theme}
        cardStyle={ctx.shop.card_style}
        defaultLocale={ctx.shop.default_locale}
        logoUrl={ctx.shop.logo_url}
      />

      <BottomNav t={t.admin} email={ctx.email} />
    </Screen>
  );
}
