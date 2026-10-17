import { CardMark, FlipButton } from "@/components/client/CardFaceBits";
import { CoffeeIcon } from "@/components/ui/Icons";
import { cn } from "@/lib/cn";
import { fill } from "@/lib/i18n";

/**
 * "Modo real" -ver /admin/ajustes-: copia de la tarjeta de cartón física
 * del local -azul marino, el logo arriba, sellos circulares en vez de
 * cuadrados-, no una variante de tema. Un objeto físico no "cambia a modo
 * claro" cuando el resto de la app lo hace, así que este componente no
 * recibe `light`: el azul marino es fijo, da igual el tema del local -por
 * eso `FlipButton`/`CardMark` reciben `onLight={false}` siempre, no un
 * valor derivado del tema-.
 */
export function RealStampCard({
  shopName,
  logoUrl,
  stamps,
  goal,
  rewardsPendingCount,
  flipped,
  onFlip,
  labels,
}: {
  shopName: string;
  logoUrl: string | null;
  stamps: number;
  goal: number;
  rewardsPendingCount: number;
  flipped: boolean;
  onFlip: () => void;
  labels: {
    oneToGo: string;
    nToGo: string;
    readyHint: string;
    tagline: string;
    flipLabel: string;
  };
}) {
  const remaining = goal - stamps;

  return (
    <div className="card-scope relative rounded-[20px] border border-white/15 bg-[#0e1a38] p-5 text-white shadow-[0_18px_40px_rgba(2,6,23,0.45)]">
      <FlipButton onClick={onFlip} pressed={flipped} label={labels.flipLabel} onLight={false} />

      <div className="flex items-center gap-3 pr-9">
        <span className="flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/30 bg-white/5">
          {logoUrl ? (
            // Logo del local, subido desde /admin/ajustes: URL externa de
            // Supabase Storage, de ahí el <img> plano -ver ShopSettingsForm.tsx-.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt="" className="size-full object-cover" />
          ) : (
            <CoffeeIcon className="size-5 text-white/75" />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[0.9375rem] font-extrabold uppercase tracking-[0.04em]">{shopName}</p>
          <p className="truncate text-[0.6875rem] text-white/45">{labels.tagline}</p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-5 gap-x-3 gap-y-3.5">
        {Array.from({ length: goal }, (_, i) => {
          const filled = i < stamps;
          return (
            <span
              key={i}
              className={cn(
                "flex aspect-square items-center justify-center rounded-full border-[1.5px]",
                filled ? "border-white bg-white" : "border-dashed border-white/30",
              )}
            >
              {filled ? <CoffeeIcon className="size-[55%] text-[#0e1a38]" /> : null}
            </span>
          );
        })}
      </div>

      <div className="mt-3.5 flex items-center justify-between gap-2">
        <CardMark onLight={false} />
        <p className="text-right text-[0.75rem] leading-[1.3] text-white/50">
          {rewardsPendingCount > 0 ? labels.readyHint : remaining === 1 ? labels.oneToGo : fill(labels.nToGo, { n: remaining })}
        </p>
      </div>
    </div>
  );
}
