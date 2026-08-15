"use client";

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import { AdditiveBlending, type Mesh, type Sprite } from "three";
import { getGlowTexture } from "@/components/universe/glowTexture";
import { LIME } from "@/components/universe/palette";
import { SPHERE_GEOMETRY } from "@/components/universe/sphereGeometry";
import { breathingScale } from "@/lib/giftGraph/organicMotion";

const ESTABLISHMENT_FACTOR = 1.4;
const GLOW_SCALE = 2.6;

export function EstablishmentCore({
  maxNodeRadius,
  reducedMotion,
}: {
  maxNodeRadius: number;
  reducedMotion: boolean;
}) {
  const coreRef = useRef<Mesh>(null);
  const glowRef = useRef<Sprite>(null);
  const clock = useRef(0);
  const texture = useMemo(() => getGlowTexture(), []);

  // El establecimiento siempre es la esfera más grande de la escena.
  const radius = maxNodeRadius * ESTABLISHMENT_FACTOR;

  useFrame((_, delta) => {
    clock.current += delta;
    const breathe = reducedMotion ? 1 : breathingScale(clock.current * 1000, "establishment", 6000, 8000);
    const scale = radius * breathe;
    coreRef.current?.scale.setScalar(scale);
    glowRef.current?.scale.setScalar(scale * GLOW_SCALE);
  });

  return (
    <group>
      <mesh ref={coreRef} geometry={SPHERE_GEOMETRY} scale={radius}>
        <meshPhysicalMaterial
          color={LIME}
          roughness={0.28}
          metalness={0.05}
          clearcoat={0.6}
          clearcoatRoughness={0.25}
          emissive={LIME}
          emissiveIntensity={0.35}
        />
      </mesh>
      <sprite ref={glowRef} scale={radius * GLOW_SCALE}>
        <spriteMaterial
          map={texture}
          color={LIME}
          transparent
          opacity={0.5}
          depthWrite={false}
          blending={AdditiveBlending}
        />
      </sprite>
      <pointLight color={LIME} intensity={8} distance={30} decay={2} />
    </group>
  );
}
