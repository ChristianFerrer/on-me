"use client";

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import { AdditiveBlending, type Group } from "three";
import { getGlowTexture } from "@/components/universe/glowTexture";
import { LIME } from "@/components/universe/palette";
import type { LiveNodesRef } from "@/components/universe/liveNodes";

const GLOW_SCALE = 3.2;

/**
 * El halo de "tiene más gente sin cargar" como sprite con textura de
 * gradiente radial (mira siempre a la cámara por sí solo, es un Sprite),
 * en vez de una esfera translúcida de pocos polígonos: sin degradado esa
 * esfera se ve como un disco plano, no como un brillo.
 */
export function GlowSprites({
  haloNodeIds,
  liveRef,
  reducedMotion,
}: {
  haloNodeIds: string[];
  liveRef: LiveNodesRef;
  reducedMotion: boolean;
}) {
  const groupRef = useRef<Group>(null);
  const texture = useMemo(() => getGlowTexture(), []);
  const clock = useRef(0);

  useFrame((_, delta) => {
    clock.current += delta;
    const group = groupRef.current;
    if (!group) return;

    group.children.forEach((child, index) => {
      const live = liveRef.current.get(haloNodeIds[index]);
      if (!live || live.radius <= 0) {
        child.visible = false;
        return;
      }
      child.visible = true;
      child.position.copy(live.position);
      const pulse = reducedMotion ? 1 : 1 + Math.sin(clock.current * 1.6 + index) * 0.12;
      child.scale.setScalar(live.radius * GLOW_SCALE * pulse);
    });
  });

  if (haloNodeIds.length === 0) return null;

  return (
    <group ref={groupRef}>
      {haloNodeIds.map((id) => (
        <sprite key={id}>
          <spriteMaterial
            map={texture}
            color={LIME}
            transparent
            opacity={0.55}
            depthWrite={false}
            blending={AdditiveBlending}
          />
        </sprite>
      ))}
    </group>
  );
}
