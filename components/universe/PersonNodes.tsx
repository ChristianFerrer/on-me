"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import { Color, InstancedMesh, Object3D } from "three";
import { chainColor, dimColor, LIME } from "@/components/universe/palette";
import { isTap, type PointerPoint } from "@/lib/giftGraph/tapGesture";
import type { Node } from "@/lib/giftGraph/types";
import type { Vec3 } from "@/lib/giftGraph/sphereLayout";

const NODE_RADIUS = 0.55;
const HALO_RADIUS = NODE_RADIUS * 1.7;
const ENTRY_DURATION_MS = 500;
const ENTRY_STAGGER_MS = 90;

type PendingTap = { pointerId: number; nodeId: string; down: PointerPoint };

export function PersonNodes({
  nodes,
  positions,
  roots,
  focusId,
  selectedId,
  directlyConnected,
  reducedMotion,
  onSelect,
}: {
  nodes: Node[];
  positions: Map<string, Vec3>;
  roots: string[];
  focusId: string | null;
  selectedId: string | null;
  directlyConnected: Set<string>;
  reducedMotion: boolean;
  onSelect: (id: string) => void;
}) {
  const meshRef = useRef<InstancedMesh>(null);
  const haloMeshRef = useRef<InstancedMesh>(null);
  const pendingTap = useRef<PendingTap | null>(null);
  const entryStartRef = useRef(new Map<string, number>());
  const clockRef = useRef(0);

  const rootIndex = useMemo(() => new Map(roots.map((id, index) => [id, index])), [roots]);
  const dummy = useMemo(() => new Object3D(), []);

  const haloIds = useMemo(() => nodes.filter((n) => n.childCount > n.loadedChildCount).map((n) => n.id), [nodes]);

  useEffect(() => {
    const now = clockRef.current;
    for (const node of nodes) {
      if (!entryStartRef.current.has(node.id)) entryStartRef.current.set(node.id, now);
    }
  }, [nodes]);

  useFrame((_, delta) => {
    clockRef.current += delta * 1000;
    const mesh = meshRef.current;
    const halo = haloMeshRef.current;
    if (!mesh) return;

    nodes.forEach((node, index) => {
      const pos = positions.get(node.id);
      if (!pos) return;

      const startedAt = entryStartRef.current.get(node.id) ?? clockRef.current;
      const elapsed = clockRef.current - startedAt - node.depth * ENTRY_STAGGER_MS;
      const entryT = reducedMotion ? 1 : Math.max(0, Math.min(1, elapsed / ENTRY_DURATION_MS));
      const eased = 1 - (1 - entryT) * (1 - entryT);
      const scale = eased * NODE_RADIUS;

      dummy.position.set(pos.x, pos.y, pos.z);
      dummy.scale.setScalar(scale);
      dummy.updateMatrix();
      mesh.setMatrixAt(index, dummy.matrix);

      const isFocused = node.id === focusId || node.id === selectedId;
      const isDim = selectedId != null && !isFocused && !directlyConnected.has(node.id);
      const base = chainColor(rootIndex.get(node.rootId) ?? 0, roots.length);
      const color = isDim ? dimColor(base, 0.75) : isFocused ? new Color(LIME) : base;
      mesh.setColorAt(index, color);

      if (halo) {
        const haloIndex = haloIds.indexOf(node.id);
        if (haloIndex >= 0) {
          const pulse = reducedMotion ? 1 : 1 + Math.sin(clockRef.current / 450 + index) * 0.08;
          dummy.scale.setScalar(scale > 0 ? HALO_RADIUS * pulse * (scale / NODE_RADIUS) : 0);
          dummy.updateMatrix();
          halo.setMatrixAt(haloIndex, dummy.matrix);
        }
      }
    });

    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    if (halo) halo.instanceMatrix.needsUpdate = true;
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
    <>
      <instancedMesh
        ref={meshRef}
        args={[undefined, undefined, Math.max(nodes.length, 1)]}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerCancel={() => {
          pendingTap.current = null;
        }}
      >
        <sphereGeometry args={[1, 20, 20]} />
        <meshStandardMaterial roughness={0.4} metalness={0.1} />
      </instancedMesh>
      {haloIds.length > 0 ? (
        // Esfera de brillo en vez de un anillo plano: un InstancedMesh no
        // puede orientar cada instancia hacia la cámara, así que un anillo
        // se vería de canto y "desaparecería" al girar el universo.
        <instancedMesh ref={haloMeshRef} args={[undefined, undefined, haloIds.length]}>
          <sphereGeometry args={[1, 16, 16]} />
          <meshBasicMaterial color={LIME} transparent opacity={0.18} depthWrite={false} />
        </instancedMesh>
      ) : null}
    </>
  );
}
