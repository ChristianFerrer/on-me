import Link from "next/link";
import { ConstelacionMap } from "@/components/admin/ConstelacionMap";
import { LoginForm } from "@/components/admin/LoginForm";
import { HomeIcon } from "@/components/ui/Icons";
import { Logo } from "@/components/ui/Logo";
import { Screen } from "@/components/ui/Screen";
import { getAdminContext } from "@/lib/auth/admin";
import { loadRealGiftGraph } from "@/lib/giftGraph/loadRealGiftGraph";
import { getI18n } from "@/lib/i18n/server";

/**
 * La constelación es ahora la portada del panel: lo primero que ve el
 * dueño al entrar. Las puertas y las señales -lo que antes vivía aquí-
 * se juntaron en /admin/metricas, alcanzable desde la barra inferior de
 * cualquier otra pantalla del panel; esta, a pantalla completa, se queda
 * sin esa barra a propósito, igual que ya hacía antes en
 * /admin/atribuciones/mapa -era "una exploración, no una tarjeta más".
 */
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

  const graph = await loadRealGiftGraph(ctx.shop.id, ctx.shop.name);

  return (
    <ConstelacionMap
      graph={graph}
      shopName={ctx.shop.name}
      stampsGoal={ctx.shop.stamps_goal}
      returnWindowDays={ctx.shop.return_window_days}
      locale={locale}
      t={t}
    />
  );
}
