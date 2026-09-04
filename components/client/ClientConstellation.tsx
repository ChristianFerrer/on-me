"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ESTABLISHMENT_RADIUS, layoutConstelacion } from "@/lib/giftGraph/constelacionLayout";
import type { GiftGraph, NodeState } from "@/lib/giftGraph/types";

/**
 * Mismo lenguaje visual que /admin/constelacion-sol -mismo layout radial,
 * mismos colores por estado-, pero una vista aparte, no ese componente
 * embebido: aquella pantalla es de pared completa, pensada para quedarse
 * encendida en un monitor -pan/zoom manual, rotación de fondo, ficha con
 * acciones del dueño (disputar, marcar bonus)-, y nada de eso encaja -ni
 * tiene sentido de cara al cliente- dentro de una tarjeta del carrusel del
 * tamaño de una mano. Aquí no hay arrastre ni pellizco a propósito: el
 * carrusel que la contiene ya usa el propio dedo para deslizar entre
 * tarjetas, y una vista con su propio gesto de arrastre se lo pelearía.
 * Cabe entera de un vistazo -por eso el auto-encuadre de layoutConstelacion
 * ya basta, sin control de zoom-, y el toque no abre ninguna ficha: aquí
 * solo se mira.
 */
const CONSTELACION_PHASE_COLOR: Record<NodeState, string> = {
  sent: "#FFFFFF",
  opened: "#fbbf24",
  claimed: "#4ade80",
  window: "#38E1FF",
  billable: "#FF00F9",
  direct: "#E9FF72",
  discarded: "#000000",
  expired: "#000000",
};

export function ClientConstellation({
  customerName,
  loadingLabel,
  emptyTitle,
  emptyBody,
  emptyCta,
}: {
  customerName: string;
  loadingLabel: string;
  emptyTitle: string;
  emptyBody: string;
  emptyCta: string;
}) {
  const [graph, setGraph] = useState<GiftGraph | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const response = await fetch("/api/card/constellation", { cache: "no-store" });
        if (!response.ok) return;
        const data = (await response.json()) as { graph: GiftGraph };
        if (!cancelled) setGraph(data.graph);
      } catch {
        // Sin conexión: se queda en el estado de carga, no hay nada más
        // relevante que enseñar -esta tarjeta no es la que hace falta sin
        // cobertura, esa es el QR-.
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!graph) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
        <p className="text-[0.8125rem] text-white/50">{loadingLabel}</p>
      </div>
    );
  }

  if (graph.nodes.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-[clamp(7px,1.4vh,12px)] px-[clamp(17px,3vh,26px)] text-center">
        <h2 className="text-[clamp(16px,3vh,21px)] font-extrabold tracking-[-0.025em] leading-[1.16]">
          {emptyTitle}
        </h2>
        <p className="text-[clamp(11.5px,1.95vh,13.5px)] leading-[1.45] text-white/72">{emptyBody}</p>
        <Link
          href="/c/invitar"
          prefetch={false}
          onClick={(event) => event.stopPropagation()}
          className="mt-1 rounded-full bg-lime px-[18px] py-[clamp(10px,1.9vh,14px)] text-[clamp(12.5px,2vh,15px)] font-bold text-ink transition-[filter] hover:brightness-110 active:scale-[0.97]"
        >
          {emptyCta}
        </Link>
      </div>
    );
  }

  const layout = layoutConstelacion(graph.nodes, graph.edges, graph.establishment.id);
  const nodesById = new Map(graph.nodes.map((node) => [node.id, node]));
  const frame = layout.frameRadius;

  return (
    <svg
      viewBox={`${-frame} ${-frame} ${frame * 2} ${frame * 2}`}
      className="size-full"
      role="img"
      aria-label={customerName}
    >
      <defs>
        <filter id="constelacion-glow" x="-200%" y="-200%" width="500%" height="500%">
          <feGaussianBlur stdDeviation="3.2" />
        </filter>
      </defs>

      {layout.links.map((link) => {
        const from = layout.points.get(link.fromId);
        const to = layout.points.get(link.toId);
        if (!from || !to) return null;
        const toNode = nodesById.get(link.toId);
        const color = toNode ? CONSTELACION_PHASE_COLOR[toNode.state] : "#FFFFFF";
        const fromX = from.ringRadius * Math.cos(from.angle);
        const fromY = from.ringRadius * Math.sin(from.angle);
        const toX = to.ringRadius * Math.cos(to.angle);
        const toY = to.ringRadius * Math.sin(to.angle);
        return (
          <line
            key={`${link.fromId}-${link.toId}`}
            x1={fromX}
            y1={fromY}
            x2={toX}
            y2={toY}
            stroke={color}
            strokeWidth={1.1}
            strokeOpacity={0.55}
          />
        );
      })}

      {[...layout.points.values()]
        .filter((point) => point.id !== graph.establishment.id)
        .map((point) => {
          const node = nodesById.get(point.id);
          if (!node) return null;
          const color = CONSTELACION_PHASE_COLOR[node.state];
          const x = point.ringRadius * Math.cos(point.angle);
          const y = point.ringRadius * Math.sin(point.angle);
          return (
            <g key={point.id} className="anim-star-twinkle" style={{ animationDelay: `${(point.index % 7) * 0.4}s` }}>
              <circle cx={x} cy={y} r={point.nodeRadius * 2.4} fill={color} opacity={0.22} filter="url(#constelacion-glow)" />
              <circle cx={x} cy={y} r={point.nodeRadius} fill={color} />
              {node.claimed && node.name ? (
                <text
                  x={x}
                  y={y + point.nodeRadius + 7}
                  textAnchor="middle"
                  fontSize={6.5}
                  fill="rgba(255,255,255,.75)"
                >
                  {node.name}
                </text>
              ) : null}
            </g>
          );
        })}

      <circle cx={0} cy={0} r={ESTABLISHMENT_RADIUS} fill="#E9FF72" />
      <text
        x={0}
        y={ESTABLISHMENT_RADIUS + 11}
        textAnchor="middle"
        fontSize={8}
        fontWeight={700}
        fill="#fff"
      >
        {customerName}
      </text>
    </svg>
  );
}
