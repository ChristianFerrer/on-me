"use client";

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import { AdditiveBlending, type Sprite } from "three";
import { getGlowTexture } from "@/components/universe/glowTexture";
import { AMBER } from "@/components/universe/palette";
import type { LiveNodesRef } from "@/components/universe/liveNodes";

const GLOW_SCALE = 4.2;

/**
 * Un brillo distinto (ámbar, como el veredicto de "tarjeta completa" del
 * escáner) sobre el nodo con más descendencia facturable de todo el mapa:
 * el mejor padrino, de un vistazo. Separado del halo lima de "+N sin
 * cargar" para que no se confundan si coinciden en el mismo nodo.
 */
export function BestPadrinoGlow({
  nodeId,
  liveRef,
  reducedMotion,
}: {
  nodeId: string | null;
  liveRef: LiveNodesRef;
  reducedMotion: boolean;
}) {
  const spriteRef = useRef<Sprite>(null);
  const texture = useMemo(() => getGlowTexture(), []);
  const clock = useRef(0);

  useFrame((_, delta) => {
    clock.current += delta;
    const sprite = spriteRef.current;
    if (!sprite || !nodeId) return;
    const live = liveRef.current.get(nodeId);
    if (!live || live.radius <= 0) {
      sprite.visible = false;
      return;
    }
    sprite.visible = true;
    sprite.position.copy(live.position);
    const pulse = reducedMotion ? 1 : 1 + Math.sin(clock.current * 1.1) * 0.15;
    sprite.scale.setScalar(live.radius * GLOW_SCALE * pulse);
  });

  if (!nodeId) return null;

  return (
    <sprite ref={spriteRef}>
      <spriteMaterial map={texture} color={AMBER} transparent opacity={0.45} depthWrite={false} blending={AdditiveBlending} />
    </sprite>
  );
}
