import Link from "next/link";
import { redirect } from "next/navigation";
import { BottomNav } from "@/components/admin/BottomNav";
import { UserManager } from "@/components/admin/UserManager";
import { HomeIcon } from "@/components/ui/Icons";
import { Screen } from "@/components/ui/Screen";
import { getAdminContext } from "@/lib/auth/admin";
import { loadShopMembers } from "@/lib/auth/userAdmin";
import { getI18n } from "@/lib/i18n/server";

/**
 * Gestión de admins del local: no es una quinta pestaña del BottomNav -esa
 * barra son "cuatro páginas de verdad", ver BottomNav.tsx-, así que se
 * llega aquí desde el enlace en la cabecera de /admin/dispositivos -el
 * otro sitio del panel donde se da o se quita acceso a algo-, no desde la
 * navegación principal.
 */
export default async function UsersPage() {
  const ctx = await getAdminContext();
  if (!ctx) redirect("/admin/constelacion-sol?session=expired");

  const { locale, t } = await getI18n();

  const header = (
    <header className="flex items-center gap-3 pt-2">
      <Link
        href="/inicio"
        prefetch={false}
        className="-m-2 p-2 text-chalk/45 transition-colors hover:text-chalk nav:hidden"
        aria-label={t.home.eyebrow}
      >
        <HomeIcon className="size-6" />
      </Link>
      <div>
        <p className="eyebrow text-chalk/35">{ctx.shop.name}</p>
        <h1 className="display mt-1 text-[1.75rem]">{t.admin.usersTitle}</h1>
      </div>
      <Link
        href="/admin/dispositivos"
        prefetch={false}
        className="ml-auto text-[0.8125rem] font-medium text-chalk/55 transition-colors hover:text-chalk"
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
        <p className="text-[0.9375rem] text-chalk/55">{t.admin.usersAccessDenied}</p>
        <BottomNav t={t.admin} />
      </Screen>
    );
  }

  const members = await loadShopMembers(ctx.shop.id);

  return (
    <Screen
      tone="ink"
      fullWidth
      className="gap-7 pb-28 md:pb-10 nav:pl-[calc(var(--admin-sidebar-width,16rem)+2rem)] nav:pr-10"
    >
      {header}

      <UserManager t={t.admin} members={members} currentUserId={ctx.userId} locale={locale} />

      <BottomNav t={t.admin} />
    </Screen>
  );
}
