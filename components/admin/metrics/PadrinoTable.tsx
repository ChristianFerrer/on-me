import { cn } from "@/lib/cn";

export type PadrinoStatus = "active" | "dormant" | "off";

export function PadrinoTable({
  rows,
  labels,
  statusLabels,
  emptyLabel,
}: {
  rows: {
    id: string;
    name: string;
    invited: number;
    opened: number;
    redeemed: number;
    stayed: number;
    status: PadrinoStatus;
  }[];
  labels: {
    customer: string;
    invited: string;
    opened: string;
    redeemed: string;
    stayed: string;
    status: string;
  };
  statusLabels: Record<PadrinoStatus, string>;
  emptyLabel: string;
}) {
  if (!rows.length) return <p className="text-[0.9375rem] text-chalk/45">{emptyLabel}</p>;

  return (
    <div className="glass-dark overflow-x-auto rounded-xl">
      <table className="w-full text-left text-[0.8125rem]">
        <thead>
          <tr className="text-chalk/40">
            <th className="px-3.5 py-2.5 font-medium">{labels.customer}</th>
            <th className="numeral px-3.5 py-2.5 font-medium">{labels.invited}</th>
            <th className="numeral px-3.5 py-2.5 font-medium">{labels.opened}</th>
            <th className="numeral px-3.5 py-2.5 font-medium">{labels.redeemed}</th>
            <th className="numeral px-3.5 py-2.5 font-medium">{labels.stayed}</th>
            <th className="px-3.5 py-2.5 font-medium">{labels.status}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-t border-white/8">
              <td className="max-w-40 truncate px-3.5 py-2.5 font-semibold">{row.name}</td>
              <td className="numeral px-3.5 py-2.5 text-chalk/60">{row.invited}</td>
              <td className="numeral px-3.5 py-2.5 text-chalk/60">{row.opened}</td>
              <td className="numeral px-3.5 py-2.5 text-chalk/60">{row.redeemed}</td>
              <td className="numeral px-3.5 py-2.5 text-chalk/60">{row.stayed}</td>
              <td className="px-3.5 py-2.5">
                <span
                  className={cn(
                    "eyebrow rounded-full px-2 py-0.5 text-[0.625rem]",
                    row.status === "active"
                      ? "bg-lime/15 text-lime"
                      : row.status === "dormant"
                        ? "bg-amber/15 text-amber"
                        : "bg-white/8 text-chalk/50",
                  )}
                >
                  {statusLabels[row.status]}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
