import { Scanner } from "@/components/barista/Scanner";
import { Logo } from "@/components/ui/Logo";
import { Screen, Slab } from "@/components/ui/Screen";
import { getDeviceContext, pinRequired } from "@/lib/auth/device";
import { getI18n } from "@/lib/i18n/server";

export default async function BaristaPage() {
  const { t } = await getI18n();
  const ctx = await getDeviceContext();

  if (!ctx) return <NotEnrolled />;

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
function NotEnrolled() {
  return (
    <Screen tone="ink" className="justify-center gap-8">
      <Logo size="lg" tone="chalk" />
      <Slab className="bg-ink-2 p-7">
        <p className="eyebrow text-coral">barra · counter</p>
        <h1 className="display mt-3 text-[1.75rem]">
          este dispositivo no está autorizado
        </h1>
        <p className="mt-3 text-[0.9375rem] leading-relaxed text-chalk/55">
          this device is not authorised. abre el enlace de alta del local para
          activarlo.
        </p>
      </Slab>
    </Screen>
  );
}
