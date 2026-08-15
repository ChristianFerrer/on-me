"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import { FallbackList } from "@/components/universe/FallbackList";
import { RecenterButton } from "@/components/universe/RecenterButton";
import { SelectionSheet } from "@/components/universe/SelectionSheet";
import { StateFilterBar } from "@/components/universe/StateFilterBar";
import { getGiftGraph } from "@/lib/giftGraph/getGiftGraph";
import { EMPTY_GIFT_GRAPH, mergeGraph } from "@/lib/giftGraph/mergeGraph";
import { layoutSphere, type Vec3 } from "@/lib/giftGraph/sphereLayout";
import { ALL_NODE_STATES, type GiftGraph, type NodeState } from "@/lib/giftGraph/types";
import type { Dict, Locale } from "@/lib/i18n";

const GiftUniverseCanvas = dynamic(
  () => import("@/components/universe/GiftUniverseCanvas").then((mod) => mod.GiftUniverseCanvas),
  { ssr: false },
);

const LOAD_DEBOUNCE_MS = 300;
const DESKTOP_BREAKPOINT_PX = 640;

function detectWebgl(): boolean {
  if (typeof document === "undefined") return false;
  try {
    const canvas = document.createElement("canvas");
    return !!(canvas.getContext("webgl2") || canvas.getContext("webgl"));
  } catch {
    return false;
  }
}

export function GiftUniverse({ t, locale }: { t: Dict; locale: Locale }) {
  const [radius] = useState(() =>
    typeof window !== "undefined" && window.innerWidth >= DESKTOP_BREAKPOINT_PX ? 3 : 2,
  );
  // Optimista en el primer render (server y cliente coinciden en "sí hay
  // WebGL", que es lo normal) y se corrige después de montar si hace falta:
  // decidir esto en el propio useState rompería la hidratación, porque
  // `document` no existe durante el render en servidor.
  const [webglSupported, setWebglSupported] = useState(true);
  const [reducedMotion] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  // Se guarda lo excluido, no lo incluido: así "sin tocar nada" es
  // exactamente "sin filtro" (set vacío), sin tener que sincronizar un
  // estado inicial con la lista completa de NodeState.
  const [excludedStates, setExcludedStates] = useState<Set<NodeState>>(new Set());
  const activeStates = useMemo<Set<NodeState> | null>(
    () => (excludedStates.size === 0 ? null : new Set(ALL_NODE_STATES.filter((s) => !excludedStates.has(s)))),
    [excludedStates],
  );

  function toggleState(state: NodeState) {
    setExcludedStates((prev) => {
      const next = new Set(prev);
      if (next.has(state)) next.delete(state);
      else next.add(state);
      return next;
    });
  }

  useEffect(() => {
    // Diferido a un microtask, no una llamada síncrona dentro del propio
    // efecto: evita el aviso de "cascading renders" del linter sin cambiar
    // el resultado (sigue corriendo justo después de montar).
    queueMicrotask(() => {
      if (!detectWebgl()) setWebglSupported(false);
    });
  }, []);

  const [graph, setGraph] = useState<GiftGraph>(EMPTY_GIFT_GRAPH);
  const [loading, setLoading] = useState(true);
  const [focusId, setFocusId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [positions, setPositions] = useState<Map<string, Vec3>>(new Map());
  const [layoutForGraph, setLayoutForGraph] = useState(graph);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestIdRef = useRef(0);

  function load(nextFocusId: string | null, { immediate = false } = {}) {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const run = async () => {
      const requestId = ++requestIdRef.current;
      setLoading(true);
      try {
        const slice = await getGiftGraph(nextFocusId, radius);
        if (requestId !== requestIdRef.current) return; // una carga más nueva ya está en curso
        setGraph((prev) => mergeGraph(prev, slice, nextFocusId, radius));
      } finally {
        if (requestId === requestIdRef.current) setLoading(false);
      }
    };
    if (immediate) void run();
    else debounceRef.current = setTimeout(run, LOAD_DEBOUNCE_MS);
  }

  useEffect(() => {
    load(null, { immediate: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo en el montaje
  }, []);

  // Ajuste de estado derivado durante el propio render (no en un efecto):
  // layoutSphere necesita la posición ya cacheada de cada nodo para no
  // moverlo, así que lee `positions` y programa su actualización en el
  // mismo pase en cuanto `graph` cambia de referencia.
  if (graph !== layoutForGraph) {
    setLayoutForGraph(graph);
    setPositions(layoutSphere(graph.nodes, graph.edges, graph.roots, positions));
  }

  const directlyConnected = useMemo(() => {
    if (!selectedId) return new Set<string>();
    const set = new Set<string>([selectedId]);
    for (const edge of graph.edges) {
      if (edge.from === selectedId) set.add(edge.to);
      if (edge.to === selectedId) set.add(edge.from);
    }
    return set;
  }, [selectedId, graph.edges]);

  const selectedNode = selectedId ? (graph.nodes.find((n) => n.id === selectedId) ?? null) : null;
  const giftedByName = useMemo(() => {
    if (!selectedNode) return "";
    const parentEdge = graph.edges.find((edge) => edge.to === selectedNode.id);
    if (!parentEdge) return "";
    if (parentEdge.from === graph.establishment.id) return graph.establishment.name;
    return graph.nodes.find((n) => n.id === parentEdge.from)?.name ?? "";
  }, [selectedNode, graph]);

  function handleSelect(nodeId: string) {
    setSelectedId(nodeId);
    setFocusId(nodeId);
    load(nodeId);
  }

  function handleRecenter() {
    setSelectedId(null);
    setFocusId(null);
    load(null);
  }

  function handleCloseSheet() {
    setSelectedId(null);
  }

  if (!webglSupported) {
    return <FallbackList graph={graph} loading={loading} t={t} onExpand={handleSelect} />;
  }

  return (
    <div className="fixed inset-0">
      <GiftUniverseCanvas
        graph={graph}
        positions={positions}
        focusId={focusId}
        selectedId={selectedId}
        directlyConnected={directlyConnected}
        activeStates={activeStates}
        reducedMotion={reducedMotion}
        onSelect={handleSelect}
        t={t}
      />
      {/* Viñeteado barato: un degradado en CSS por encima del canvas, no un
          paso de postprocesado en WebGL. */}
      <div
        className="pointer-events-none fixed inset-0 z-[5]"
        style={{ background: "radial-gradient(ellipse at center, transparent 45%, rgba(0,0,0,0.65) 100%)" }}
      />

      <RecenterButton t={t} onClick={handleRecenter} />
      <StateFilterBar excluded={excludedStates} onToggle={toggleState} t={t} />

      {loading ? (
        <div className="glass-dark pointer-events-none fixed left-4 top-[max(1rem,env(safe-area-inset-top))] z-20 rounded-full px-3.5 py-2 text-[0.75rem] text-chalk/70">
          {t.common.loading}
        </div>
      ) : null}

      {!selectedNode ? (
        <p className="pointer-events-none fixed inset-x-0 bottom-0 z-10 px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] text-center text-[0.75rem] text-chalk/40">
          {t.admin.universeHint}
        </p>
      ) : (
        <SelectionSheet
          node={selectedNode}
          giftedByName={giftedByName}
          locale={locale}
          t={t}
          onClose={handleCloseSheet}
        />
      )}
    </div>
  );
}
