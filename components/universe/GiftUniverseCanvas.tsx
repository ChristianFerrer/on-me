"use client";

import { OrbitControls, Stars } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { useMemo, useRef, useState } from "react";
import { TOUCH, Vector3 } from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { CameraRig } from "@/components/universe/CameraRig";
import { ConnectionLines } from "@/components/universe/ConnectionLines";
import { EstablishmentCore } from "@/components/universe/EstablishmentCore";
import { VOID } from "@/components/universe/palette";
import { PersonLabels } from "@/components/universe/PersonLabels";
import { PersonNodes } from "@/components/universe/PersonNodes";
import type { Dict } from "@/lib/i18n";
import type { Vec3 } from "@/lib/giftGraph/sphereLayout";
import type { GiftGraph } from "@/lib/giftGraph/types";

const AUTO_ROTATE_SPEED = 0.35;
const MIN_DISTANCE = 6;
const MAX_DISTANCE = 90;

export function GiftUniverseCanvas({
  graph,
  positions,
  focusId,
  selectedId,
  directlyConnected,
  reducedMotion,
  onSelect,
  t,
}: {
  graph: GiftGraph;
  positions: Map<string, Vec3>;
  focusId: string | null;
  selectedId: string | null;
  directlyConnected: Set<string>;
  reducedMotion: boolean;
  onSelect: (id: string) => void;
  t: Dict;
}) {
  const controlsRef = useRef<OrbitControlsImpl | null>(null);
  const [interacting, setInteracting] = useState(false);

  const focusPosition = useMemo(() => {
    if (selectedId) {
      const pos = positions.get(selectedId);
      if (pos) return new Vector3(pos.x, pos.y, pos.z);
    }
    return new Vector3(0, 0, 0);
  }, [selectedId, positions]);

  // La rotación automática orbita la cámara (autoRotate de OrbitControls),
  // no el contenido: así las posiciones de los nodos siguen siendo las
  // mismas coordenadas de mundo que usa CameraRig para encuadrar, sin
  // depender de cuánto lleve girando la escena.
  const autoRotate = !reducedMotion && !interacting && selectedId == null;

  return (
    <Canvas
      dpr={[1, 2]}
      gl={{ antialias: false, powerPreference: "high-performance" }}
      camera={{ position: [0, 10, 34], fov: 55, near: 0.1, far: 300 }}
    >
      <color attach="background" args={[VOID]} />
      <fog attach="fog" args={[VOID, 30, 110]} />
      <ambientLight intensity={0.55} />
      <directionalLight position={[12, 18, 10]} intensity={0.6} />

      <Stars
        radius={140}
        depth={60}
        count={reducedMotion ? 800 : 2200}
        factor={2.4}
        saturation={0}
        fade
        speed={reducedMotion ? 0 : 0.4}
      />

      <EstablishmentCore reducedMotion={reducedMotion} />
      <PersonNodes
        nodes={graph.nodes}
        positions={positions}
        roots={graph.roots}
        focusId={focusId}
        selectedId={selectedId}
        directlyConnected={directlyConnected}
        reducedMotion={reducedMotion}
        onSelect={onSelect}
      />
      <PersonLabels nodes={graph.nodes} positions={positions} establishmentName={graph.establishment.name} t={t} />
      <ConnectionLines
        edges={graph.edges}
        positions={positions}
        establishmentId={graph.establishment.id}
        directlyConnected={directlyConnected}
        hasSelection={selectedId != null}
        reducedMotion={reducedMotion}
      />

      <CameraRig focusPosition={focusPosition} controlsRef={controlsRef} />

      <OrbitControls
        ref={controlsRef}
        enablePan={false}
        enableDamping
        dampingFactor={0.08}
        minDistance={MIN_DISTANCE}
        maxDistance={MAX_DISTANCE}
        touches={{ ONE: TOUCH.ROTATE, TWO: TOUCH.DOLLY_ROTATE }}
        autoRotate={autoRotate}
        autoRotateSpeed={AUTO_ROTATE_SPEED}
        onStart={() => setInteracting(true)}
        onEnd={() => setInteracting(false)}
      />
    </Canvas>
  );
}
