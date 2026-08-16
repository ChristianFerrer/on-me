import Link from "next/link";
import { Scanner } from "@/components/barista/Scanner";
import { HomeIcon } from "@/components/ui/Icons";
import { Logo } from "@/components/ui/Logo";
import { Screen, Slab } from "@/components/ui/Screen";
import { getDeviceContext, pinRequired } from "@/lib/auth/device";
import { getI18n } from "@/lib/i18n/server";

export default async function BaristaPage() {
  const { t } = await getI18n();
  const ctx = await getDeviceContext();

  if (!ctx) return <NotEnrolled home={t.home.eyebrow} />;

  return (
    <Scanner
      t={t.barista}
      shopName={ctx.shop.name}
      deviceName={ctx.device.name}
      pinRequired={pinRequired(ctx.device)}
    />
  );
}

/**
 * Este dispositivo no está dado de alta, o le han revocado la sesión.
 * No se explica cómo conseguir el enlace: quien deba tenerlo, lo tiene.
 */
function NotEnrolled({ home }: { home: string }) {
  return (
    <Screen tone="ink" className="gap-8">
      <Link
        href="/inicio"
        prefetch={false}
        aria-label={home}
        className="pt-2 text-chalk/45 transition-colors hover:text-chalk"
      >
        <HomeIcon className="size-6" />
      </Link>
      <div className="flex flex-1 flex-col items-center justify-center gap-8">
        <Logo size="lg" tone="chalk" />
        <Slab className="p-7">
          <p className="eyebrow text-coral">barra · counter</p>
          <h1 className="display mt-3 text-[1.75rem]">
            este dispositivo no está autorizado
          </h1>
          <p className="mt-3 text-[0.9375rem] leading-relaxed text-chalk/55">
            this device is not authorised. abre el enlace de alta del local
            para activarlo.
          </p>
        </Slab>
      </div>
    </Screen>
  );
}
