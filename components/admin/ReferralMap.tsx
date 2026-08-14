import { layoutRadialTree } from "@/lib/radialLayout";
import type { ReferralNode } from "@/lib/referralTree";
import type { Dict } from "@/lib/i18n";

type AdminDict = Dict["admin"];

/** Espacio extra alrededor del radio máximo, para que quepan las etiquetas. */
const LABEL_PAD = 130;

/**
 * Mapa de saltos: el local en el centro, y cada cliente colgando de quien
 * lo trajo. Es un árbol, no un grafo —cada persona tiene un solo padrino—,
 * así que la distribución radial (tipo d3.tree) es exacta: nadie se pisa
 * con nadie del mismo nivel.
 */
export function ReferralMap({
  roots,
  shopName,
  t,
}: {
  roots: ReferralNode[];
  shopName: string;
  t: AdminDict;
}) {
  const { nodes, edges, extent } = layoutRadialTree(roots);
  const half = extent + LABEL_PAD;
  const size = half * 2;

  return (
    <div className="rounded-[var(--radius-card)] bg-ink p-6">
      <p className="eyebrow text-chalk/35">{t.referralMap}</p>

      {roots.length === 0 ? (
        <p className="mt-4 text-[0.9375rem] text-chalk/45">{t.referralMapEmpty}</p>
      ) : (
        <svg
          viewBox={`${-half} ${-half} ${size} ${size}`}
          className="mx-auto mt-4 w-full max-w-[32rem]"
          role="img"
          aria-label={t.referralMap}
        >
          {edges.map((edge, index) => (
            <path
              key={index}
              d={`M${edge.x0},${edge.y0} C${edge.cx1},${edge.cy1} ${edge.cx2},${edge.cy2} ${edge.x1},${edge.y1}`}
              fill="none"
              stroke={edge.billable ? "var(--color-lime)" : "rgba(245,247,245,0.18)"}
              strokeWidth="1.75"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
          ))}

          {nodes.map((node) => {
            const isShop = node.id === "shop";
            const r = isShop ? 15 : 7;
            const label = isShop ? shopName : node.name;
            const labelX = isShop ? 0 : node.x + (node.x >= 0 ? r + 6 : -(r + 6));
            const labelY = isShop ? r + 16 : node.y;
            const anchor = isShop ? "middle" : node.x >= 0 ? "start" : "end";

            return (
              <g key={node.id}>
                <circle
                  cx={node.x}
                  cy={node.y}
                  r={r}
                  fill={isShop ? "var(--color-lime)" : node.billable ? "var(--color-lime)" : "var(--color-ink-2)"}
                  stroke={isShop ? "none" : "rgba(245,247,245,0.25)"}
                  strokeWidth={isShop ? 0 : 1.25}
                  vectorEffect="non-scaling-stroke"
                />
                <text
                  x={labelX}
                  y={labelY}
                  textAnchor={anchor}
                  dominantBaseline={isShop ? "hanging" : "middle"}
                  fontSize={isShop ? 13 : 11}
                  fontWeight={isShop ? 700 : 500}
                  fill={isShop ? "var(--color-chalk)" : "rgba(245,247,245,0.75)"}
                >
                  {label}
                </text>
              </g>
            );
          })}
        </svg>
      )}

      <div className="mt-5 flex items-center justify-center gap-5 text-[0.75rem] text-chalk/40">
        <span className="flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-lime" />
          {t.attrBillable}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-ink-2 ring-1 ring-inset ring-chalk/25" />
          {t.referralMapPending}
        </span>
      </div>
    </div>
  );
}
