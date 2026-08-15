"use client";

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import { BufferAttribute, BufferGeometry, LineBasicMaterial, type LineSegments, MathUtils, type Mesh, Vector3 } from "three";
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

/** Cuántos tramos rectos aproximan la curva ondulada de cada conexión. */
const SEGMENTS_PER_EDGE = 10;
const WAVE_FREQUENCY = 1.5;
const WAVE_SPEED = 1.1;
const WAVE_AMPLITUDE_FACTOR = 0.09;
const WAVE_AMPLITUDE_MAX = 0.6;

const UP = new Vector3(0, 1, 0);
const RIGHT = new Vector3(1, 0, 0);

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

/**
 * Un punto sobre la curva ondulada entre dos extremos: se desplaza en el
 * plano perpendicular a la conexión con una onda que viaja en el tiempo, y
 * se anula en los dos extremos (envelope) para que la línea siga saliendo
 * exactamente de cada esfera, no flotando al lado.
 */
function wavyPoint(
  from: Vector3,
  to: Vector3,
  t: number,
  seed: number,
  elapsedSeconds: number,
  out: Vector3,
  scratchDir: Vector3,
  scratchPerp: Vector3,
): Vector3 {
  scratchDir.subVectors(to, from);
  const length = scratchDir.length();
  out.copy(from).lerp(to, t);
  if (length < 1e-4) return out;

  scratchDir.multiplyScalar(1 / length);
  scratchPerp.crossVectors(scratchDir, Math.abs(scratchDir.y) < 0.9 ? UP : RIGHT).normalize();
  const amplitude = Math.min(WAVE_AMPLITUDE_MAX, length * WAVE_AMPLITUDE_FACTOR);
  const envelope = Math.sin(t * Math.PI);
  const wave = Math.sin(t * WAVE_FREQUENCY * Math.PI * 2 + seed + elapsedSeconds * WAVE_SPEED) * amplitude * envelope;
  return out.addScaledVector(scratchPerp, wave);
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
  const pointA = useMemo(() => new Vector3(), []);
  const pointB = useMemo(() => new Vector3(), []);
  const scratchDir = useMemo(() => new Vector3(), []);
  const scratchPerp = useMemo(() => new Vector3(), []);
  const clock = useRef(0);

  // Solo se reconstruye cuando cambia cuántas conexiones hay; el contenido
  // (posiciones, colores) se rellena cada frame más abajo, sin reasignar.
  const { geometry, material } = useMemo(() => {
    const geo = new BufferGeometry();
    const vertexCount = edges.length * SEGMENTS_PER_EDGE * 2;
    geo.setAttribute("position", new BufferAttribute(new Float32Array(vertexCount * 3), 3));
    geo.setAttribute("color", new BufferAttribute(new Float32Array(vertexCount * 4), 4));
    const mat = new LineBasicMaterial({ vertexColors: true, transparent: true });
    return { geometry: geo, material: mat };
  }, [edges.length]);

  useFrame((_, delta) => {
    clock.current += reducedMotion ? 0 : delta;
    const elapsed = clock.current;
    const posAttr = geometry.getAttribute("position") as BufferAttribute;
    const colorAttr = geometry.getAttribute("color") as BufferAttribute;

    edges.forEach((edge, edgeIndex) => {
      resolveLivePosition(edge.from, establishmentId, positions, liveRef, fromVec);
      resolveLivePosition(edge.to, establishmentId, positions, liveRef, toVec);

      const focused = directlyConnected.has(edge.from) && directlyConnected.has(edge.to);
      const color = focused ? LIME_COLOR : CHALK_COLOR;
      const parentAlpha = focused ? PARENT_ALPHA_FOCUSED : hasSelection ? PARENT_ALPHA_DIM : PARENT_ALPHA_NORMAL;
      const childAlpha = parentAlpha * CHILD_ALPHA_FACTOR;
      const seed = seedOffset(`${edge.from}->${edge.to}`) * Math.PI * 2;

      for (let seg = 0; seg < SEGMENTS_PER_EDGE; seg++) {
        const tA = seg / SEGMENTS_PER_EDGE;
        const tB = (seg + 1) / SEGMENTS_PER_EDGE;
        wavyPoint(fromVec, toVec, tA, seed, elapsed, pointA, scratchDir, scratchPerp);
        wavyPoint(fromVec, toVec, tB, seed, elapsed, pointB, scratchDir, scratchPerp);

        const vertexBase = (edgeIndex * SEGMENTS_PER_EDGE + seg) * 2;
        const posBase = vertexBase * 3;
        posAttr.array[posBase] = pointA.x;
        posAttr.array[posBase + 1] = pointA.y;
        posAttr.array[posBase + 2] = pointA.z;
        posAttr.array[posBase + 3] = pointB.x;
        posAttr.array[posBase + 4] = pointB.y;
        posAttr.array[posBase + 5] = pointB.z;

        const alphaA = MathUtils.lerp(parentAlpha, childAlpha, tA);
        const alphaB = MathUtils.lerp(parentAlpha, childAlpha, tB);
        const colorBase = vertexBase * 4;
        colorAttr.array[colorBase] = color.r;
        colorAttr.array[colorBase + 1] = color.g;
        colorAttr.array[colorBase + 2] = color.b;
        colorAttr.array[colorBase + 3] = alphaA;
        colorAttr.array[colorBase + 4] = color.r;
        colorAttr.array[colorBase + 5] = color.g;
        colorAttr.array[colorBase + 6] = color.b;
        colorAttr.array[colorBase + 7] = alphaB;
      }
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
  const seed = useMemo(() => seedOffset(`${fromId}->${toId}`) * Math.PI * 2, [fromId, toId]);
  const a = useMemo(() => new Vector3(), []);
  const b = useMemo(() => new Vector3(), []);
  const scratchDir = useMemo(() => new Vector3(), []);
  const scratchPerp = useMemo(() => new Vector3(), []);
  const elapsed = useRef(0);

  useFrame((_, delta) => {
    clock.current = (clock.current + delta) % PARTICLE_PERIOD_SEC;
    elapsed.current += delta;
    const t = clock.current / PARTICLE_PERIOD_SEC;
    resolveLivePosition(fromId, establishmentId, positions, liveRef, a);
    resolveLivePosition(toId, establishmentId, positions, liveRef, b);
    if (!ref.current) return;
    wavyPoint(a, b, t, seed, elapsed.current, ref.current.position, scratchDir, scratchPerp);
  });

  return (
    <mesh ref={ref} geometry={SPHERE_GEOMETRY} scale={0.09}>
      <meshBasicMaterial color={LIME} />
    </mesh>
  );
}
