import { layoutRadialTree } from "@/lib/radialLayout";
import type { ReferralNode } from "@/lib/referralTree";
import type { Dict } from "@/lib/i18n";

type AdminDict = Dict["admin"];

/** Espacio extra alrededor del radio máximo, para que quepan burbujas y etiquetas. */
const LABEL_PAD = 90;
const RING_WIDTH = 138;

/**
 * Mapa de saltos: el local en el centro, y cada cliente colgando de quien
 * lo trajo. Es un árbol, no un grafo —cada persona tiene un solo padrino—,
 * así que la distribución radial (tipo d3.tree) es exacta: nadie se pisa
 * con nadie del mismo nivel.
 *
 * Todo lo que se mueve es CSS puro dentro del propio SVG: el pulso que
 * sale del local, el flujo de las ramas y la respiración de los anillos.
 * Sin JavaScript de por medio, se sigue pudiendo renderizar en servidor.
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
  const { nodes, edges, extent, maxDepth } = layoutRadialTree(roots);
  const half = extent + LABEL_PAD;
  const size = half * 2;
  const shop = nodes[0];

  return (
    <div className="rounded-[var(--radius-card)] bg-ink p-6">
      <p className="eyebrow text-chalk/35">{t.referralMap}</p>

      {roots.length === 0 ? (
        <p className="mt-4 text-[0.9375rem] text-chalk/45">{t.referralMapEmpty}</p>
      ) : (
        <svg
          viewBox={`${-half} ${-half} ${size} ${size}`}
          className="mx-auto mt-4 w-full max-w-[34rem]"
          role="img"
          aria-label={t.referralMap}
        >
          <style>{`
            @keyframes rm-pulse {
              0% { r: ${shop.radius}px; opacity: 0.5; }
              100% { r: ${shop.radius + extent * 0.6}px; opacity: 0; }
            }
            @keyframes rm-flow {
              to { stroke-dashoffset: -24; }
            }
            @keyframes rm-breathe {
              0%, 100% { opacity: 1; }
              50% { opacity: 0.45; }
            }
            .rm-pulse { animation: rm-pulse 3.6s cubic-bezier(0.2, 0.6, 0.4, 1) infinite; }
            .rm-edge { stroke-dasharray: 3 9; animation: rm-flow 2.4s linear infinite; }
            .rm-ring { animation: rm-breathe 6s ease-in-out infinite; }
          `}</style>

          {Array.from({ length: maxDepth }, (_, index) => {
            const depth = index + 1;
            return (
              <circle
                key={depth}
                className="rm-ring"
                cx={0}
                cy={0}
                r={depth * RING_WIDTH}
                fill="none"
                stroke={depth % 2 === 1 ? "rgba(245,247,245,0.035)" : "rgba(245,247,245,0.06)"}
                strokeWidth={RING_WIDTH}
                style={{ animationDelay: `${depth * 0.5}s` }}
              />
            );
          })}

          <circle
            className="rm-pulse"
            cx={0}
            cy={0}
            fill="none"
            stroke="var(--color-lime)"
            strokeWidth="2"
          />
          <circle
            className="rm-pulse"
            cx={0}
            cy={0}
            fill="none"
            stroke="var(--color-lime)"
            strokeWidth="2"
            style={{ animationDelay: "1.8s" }}
          />

          {edges.map((edge, index) => (
            <path
              key={index}
              className="rm-edge"
              d={`M${edge.x0},${edge.y0} C${edge.cx1},${edge.cy1} ${edge.cx2},${edge.cy2} ${edge.x1},${edge.y1}`}
              fill="none"
              stroke={edge.billable ? "var(--color-lime)" : "rgba(245,247,245,0.22)"}
              strokeWidth="1.75"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
          ))}

          {nodes.map((node) => {
            const isShop = node.id === "shop";
            const label = isShop ? shopName : node.name;
            const filled = isShop || node.billable;
            const textColor = filled ? "var(--color-ink)" : "var(--color-chalk)";

            return (
              <g key={node.id}>
                <circle
                  cx={node.x}
                  cy={node.y}
                  r={node.radius}
                  fill={filled ? "var(--color-lime)" : "var(--color-ink-2)"}
                  stroke={filled ? "none" : "rgba(245,247,245,0.25)"}
                  strokeWidth={filled ? 0 : 1.25}
                />
                <text
                  x={node.x}
                  y={node.y}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontSize={isShop ? 14 : 11}
                  fontWeight={isShop ? 700 : 600}
                  fill={textColor}
                >
                  {label}
                </text>
                {node.descendants > 0 ? (
                  <text
                    x={node.x}
                    y={node.y + node.radius + 15}
                    textAnchor="middle"
                    fontSize="10"
                    fontWeight="600"
                    className="numeral"
                    fill="rgba(245,247,245,0.45)"
                  >
                    {node.descendants}
                  </text>
                ) : null}
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
