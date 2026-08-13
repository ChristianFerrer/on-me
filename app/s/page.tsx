import { Scanner } from "@/components/barista/Scanner";
import { Logo } from "@/components/ui/Logo";
import { Screen, Sheet } from "@/components/ui/Screen";
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
    <Screen className="justify-center gap-6">
      <Logo size="lg" />
      <Sheet className="bg-tomato p-6 text-paper">
        <p className="overline text-paper/70">barra · counter</p>
        <h1 className="display mt-2 text-[1.9rem] leading-tight">
          este dispositivo no está autorizado
        </h1>
        <p className="mt-3 text-[0.95rem] leading-snug text-paper/85">
          this device is not authorised. abre el enlace de alta del local para
          activarlo.
        </p>
      </Sheet>
    </Screen>
  );
}
