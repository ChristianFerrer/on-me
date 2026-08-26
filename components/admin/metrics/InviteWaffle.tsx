import { METRICS_LOSS, rampColor } from "@/components/admin/metrics/palette";
import type { WaffleGroupKey } from "@/lib/metrics";

const GROUP_COLOR: Record<WaffleGroupKey, string> = {
  unopened_alive: rampColor(0),
  expired_unopened: METRICS_LOSS,
  opened_unredeemed: rampColor(1),
  expired_after_open: METRICS_LOSS,
  redeemed_window: rampColor(3),
  redeemed_no_return: METRICS_LOSS,
  stayed: rampColor(4),
};

/**
 * Un cuadrado por invitación real -partición exhaustiva y excluyente, los
 * siete grupos suman el total-. Por encima de ~200 invitaciones cada
 * cuadrado agrupa de 5 en 5, para que la cuadrícula siga siendo legible.
 */
export function InviteWaffle({
  groups,
  total,
  coffeesConsumed,
  labels,
  coffeesConsumedLabel,
  groupedNote,
}: {
  groups: { key: WaffleGroupKey; count: number; pct: number }[];
  total: number;
  coffeesConsumed: number;
  labels: Record<WaffleGroupKey, string>;
  coffeesConsumedLabel: string;
  groupedNote?: string;
}) {
  const grouped = total > 200;
  const unit = grouped ? 5 : 1;

  const squares: WaffleGroupKey[] = [];
  for (const group of groups) {
    const count = grouped ? Math.round(group.count / unit) : group.count;
    for (let i = 0; i < count; i++) squares.push(group.key);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-[repeat(auto-fill,17px)] gap-[3px]">
        {squares.map((key, index) => (
          <div
            key={index}
            title={labels[key]}
            className="size-[17px] shrink-0 rounded-[3px]"
            style={{ background: GROUP_COLOR[key] }}
          />
        ))}
      </div>
      {grouped && groupedNote ? <p className="text-[0.75rem] text-chalk/35">{groupedNote}</p> : null}

      <ul className="flex flex-col gap-1.5">
        {groups.map((group) => (
          <li key={group.key} className="flex items-center gap-2 text-[0.8125rem]">
            <span
              aria-hidden
              className="size-2.5 shrink-0 rounded-full"
              style={{ background: GROUP_COLOR[group.key] }}
            />
            <span className="min-w-0 flex-1 truncate text-chalk/70">{labels[group.key]}</span>
            <span className="numeral shrink-0 text-chalk/50">
              {group.count} · {Math.round(group.pct)}%
            </span>
          </li>
        ))}
      </ul>

      <div className="flex items-center justify-between rounded-xl bg-lime/12 px-4 py-3">
        <span className="text-[0.875rem] font-semibold text-lime">{coffeesConsumedLabel}</span>
        <span className="numeral text-[1.125rem] font-bold text-lime">{coffeesConsumed}</span>
      </div>
    </div>
  );
}
