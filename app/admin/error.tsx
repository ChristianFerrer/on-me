"use client";

import Link from "next/link";
import { useEffect, useMemo } from "react";
import { Button } from "@/components/ui/Button";
import { Screen, Slab } from "@/components/ui/Screen";
import { DEFAULT_LOCALE, LOCALE_COOKIE, getDict, isLocale } from "@/lib/i18n";

/**
 * Error boundary del panel. Sin esto, un fallo real de datos caía en la
 * pantalla de error genérica de Next -blanca, sin nada del lenguaje visual
 * oscuro del resto del panel-, justo en el peor momento para que algo
 * desentone. `error.tsx` es forzosamente de cliente, así que el idioma se
 * lee de la misma cookie que fija el servidor -`getDict` es puro, no hace
 * falta `getI18n()`-, en vez del `t` que trae cada página.
 */
export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  const t = useMemo(() => {
    const match = document.cookie.match(new RegExp(`(?:^|; )${LOCALE_COOKIE}=([^;]+)`));
    const locale = match?.[1];
    return getDict(isLocale(locale) ? locale : DEFAULT_LOCALE);
  }, []);

  return (
    <Screen tone="ink" className="gap-6">
      <div className="flex flex-1 flex-col items-center justify-center gap-6">
        <Slab className="w-full max-w-[26rem] p-7 text-center">
          <h1 className="display text-[1.875rem]">{t.errors.generic}</h1>
          <p className="mt-3 text-[0.9375rem] leading-relaxed text-chalk/70">
            {t.errors.genericBody}
          </p>
          <div className="mt-6 flex flex-col gap-2.5">
            <Button type="button" tone="lime" size="md" onClick={reset}>
              {t.common.retry}
            </Button>
            <Link
              href="/inicio"
              prefetch={false}
              className="text-[0.8125rem] font-medium text-chalk/55 transition-colors hover:text-chalk"
            >
              {t.errors.backHome}
            </Link>
          </div>
        </Slab>
      </div>
    </Screen>
  );
}
