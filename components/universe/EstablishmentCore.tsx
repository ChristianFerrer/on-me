"use client";

import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import { Mesh } from "three";
import { LIME } from "@/components/universe/palette";

const CORE_RADIUS = 1.3;

export function EstablishmentCore({ reducedMotion }: { reducedMotion: boolean }) {
  const coreRef = useRef<Mesh>(null);
  const glowRef = useRef<Mesh>(null);
  const clock = useRef(0);

  useFrame((_, delta) => {
    if (reducedMotion) return;
    clock.current += delta;
    const pulse = 1 + Math.sin(clock.current * 1.4) * 0.06;
    coreRef.current?.scale.setScalar(pulse);
    const glowPulse = 1.6 + Math.sin(clock.current * 1.4) * 0.25;
    glowRef.current?.scale.setScalar(glowPulse);
  });

  return (
    <group>
      <mesh ref={coreRef}>
        <icosahedronGeometry args={[CORE_RADIUS, 1]} />
        <meshStandardMaterial color={LIME} roughness={0.3} metalness={0.2} emissive={LIME} emissiveIntensity={0.35} />
      </mesh>
      <mesh ref={glowRef} scale={1.6}>
        <sphereGeometry args={[CORE_RADIUS, 16, 16]} />
        <meshBasicMaterial color={LIME} transparent opacity={0.12} depthWrite={false} />
      </mesh>
      <pointLight color={LIME} intensity={8} distance={30} decay={2} />
    </group>
  );
}
