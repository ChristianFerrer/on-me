"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import { Color, InstancedMesh, MathUtils, Object3D, Vector3 } from "three";
import { organicOffset } from "@/components/universe/organicOffset";
import { CORAL, dimColor, LIME, stateColor } from "@/components/universe/palette";
import { SPHERE_GEOMETRY } from "@/components/universe/sphereGeometry";
import { isExpiringSoon, recencyFactor } from "@/lib/giftGraph/insights";
import { breathingScale, computeRadius } from "@/lib/giftGraph/organicMotion";
import { isTap, type PointerPoint } from "@/lib/giftGraph/tapGesture";
import type { LiveNodesRef } from "@/components/universe/liveNodes";
import type { Edge, Node, NodeState } from "@/lib/giftGraph/types";
import type { Vec3 } from "@/lib/giftGraph/sphereLayout";

/** Cuánto tarda en converger el radio hacia su objetivo: mayor = más rápido. */
const RADIUS_DAMP_LAMBDA = 4;
/** Deriva orgánica como fracción del radio del propio nodo. */
const OFFSET_AMPLITUDE_FACTOR = 0.14;
/** Cuánto del vaivén del padre hereda el hijo, como si tirara del hilo. */
const PARENT_SWAY_FACTOR = 0.35;
const ENTRY_STAGGER_SEC = 0.09;
/** Ritmo del pulso de "a punto de caducar", en rad/s. */
const EXPIRING_PULSE_SPEED = 6;

type PendingTap = { pointerId: number; nodeId: string; down: PointerPoint };
type PointerDownEvent = {
  instanceId?: number;
  pointerId: number;
  clientX: number;
  clientY: number;
  stopPropagation: () => void;
};
type PointerUpEvent = { pointerId: number; clientX: number; clientY: number };

const CORAL_COLOR = new Color(CORAL);
const LIME_COLOR = new Color(LIME);

// Puras -sin tocar refs- para que las cuatro variantes de handler (relleno /
// wireframe × down/up) no dupliquen la lógica del gesto de tap, solo la
// lectura/escritura de `pendingTap.current` que sí tiene que vivir en el
// propio handler.
function beginTap(list: Node[], event: PointerDownEvent): PendingTap | null {
  if (event.instanceId == null) return null;
  const node = list[event.instanceId];
  if (!node) return null;
  event.stopPropagation();
  return {
    pointerId: event.pointerId,
    nodeId: node.id,
    down: { x: event.clientX, y: event.clientY, t: Date.now() },
  };
}

function resolveTap(pending: PendingTap | null, event: PointerUpEvent): string | null {
  if (!pending || pending.pointerId !== event.pointerId) return null;
  const up: PointerPoint = { x: event.clientX, y: event.clientY, t: Date.now() };
  return isTap(pending.down, up) ? pending.nodeId : null;
}

export function PersonNodes({
  nodes,
  positions,
  edges,
  focusId,
  selectedId,
  directlyConnected,
  activeStates,
  reducedMotion,
  liveRef,
  onSelect,
}: {
  nodes: Node[];
  positions: Map<string, Vec3>;
  edges: Edge[];
  focusId: string | null;
  selectedId: string | null;
  directlyConnected: Set<string>;
  /** null = sin filtro, se ve todo normal. Si no, los estados fuera del set se atenúan. */
  activeStates: Set<NodeState> | null;
  reducedMotion: boolean;
  liveRef: LiveNodesRef;
  onSelect: (id: string) => void;
}) {
  const filledMeshRef = useRef<InstancedMesh>(null);
  const wireMeshRef = useRef<InstancedMesh>(null);
  const pendingTap = useRef<PendingTap | null>(null);
  const entryStartRef = useRef(new Map<string, number>());
  const clockRef = useRef(0);
  // El propio vaivén de cada nodo (sin el aporte heredado del padre), para
  // que sus hijos puedan tirar de él con un frame de desfase: así el efecto
  // "atado por un hilo" se propaga cadena abajo sin depender del orden en
  // que se recorren los nodos.
  const ownOffsetRef = useRef(new Map<string, Vector3>());

  const parentOf = useMemo(() => new Map(edges.map((edge) => [edge.to, edge.from])), [edges]);
  const dummy = useMemo(() => new Object3D(), []);
  const offsetVec = useMemo(() => new Vector3(), []);

  // "sent" (invitación enviada, sin abrir) todavía no es cliente: se pinta
  // en wireframe, sin relleno, y por eso necesita su propio InstancedMesh
  // -un mesh instanciado solo puede tener un material para todas sus
  // instancias, y wireframe/relleno son materiales distintos.
  const filledNodes = useMemo(() => nodes.filter((n) => n.state !== "sent"), [nodes]);
  const wireNodes = useMemo(() => nodes.filter((n) => n.state === "sent"), [nodes]);
  const filledIndexOf = useMemo(() => new Map(filledNodes.map((n, i) => [n.id, i])), [filledNodes]);
  const wireIndexOf = useMemo(() => new Map(wireNodes.map((n, i) => [n.id, i])), [wireNodes]);

  useEffect(() => {
    const now = clockRef.current;
    for (const node of nodes) {
      if (!entryStartRef.current.has(node.id)) entryStartRef.current.set(node.id, now);
    }
  }, [nodes]);

  useFrame((_, delta) => {
    clockRef.current += delta;
    const elapsed = clockRef.current;
    const filledMesh = filledMeshRef.current;
    const wireMesh = wireMeshRef.current;
    if (!filledMesh) return;
    const now = Date.now();

    nodes.forEach((node) => {
      const basePos = positions.get(node.id);
      if (!basePos) return;

      const mesh = node.state === "sent" ? wireMesh : filledMesh;
      const index = node.state === "sent" ? wireIndexOf.get(node.id) : filledIndexOf.get(node.id);
      if (!mesh || index == null) return;

      let live = liveRef.current.get(node.id);
      if (!live) {
        live = { position: new Vector3(), radius: 0 };
        liveRef.current.set(node.id, live);
      }

      const startedAt = entryStartRef.current.get(node.id) ?? elapsed;
      const sinceStart = elapsed - startedAt - node.depth * ENTRY_STAGGER_SEC;
      const targetRadius = sinceStart > 0 ? computeRadius(node.stamps) : 0;
      const dampedRadius = reducedMotion
        ? targetRadius
        : MathUtils.damp(live.radius, targetRadius, RADIUS_DAMP_LAMBDA, delta);
      const breathe = reducedMotion ? 1 : breathingScale(elapsed * 1000, node.id);
      const expiring = isExpiringSoon(node.expiresAt, now);
      const pulse = expiring ? 0.5 + 0.5 * Math.sin(elapsed * EXPIRING_PULSE_SPEED) : 0;
      const renderedRadius = dampedRadius * breathe * (expiring ? 1 + pulse * 0.1 : 1);

      let px = basePos.x;
      let py = basePos.y;
      let pz = basePos.z;
      if (!reducedMotion && dampedRadius > 0.01) {
        organicOffset(node.id, elapsed, OFFSET_AMPLITUDE_FACTOR * dampedRadius, offsetVec);
        let ownOffset = ownOffsetRef.current.get(node.id);
        if (!ownOffset) {
          ownOffset = new Vector3();
          ownOffsetRef.current.set(node.id, ownOffset);
        }
        ownOffset.copy(offsetVec);

        const parentId = parentOf.get(node.id);
        const parentOffset = parentId ? ownOffsetRef.current.get(parentId) : undefined;
        px += offsetVec.x + (parentOffset ? parentOffset.x * PARENT_SWAY_FACTOR : 0);
        py += offsetVec.y + (parentOffset ? parentOffset.y * PARENT_SWAY_FACTOR : 0);
        pz += offsetVec.z + (parentOffset ? parentOffset.z * PARENT_SWAY_FACTOR : 0);
      }

      live.position.set(px, py, pz);
      live.radius = dampedRadius;

      dummy.position.set(px, py, pz);
      dummy.scale.setScalar(renderedRadius);
      dummy.updateMatrix();
      mesh.setMatrixAt(index, dummy.matrix);

      const isFocused = node.id === focusId || node.id === selectedId;
      const isFilteredOut = activeStates != null && !activeStates.has(node.state);
      const isSelectionDim = selectedId != null && !isFocused && !directlyConnected.has(node.id);

      let color = stateColor(node.state);
      const recency = recencyFactor(node.lastActivityAt, now);
      if (!isFocused) color = dimColor(color, (1 - recency) * 0.6);

      if (isFilteredOut) {
        color = dimColor(color, 0.92);
      } else {
        if (isSelectionDim) color = dimColor(color, 0.75);
        if (isFocused) color = LIME_COLOR.clone();
        if (expiring) color = color.lerp(CORAL_COLOR, pulse * 0.6);
      }
      mesh.setColorAt(index, color);
    });

    filledMesh.instanceMatrix.needsUpdate = true;
    if (filledMesh.instanceColor) filledMesh.instanceColor.needsUpdate = true;
    if (wireMesh) {
      wireMesh.instanceMatrix.needsUpdate = true;
      if (wireMesh.instanceColor) wireMesh.instanceColor.needsUpdate = true;
    }
  });

  function handleFilledPointerDown(event: PointerDownEvent) {
    const tap = beginTap(filledNodes, event);
    if (tap) pendingTap.current = tap;
  }

  function handleFilledPointerUp(event: PointerUpEvent) {
    const pending = pendingTap.current;
    pendingTap.current = null;
    const nodeId = resolveTap(pending, event);
    if (nodeId) onSelect(nodeId);
  }

  function handleWirePointerDown(event: PointerDownEvent) {
    const tap = beginTap(wireNodes, event);
    if (tap) pendingTap.current = tap;
  }

  function handleWirePointerUp(event: PointerUpEvent) {
    const pending = pendingTap.current;
    pendingTap.current = null;
    const nodeId = resolveTap(pending, event);
    if (nodeId) onSelect(nodeId);
  }

  return (
    <>
      <instancedMesh
        ref={filledMeshRef}
        args={[undefined, undefined, Math.max(filledNodes.length, 1)]}
        geometry={SPHERE_GEOMETRY}
        onPointerDown={handleFilledPointerDown}
        onPointerUp={handleFilledPointerUp}
        onPointerCancel={() => {
          pendingTap.current = null;
        }}
      >
        <meshPhysicalMaterial
          roughness={0.28}
          metalness={0.05}
          clearcoat={0.6}
          clearcoatRoughness={0.25}
          emissive={LIME}
          emissiveIntensity={0.12}
        />
      </instancedMesh>
      {wireNodes.length > 0 ? (
        <instancedMesh
          ref={wireMeshRef}
          args={[undefined, undefined, wireNodes.length]}
          geometry={SPHERE_GEOMETRY}
          onPointerDown={handleWirePointerDown}
          onPointerUp={handleWirePointerUp}
          onPointerCancel={() => {
            pendingTap.current = null;
          }}
        >
          <meshBasicMaterial wireframe transparent opacity={0.6} />
        </instancedMesh>
      ) : null}
    </>
  );
}
