"use client";

import Link from "next/link";
import { useMemo } from "react";
import { ArrowLeftIcon } from "@/components/ui/Icons";
import { fill, type Dict } from "@/lib/i18n";
import type { GiftGraph, Node } from "@/lib/giftGraph/types";

/** Plan B sin WebGL: la misma carga bajo demanda, como lista jerárquica. */
export function FallbackList({
  graph,
  loading,
  t,
  onExpand,
}: {
  graph: GiftGraph;
  loading: boolean;
  t: Dict;
  onExpand: (id: string) => void;
}) {
  const nodesById = useMemo(() => new Map(graph.nodes.map((n) => [n.id, n])), [graph.nodes]);
  const childrenOf = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const edge of graph.edges) map.set(edge.from, [...(map.get(edge.from) ?? []), edge.to]);
    return map;
  }, [graph.edges]);

  return (
    <div className="fixed inset-0 aurora-night overflow-y-auto text-chalk">
      <header className="flex items-center justify-between gap-3 px-5 pt-[max(1rem,env(safe-area-inset-top))]">
        <Link href="/admin/atribuciones" prefetch={false} className="btn glass-dark gap-1.5 px-4 py-2.5 text-[0.875rem] text-chalk">
          <ArrowLeftIcon className="size-4" />
          {t.common.back}
        </Link>
        {loading ? <span className="text-[0.75rem] text-chalk/45">{t.common.loading}</span> : null}
      </header>

      <div className="mx-auto w-full max-w-[30rem] px-5 py-6 sm:max-w-[34rem]">
        <p className="mb-2 text-[0.7rem] font-semibold uppercase tracking-wide text-chalk/40">
          {t.admin.universeFallbackTitle}
        </p>
        <h1 className="mb-4 text-[1.5rem] font-bold">{graph.establishment.name}</h1>
        <ul className="flex flex-col gap-1">
          {graph.roots.map((id) => (
            <NodeItem key={id} node={nodesById.get(id)!} childrenOf={childrenOf} nodesById={nodesById} t={t} onExpand={onExpand} />
          ))}
        </ul>
      </div>
    </div>
  );
}

function NodeItem({
  node,
  childrenOf,
  nodesById,
  t,
  onExpand,
}: {
  node: Node;
  childrenOf: Map<string, string[]>;
  nodesById: Map<string, Node>;
  t: Dict;
  onExpand: (id: string) => void;
}) {
  const childIds = childrenOf.get(node.id) ?? [];
  const remaining = node.childCount - node.loadedChildCount;

  return (
    <li className="border-b border-white/8 py-2.5 last:border-0">
      <div className="flex items-center justify-between gap-3">
        <span className="font-semibold text-chalk">{node.name}</span>
        {remaining > 0 ? (
          <button type="button" onClick={() => onExpand(node.id)} className="text-[0.8125rem] font-semibold text-lime">
            {fill(t.admin.universeLoadMore, { n: remaining })}
          </button>
        ) : null}
      </div>
      {childIds.length > 0 ? (
        <ul className="mt-1.5 flex flex-col gap-1 border-l border-white/10 pl-4">
          {childIds.map((id) => (
            <NodeItem key={id} node={nodesById.get(id)!} childrenOf={childrenOf} nodesById={nodesById} t={t} onExpand={onExpand} />
          ))}
        </ul>
      ) : null}
    </li>
  );
}
