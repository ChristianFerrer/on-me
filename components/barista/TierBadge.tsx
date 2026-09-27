import { fill, type Dict } from "@/lib/i18n";
import type { CustomerTier } from "@/lib/ranking";

type BaristaDict = Dict["barista"];

/** Sin token de color para plata/bronce en el sistema -solo hay lime/mint/teal/azure/amber/coral-: se fijan aquí los dos que faltan. */
const TIER_CLASS: Record<CustomerTier, string> = {
  gold: "bg-amber/20 text-amber",
  silver: "bg-chalk/15 text-chalk/80",
  bronze: "bg-[#cd7f32]/20 text-[#cd7f32]",
};

/** "Oro #4": posición del cliente en el ranking del local -ver lib/ranking.ts-. */
export function TierBadge({ t, tier, position }: { t: BaristaDict; tier: CustomerTier; position: number }) {
  const tierLabel = { gold: t.identifyTierGold, silver: t.identifyTierSilver, bronze: t.identifyTierBronze }[tier];

  return (
    <span
      className={`numeral shrink-0 rounded-full px-3 py-1.5 text-[0.75rem] font-bold ${TIER_CLASS[tier]}`}
    >
      {fill(t.identifyRankBadge, { tier: tierLabel, position })}
    </span>
  );
}
