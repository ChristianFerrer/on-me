"use client";

import { Environment, Lightformer, OrbitControls, Stars } from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import { useMemo, useRef, useState } from "react";
import { ACESFilmicToneMapping, MathUtils, TOUCH, Vector3 } from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { CameraRig } from "@/components/universe/CameraRig";
import { ConnectionLines } from "@/components/universe/ConnectionLines";
import { EstablishmentCore } from "@/components/universe/EstablishmentCore";
import { GlowSprites } from "@/components/universe/GlowSprites";
import type { LiveNode } from "@/components/universe/liveNodes";
import { DEEP_VOID } from "@/components/universe/palette";
import { PersonLabels } from "@/components/universe/PersonLabels";
import { PersonNodes } from "@/components/universe/PersonNodes";
import { computeRadius } from "@/lib/giftGraph/organicMotion";
import type { Dict } from "@/lib/i18n";
import type { Vec3 } from "@/lib/giftGraph/sphereLayout";
import type { GiftGraph } from "@/lib/giftGraph/types";

const MIN_DISTANCE = 6;
const MAX_DISTANCE = 90;
/** ~0.02 rad/s de rotación real: three.js aplica autoRotateSpeed*(π/30) por segundo. */
const TARGET_AUTO_ROTATE_SPEED = 0.19;
const ROTATE_RESUME_DELAY_SEC = 3;
const ROTATE_DAMP_LAMBDA = 1.2;
const FOG_DENSITY = 0.016;

function AutoRotateDamper({
  controlsRef,
  interacting,
  reducedMotion,
}: {
  controlsRef: React.RefObject<OrbitControlsImpl | null>;
  interacting: boolean;
  reducedMotion: boolean;
}) {
  const speedRef = useRef(0);
  const sinceReleaseRef = useRef(0);

  useFrame((_, delta) => {
    const controls = controlsRef.current;
    if (!controls) return;

    if (interacting) sinceReleaseRef.current = 0;
    else sinceReleaseRef.current += delta;

    const canSpin = !reducedMotion && !interacting && sinceReleaseRef.current >= ROTATE_RESUME_DELAY_SEC;
    const target = canSpin ? TARGET_AUTO_ROTATE_SPEED : 0;
    speedRef.current = MathUtils.damp(speedRef.current, target, ROTATE_DAMP_LAMBDA, delta);
    controls.autoRotate = true;
    controls.autoRotateSpeed = speedRef.current;
  });

  return null;
}

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
  const liveNodesRef = useRef(new Map<string, LiveNode>());

  const focusPosition = useMemo(() => {
    if (selectedId) {
      const pos = positions.get(selectedId);
      if (pos) return new Vector3(pos.x, pos.y, pos.z);
    }
    return new Vector3(0, 0, 0);
  }, [selectedId, positions]);

  const maxNodeRadius = useMemo(
    () => graph.nodes.reduce((max, node) => Math.max(max, computeRadius(node.childCount)), 0.55),
    [graph.nodes],
  );
  const haloNodeIds = useMemo(
    () => graph.nodes.filter((n) => n.childCount > n.loadedChildCount).map((n) => n.id),
    [graph.nodes],
  );

  return (
    <Canvas
      dpr={[1, 2]}
      gl={{
        antialias: false,
        powerPreference: "high-performance",
        toneMapping: ACESFilmicToneMapping,
        toneMappingExposure: 1.1,
      }}
      camera={{ position: [0, 10, 34], fov: 55, near: 0.1, far: 300 }}
    >
      <color attach="background" args={[DEEP_VOID]} />
      <fogExp2 attach="fog" args={[DEEP_VOID, FOG_DENSITY]} />

      {/* Luz de tres puntos: key desde arriba-derecha-frente, fill fría desde
          abajo-izquierda, rim detrás de la escena para dibujar el borde de
          cada esfera. Sin esto una esfera lisa se ve como un círculo plano. */}
      <directionalLight position={[16, 20, 14]} intensity={1.6} />
      <directionalLight position={[-14, -6, -8]} intensity={0.35} color="#a8c4ff" />
      <pointLight position={[0, 8, -45]} intensity={2.5} color="#ffffff" distance={140} decay={1.5} />
      {/* Entorno sintético a partir de paneles de luz, no un preset con HDR
          descargado de un CDN: nada de dependencias de red en tiempo de
          ejecución, y sigue dando reflejos sutiles al clearcoat. */}
      <Environment background={false} environmentIntensity={0.4}>
        <Lightformer intensity={2} color="#dfffb0" position={[10, 8, 5]} scale={[10, 5, 1]} />
        <Lightformer intensity={1} color="#8fb8ff" position={[-10, -5, -5]} rotation={[0, Math.PI, 0]} scale={[10, 5, 1]} />
        <Lightformer intensity={1.5} color="#ffffff" position={[0, 5, -15]} scale={[8, 8, 1]} />
      </Environment>

      <Stars radius={140} depth={70} count={600} factor={2.8} saturation={0} fade speed={reducedMotion ? 0 : 0.08} />

      <EstablishmentCore maxNodeRadius={maxNodeRadius} reducedMotion={reducedMotion} />
      <PersonNodes
        nodes={graph.nodes}
        positions={positions}
        roots={graph.roots}
        focusId={focusId}
        selectedId={selectedId}
        directlyConnected={directlyConnected}
        reducedMotion={reducedMotion}
        liveRef={liveNodesRef}
        onSelect={onSelect}
      />
      <GlowSprites haloNodeIds={haloNodeIds} liveRef={liveNodesRef} reducedMotion={reducedMotion} />
      <PersonLabels nodes={graph.nodes} establishmentName={graph.establishment.name} liveRef={liveNodesRef} t={t} />
      <ConnectionLines
        edges={graph.edges}
        positions={positions}
        establishmentId={graph.establishment.id}
        directlyConnected={directlyConnected}
        hasSelection={selectedId != null}
        liveRef={liveNodesRef}
        reducedMotion={reducedMotion}
      />

      <CameraRig focusPosition={focusPosition} controlsRef={controlsRef} />
      <AutoRotateDamper controlsRef={controlsRef} interacting={interacting} reducedMotion={reducedMotion} />

      <OrbitControls
        ref={controlsRef}
        enablePan={false}
        enableDamping
        dampingFactor={0.08}
        minDistance={MIN_DISTANCE}
        maxDistance={MAX_DISTANCE}
        touches={{ ONE: TOUCH.ROTATE, TWO: TOUCH.DOLLY_ROTATE }}
        onStart={() => setInteracting(true)}
        onEnd={() => setInteracting(false)}
      />
    </Canvas>
  );
}
