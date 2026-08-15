"use client";

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import { BufferAttribute, BufferGeometry, LineBasicMaterial, type LineSegments, type Mesh, Vector3 } from "three";
import { CHALK_COLOR, LIME, LIME_COLOR } from "@/components/universe/palette";
import { SPHERE_GEOMETRY } from "@/components/universe/sphereGeometry";
import type { LiveNodesRef } from "@/components/universe/liveNodes";
import type { Edge } from "@/lib/giftGraph/types";
import type { Vec3 } from "@/lib/giftGraph/sphereLayout";

const PARTICLE_PERIOD_SEC = 2.6;
const PARENT_ALPHA_FOCUSED = 0.9;
const PARENT_ALPHA_DIM = 0.08;
const PARENT_ALPHA_NORMAL = 0.28;
/** La conexión se desvanece hacia el hijo: el extremo del hijo se queda en esta fracción. */
const CHILD_ALPHA_FACTOR = 0.35;

/**
 * Posición actual (base + deriva orgánica) de un extremo de conexión. El
 * establecimiento no está en liveRef (no es un "nodo"); un nodo real sin
 * entrada todavía en liveRef (primer frame) cae de vuelta a su posición
 * base para no parpadear en el origen.
 */
function resolveLivePosition(
  id: string,
  establishmentId: string,
  positions: Map<string, Vec3>,
  liveRef: LiveNodesRef,
  out: Vector3,
): Vector3 {
  if (id === establishmentId) return out.set(0, 0, 0);
  const live = liveRef.current.get(id);
  if (live) return out.copy(live.position);
  const base = positions.get(id);
  return base ? out.set(base.x, base.y, base.z) : out.set(0, 0, 0);
}

export function ConnectionLines({
  edges,
  positions,
  establishmentId,
  directlyConnected,
  hasSelection,
  liveRef,
  reducedMotion,
}: {
  edges: Edge[];
  positions: Map<string, Vec3>;
  establishmentId: string;
  directlyConnected: Set<string>;
  hasSelection: boolean;
  liveRef: LiveNodesRef;
  reducedMotion: boolean;
}) {
  const lineRef = useRef<LineSegments>(null);
  const fromVec = useMemo(() => new Vector3(), []);
  const toVec = useMemo(() => new Vector3(), []);

  // Solo se reconstruye cuando cambia cuántas conexiones hay; el contenido
  // (posiciones, colores) se rellena cada frame más abajo, sin reasignar.
  const { geometry, material } = useMemo(() => {
    const geo = new BufferGeometry();
    geo.setAttribute("position", new BufferAttribute(new Float32Array(edges.length * 2 * 3), 3));
    geo.setAttribute("color", new BufferAttribute(new Float32Array(edges.length * 2 * 4), 4));
    const mat = new LineBasicMaterial({ vertexColors: true, transparent: true });
    return { geometry: geo, material: mat };
  }, [edges.length]);

  useFrame(() => {
    const posAttr = geometry.getAttribute("position") as BufferAttribute;
    const colorAttr = geometry.getAttribute("color") as BufferAttribute;

    edges.forEach((edge, index) => {
      resolveLivePosition(edge.from, establishmentId, positions, liveRef, fromVec);
      resolveLivePosition(edge.to, establishmentId, positions, liveRef, toVec);

      const base = index * 6;
      posAttr.array[base] = fromVec.x;
      posAttr.array[base + 1] = fromVec.y;
      posAttr.array[base + 2] = fromVec.z;
      posAttr.array[base + 3] = toVec.x;
      posAttr.array[base + 4] = toVec.y;
      posAttr.array[base + 5] = toVec.z;

      const focused = directlyConnected.has(edge.from) && directlyConnected.has(edge.to);
      const color = focused ? LIME_COLOR : CHALK_COLOR;
      const parentAlpha = focused ? PARENT_ALPHA_FOCUSED : hasSelection ? PARENT_ALPHA_DIM : PARENT_ALPHA_NORMAL;
      const childAlpha = parentAlpha * CHILD_ALPHA_FACTOR;

      const cbase = index * 8;
      colorAttr.array[cbase] = color.r;
      colorAttr.array[cbase + 1] = color.g;
      colorAttr.array[cbase + 2] = color.b;
      colorAttr.array[cbase + 3] = parentAlpha;
      colorAttr.array[cbase + 4] = color.r;
      colorAttr.array[cbase + 5] = color.g;
      colorAttr.array[cbase + 6] = color.b;
      colorAttr.array[cbase + 7] = childAlpha;
    });

    posAttr.needsUpdate = true;
    colorAttr.needsUpdate = true;
  });

  const focusedEdges = useMemo(
    () => edges.filter((edge) => directlyConnected.has(edge.from) && directlyConnected.has(edge.to)),
    [edges, directlyConnected],
  );

  return (
    <>
      <lineSegments ref={lineRef} geometry={geometry} material={material} />
      {!reducedMotion
        ? focusedEdges.map((edge) => (
            <GiftParticle
              key={`${edge.from}->${edge.to}`}
              fromId={edge.from}
              toId={edge.to}
              establishmentId={establishmentId}
              positions={positions}
              liveRef={liveRef}
            />
          ))
        : null}
    </>
  );
}

/** Desfase determinista a partir del id de la conexión, sin Math.random(). */
function seedOffset(key: string): number {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 1000) / 1000;
}

function GiftParticle({
  fromId,
  toId,
  establishmentId,
  positions,
  liveRef,
}: {
  fromId: string;
  toId: string;
  establishmentId: string;
  positions: Map<string, Vec3>;
  liveRef: LiveNodesRef;
}) {
  const ref = useRef<Mesh>(null);
  const clock = useRef(seedOffset(`${fromId}->${toId}`) * PARTICLE_PERIOD_SEC);
  const a = useMemo(() => new Vector3(), []);
  const b = useMemo(() => new Vector3(), []);

  useFrame((_, delta) => {
    clock.current = (clock.current + delta) % PARTICLE_PERIOD_SEC;
    const t = clock.current / PARTICLE_PERIOD_SEC;
    resolveLivePosition(fromId, establishmentId, positions, liveRef, a);
    resolveLivePosition(toId, establishmentId, positions, liveRef, b);
    ref.current?.position.lerpVectors(a, b, t);
  });

  return (
    <mesh ref={ref} geometry={SPHERE_GEOMETRY} scale={0.12}>
      <meshBasicMaterial color={LIME} />
    </mesh>
  );
}
