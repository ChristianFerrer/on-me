import { Logo } from "@/components/ui/Logo";
import { LangSwitch } from "@/components/ui/LangSwitch";
import { StampCard } from "@/components/ui/StampCard";
import { Screen, Sheet } from "@/components/ui/Screen";
import { getI18n } from "@/lib/i18n/server";

/**
 * Portada. Nadie llega aquí desde el flujo real —se entra por el QR de la
 * barra o por un enlace de WhatsApp—, así que su único trabajo es explicar
 * qué es esto a quien teclee el dominio, y hacerlo con carácter.
 */
export default async function HomePage() {
  const { locale, t } = await getI18n();

  // El titular se parte por la primera coma para teñir la segunda mitad.
  // Si algún idioma no la trae, se pinta entero y no se pierde nada.
  const comma = t.join.title.indexOf(",");
  const head = comma === -1 ? t.join.title : t.join.title.slice(0, comma);
  const tail = comma === -1 ? null : t.join.title.slice(comma + 1).trim();

  return (
    <Screen className="gap-7 overflow-hidden">
      <header className="flex items-center justify-between">
        <Logo tagline={t.brand.tagline} />
        <LangSwitch locale={locale} label={t.common.switchTo} />
      </header>

      <div className="stagger flex flex-1 flex-col justify-center gap-7 py-4">
        <div className="relative">
          <span
            aria-hidden
            className="halftone halftone-lg anim-drift absolute -right-10 -top-8 -z-10 size-44 rounded-full text-tomato"
          />
          <h1 className="display-tight text-balance text-[clamp(2.9rem,15vw,4.2rem)]">
            {head}
            {tail ? (
              <>
                ,
                <br />
                <span className="text-tomato">{tail}</span>
              </>
            ) : null}
          </h1>
          <p className="mt-4 max-w-[22ch] text-[1.15rem] leading-snug font-medium text-ink-soft">
            {t.join.subtitle}
          </p>
        </div>

        <Sheet className="bg-paper-deep p-5" tint="var(--color-cobalt)">
          <StampCard stamps={7} goal={10} />
          <p className="numeral mt-4 text-sm text-ink-soft">
            {t.card.stampsOf.replace("{n}", "7").replace("{goal}", "10")} ·{" "}
            {t.card.nToGo.replace("{n}", "3")}
          </p>
        </Sheet>

        <Sheet className="bg-ink p-5 text-paper" tint="var(--color-saffron)">
          <p className="overline text-saffron">{t.invite.eyebrow}</p>
          <p className="display mt-2 text-[1.7rem] leading-tight">
            {t.invite.title}
          </p>
          {/* En la portada no hay cafetería en contexto, así que la copia va
              sin nombre de local en vez de rellenarlo con el de la marca. */}
          <p className="mt-2 text-[0.95rem] leading-snug text-paper/70">
            {t.card.inviteBody}
          </p>
        </Sheet>
      </div>

      <footer className="border-t-2 border-ink/15 pt-4">
        <p className="text-sm leading-snug text-ink-faint">
          {t.errors.notFoundBody}
        </p>
      </footer>
    </Screen>
  );
}
