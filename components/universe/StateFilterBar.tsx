"use client";

import { cn } from "@/lib/cn";
import { STATE_BADGE_SKIN, stateBadgeLabel } from "@/lib/giftGraph/stateBadge";
import { ALL_NODE_STATES } from "@/lib/giftGraph/types";
import type { NodeState } from "@/lib/giftGraph/types";
import type { Dict } from "@/lib/i18n";

/**
 * La leyenda es el propio filtro: cada chip ya es el badge real de ese
 * estado (mismo color y texto que /admin/atribuciones), así que no hace
 * falta explicarlo aparte. La barra en sí -flotante, traslúcida, en fila-
 * calca al bottom-nav; "activo" se lee igual, en opacidad, porque aquí el
 * color de cada pestaña ya está tomado por el estado que representa.
 */
export function StateFilterBar({
  excluded,
  onToggle,
  t,
}: {
  excluded: Set<NodeState>;
  onToggle: (state: NodeState) => void;
  t: Dict;
}) {
  return (
    <div
      className="glass-dark pointer-events-auto fixed inset-x-0 top-[calc(max(1rem,env(safe-area-inset-top))+3.5rem)] z-20 mx-auto flex w-fit max-w-[calc(100%-2rem)] items-center gap-1.5 overflow-x-auto rounded-full px-2 py-1.5"
      role="group"
      aria-label={t.admin.universeFilters}
    >
      {ALL_NODE_STATES.map((state) => {
        const active = !excluded.has(state);
        return (
          <button
            key={state}
            type="button"
            onClick={() => onToggle(state)}
            aria-pressed={active}
            className={cn(
              "eyebrow shrink-0 rounded-full px-2.5 py-1 transition-opacity",
              STATE_BADGE_SKIN[state],
              active ? "opacity-100" : "opacity-40 hover:opacity-70",
            )}
          >
            {stateBadgeLabel(state, t)}
          </button>
        );
      })}
    </div>
  );
}
