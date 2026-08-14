"use client";

import { CompassIcon } from "@/components/ui/Icons";
import type { Dict } from "@/lib/i18n";

export function RecenterButton({ t, onClick }: { t: Dict; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={t.admin.universeRecenter}
      className="btn glass-dark pointer-events-auto fixed right-4 top-[max(1rem,env(safe-area-inset-top))] z-20 size-11 text-chalk"
    >
      <CompassIcon className="size-5" />
    </button>
  );
}
