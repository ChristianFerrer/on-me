"use client";

import { Line } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import { Mesh, Vector3 } from "three";
import { CHALK, LIME } from "@/components/universe/palette";
import type { Edge } from "@/lib/giftGraph/types";
import type { Vec3 } from "@/lib/giftGraph/sphereLayout";

const ORIGIN: Vec3 = { x: 0, y: 0, z: 0 };
const PARTICLE_PERIOD_MS = 2600;

function endpoint(id: string, establishmentId: string, positions: Map<string, Vec3>): Vec3 | null {
  if (id === establishmentId) return ORIGIN;
  return positions.get(id) ?? null;
}

export function ConnectionLines({
  edges,
  positions,
  establishmentId,
  directlyConnected,
  hasSelection,
  reducedMotion,
}: {
  edges: Edge[];
  positions: Map<string, Vec3>;
  establishmentId: string;
  directlyConnected: Set<string>;
  hasSelection: boolean;
  reducedMotion: boolean;
}) {
  const segments = useMemo(() => {
    return edges
      .map((edge) => {
        const from = endpoint(edge.from, establishmentId, positions);
        const to = endpoint(edge.to, establishmentId, positions);
        if (!from || !to) return null;
        const focused = directlyConnected.has(edge.from) && directlyConnected.has(edge.to);
        return { key: `${edge.from}->${edge.to}`, from, to, focused };
      })
      .filter((segment): segment is NonNullable<typeof segment> => segment !== null);
  }, [edges, positions, establishmentId, directlyConnected]);

  return (
    <group>
      {segments.map((segment) => (
        <Line
          key={segment.key}
          points={[
            [segment.from.x, segment.from.y, segment.from.z],
            [segment.to.x, segment.to.y, segment.to.z],
          ]}
          color={segment.focused ? LIME : CHALK}
          transparent
          opacity={segment.focused ? 0.9 : hasSelection ? 0.08 : 0.28}
        />
      ))}
      {!reducedMotion
        ? segments
            .filter((segment) => segment.focused)
            .map((segment) => (
              <GiftParticle key={`particle-${segment.key}`} seedKey={segment.key} from={segment.from} to={segment.to} />
            ))
        : null}
    </group>
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

function GiftParticle({ seedKey, from, to }: { seedKey: string; from: Vec3; to: Vec3 }) {
  const ref = useRef<Mesh>(null);
  const clock = useRef(seedOffset(seedKey) * PARTICLE_PERIOD_MS);
  const a = useMemo(() => new Vector3(from.x, from.y, from.z), [from]);
  const b = useMemo(() => new Vector3(to.x, to.y, to.z), [to]);

  useFrame((_, delta) => {
    clock.current = (clock.current + delta * 1000) % PARTICLE_PERIOD_MS;
    const t = clock.current / PARTICLE_PERIOD_MS;
    ref.current?.position.lerpVectors(a, b, t);
  });

  return (
    <mesh ref={ref}>
      <sphereGeometry args={[0.12, 8, 8]} />
      <meshBasicMaterial color={LIME} />
    </mesh>
  );
}
