import { ButtonLink } from "@/components/ui/Button";
import { Screen, Slab } from "@/components/ui/Screen";
import { TopBar } from "@/components/ui/TopBar";
import { getI18n } from "@/lib/i18n/server";

/**
 * 404 de toda la app -CLI-23-: sin esto, un slug de local inexistente
 * (`/j/<slug>`, `/j/<slug>/qr`) o cualquier ruta que no existe caía en la
 * pantalla genérica de Next, rompiendo la continuidad visual justo en el
 * primer contacto de alguien con el producto.
 */
export default async function NotFound() {
  const { t } = await getI18n();

  return (
    <Screen tone="quiet" className="gap-6">
      <TopBar />
      <div className="flex flex-1 flex-col justify-center">
        <Slab className="p-7">
          <h1 className="display text-[1.875rem]">{t.errors.notFound}</h1>
          <p className="mt-3 text-[0.9375rem] leading-relaxed text-chalk/70">
            {t.errors.notFoundBody}
          </p>
          <ButtonLink href="/inicio" tone="ink" size="md" className="mt-6">
            {t.errors.backHome}
          </ButtonLink>
        </Slab>
      </div>
    </Screen>
  );
}
