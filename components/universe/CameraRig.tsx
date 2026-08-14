"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import { Vector3 } from "three";
import type { OrbitControls } from "three-stdlib";

const TWEEN_DURATION_MS = 800;

function easeOutCubic(t: number): number {
  return 1 - (1 - t) ** 3;
}

/**
 * Anima la cámara y el punto de mira de OrbitControls hacia `focusPosition`
 * cada vez que cambia, con un tween suave. Al llegar, deja el control de
 * vuelta a OrbitControls (solo le movemos target/position, no lo deshabilita).
 */
export function CameraRig({
  focusPosition,
  controlsRef,
}: {
  focusPosition: Vector3;
  controlsRef: React.RefObject<OrbitControls | null>;
}) {
  const { camera } = useThree();
  const tween = useRef<{
    fromPos: Vector3;
    toPos: Vector3;
    fromTarget: Vector3;
    toTarget: Vector3;
    startedAt: number;
  } | null>(null);
  const clock = useRef(0);
  const lastFocus = useRef<Vector3 | null>(null);

  useEffect(() => {
    const controls = controlsRef.current;
    if (!controls) return;
    if (lastFocus.current && lastFocus.current.equals(focusPosition)) return;
    lastFocus.current = focusPosition.clone();

    const direction = focusPosition.clone();
    const distanceFromOrigin = direction.length();
    const viewDistance = distanceFromOrigin === 0 ? 20 : Math.max(6, distanceFromOrigin * 0.35);
    const cameraDir = direction.lengthSq() > 0 ? direction.clone().normalize() : new Vector3(0, 0.3, 1).normalize();
    const toPos = focusPosition.clone().addScaledVector(cameraDir, viewDistance);
    toPos.y += viewDistance * 0.25;

    tween.current = {
      fromPos: camera.position.clone(),
      toPos,
      fromTarget: controls.target.clone(),
      toTarget: focusPosition.clone(),
      startedAt: clock.current,
    };
  }, [focusPosition, camera, controlsRef]);

  useFrame((_, delta) => {
    clock.current += delta * 1000;
    const active = tween.current;
    const controls = controlsRef.current;
    if (!active || !controls) return;

    const t = Math.min(1, (clock.current - active.startedAt) / TWEEN_DURATION_MS);
    const eased = easeOutCubic(t);
    camera.position.lerpVectors(active.fromPos, active.toPos, eased);
    controls.target.lerpVectors(active.fromTarget, active.toTarget, eased);
    controls.update();

    if (t >= 1) tween.current = null;
  });

  return null;
}
