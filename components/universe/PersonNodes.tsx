"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import { Color, InstancedMesh, MathUtils, Object3D, Vector3 } from "three";
import { organicOffset } from "@/components/universe/organicOffset";
import { chainColor, dimColor, LIME } from "@/components/universe/palette";
import { SPHERE_GEOMETRY } from "@/components/universe/sphereGeometry";
import { breathingScale, computeRadius } from "@/lib/giftGraph/organicMotion";
import { isTap, type PointerPoint } from "@/lib/giftGraph/tapGesture";
import type { LiveNodesRef } from "@/components/universe/liveNodes";
import type { Node } from "@/lib/giftGraph/types";
import type { Vec3 } from "@/lib/giftGraph/sphereLayout";

/** Cuánto tarda en converger el radio hacia su objetivo: mayor = más rápido. */
const RADIUS_DAMP_LAMBDA = 4;
/** Deriva orgánica como fracción del radio del propio nodo. */
const OFFSET_AMPLITUDE_FACTOR = 0.18;
const ENTRY_STAGGER_SEC = 0.09;

type PendingTap = { pointerId: number; nodeId: string; down: PointerPoint };

export function PersonNodes({
  nodes,
  positions,
  roots,
  focusId,
  selectedId,
  directlyConnected,
  reducedMotion,
  liveRef,
  onSelect,
}: {
  nodes: Node[];
  positions: Map<string, Vec3>;
  roots: string[];
  focusId: string | null;
  selectedId: string | null;
  directlyConnected: Set<string>;
  reducedMotion: boolean;
  liveRef: LiveNodesRef;
  onSelect: (id: string) => void;
}) {
  const meshRef = useRef<InstancedMesh>(null);
  const pendingTap = useRef<PendingTap | null>(null);
  const entryStartRef = useRef(new Map<string, number>());
  const clockRef = useRef(0);

  const rootIndex = useMemo(() => new Map(roots.map((id, index) => [id, index])), [roots]);
  const dummy = useMemo(() => new Object3D(), []);
  const offsetVec = useMemo(() => new Vector3(), []);

  useEffect(() => {
    const now = clockRef.current;
    for (const node of nodes) {
      if (!entryStartRef.current.has(node.id)) entryStartRef.current.set(node.id, now);
    }
  }, [nodes]);

  useFrame((_, delta) => {
    clockRef.current += delta;
    const elapsed = clockRef.current;
    const mesh = meshRef.current;
    if (!mesh) return;

    nodes.forEach((node, index) => {
      const basePos = positions.get(node.id);
      if (!basePos) return;

      let live = liveRef.current.get(node.id);
      if (!live) {
        live = { position: new Vector3(), radius: 0 };
        liveRef.current.set(node.id, live);
      }

      const startedAt = entryStartRef.current.get(node.id) ?? elapsed;
      const sinceStart = elapsed - startedAt - node.depth * ENTRY_STAGGER_SEC;
      const targetRadius = sinceStart > 0 ? computeRadius(node.childCount) : 0;
      const dampedRadius = reducedMotion
        ? targetRadius
        : MathUtils.damp(live.radius, targetRadius, RADIUS_DAMP_LAMBDA, delta);
      const breathe = reducedMotion ? 1 : breathingScale(elapsed * 1000, node.id);
      const renderedRadius = dampedRadius * breathe;

      let px = basePos.x;
      let py = basePos.y;
      let pz = basePos.z;
      if (!reducedMotion && dampedRadius > 0.01) {
        organicOffset(node.id, elapsed, OFFSET_AMPLITUDE_FACTOR * dampedRadius, offsetVec);
        px += offsetVec.x;
        py += offsetVec.y;
        pz += offsetVec.z;
      }

      live.position.set(px, py, pz);
      live.radius = dampedRadius;

      dummy.position.set(px, py, pz);
      dummy.scale.setScalar(renderedRadius);
      dummy.updateMatrix();
      mesh.setMatrixAt(index, dummy.matrix);

      const isFocused = node.id === focusId || node.id === selectedId;
      const isDim = selectedId != null && !isFocused && !directlyConnected.has(node.id);
      const base = chainColor(rootIndex.get(node.rootId) ?? 0, roots.length);
      const color = isDim ? dimColor(base, 0.75) : isFocused ? new Color(LIME) : base;
      mesh.setColorAt(index, color);
    });

    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  });

  function handlePointerDown(event: {
    instanceId?: number;
    pointerId: number;
    clientX: number;
    clientY: number;
    stopPropagation: () => void;
  }) {
    if (event.instanceId == null) return;
    const node = nodes[event.instanceId];
    if (!node) return;
    event.stopPropagation();
    pendingTap.current = {
      pointerId: event.pointerId,
      nodeId: node.id,
      down: { x: event.clientX, y: event.clientY, t: Date.now() },
    };
  }

  function handlePointerUp(event: { pointerId: number; clientX: number; clientY: number }) {
    const pending = pendingTap.current;
    pendingTap.current = null;
    if (!pending || pending.pointerId !== event.pointerId) return;
    const up: PointerPoint = { x: event.clientX, y: event.clientY, t: Date.now() };
    if (isTap(pending.down, up)) onSelect(pending.nodeId);
  }

  return (
    <instancedMesh
      ref={meshRef}
      args={[undefined, undefined, Math.max(nodes.length, 1)]}
      geometry={SPHERE_GEOMETRY}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
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
  );
}
