"use client";

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import { type InstancedMesh, Object3D, Vector3 } from "three";
import { organicOffset } from "@/components/universe/organicOffset";
import { CHALK } from "@/components/universe/palette";
import { generatePendingField } from "@/components/universe/pendingField";
import { SPHERE_GEOMETRY } from "@/components/universe/sphereGeometry";

const COUNT = 70;
const SHELL_INNER_FACTOR = 1.15;
const SHELL_OUTER_FACTOR = 2.4;

/**
 * El resto del universo: pequeñas esferas apagadas y sin conectar, más
 * allá del grafo que sí se ha cargado. No son personas concretas -de
 * momento no hay datos reales de invitaciones sin abrir- pero dan la
 * sensación de que la red sigue mucho más allá de lo que se ve.
 */
export function PendingField({ innerRadius, reducedMotion }: { innerRadius: number; reducedMotion: boolean }) {
  const meshRef = useRef<InstancedMesh>(null);
  const dummy = useMemo(() => new Object3D(), []);
  const offsetVec = useMemo(() => new Vector3(), []);
  const clock = useRef(0);

  const points = useMemo(
    () => generatePendingField(COUNT, innerRadius * SHELL_INNER_FACTOR, innerRadius * SHELL_OUTER_FACTOR),
    [innerRadius],
  );

  useFrame((_, delta) => {
    clock.current += reducedMotion ? 0 : delta;
    const mesh = meshRef.current;
    if (!mesh) return;

    points.forEach((point, index) => {
      let x = point.x;
      let y = point.y;
      let z = point.z;
      if (!reducedMotion) {
        organicOffset(`pending:${index}`, clock.current, point.scale * 1.4, offsetVec);
        x += offsetVec.x;
        y += offsetVec.y;
        z += offsetVec.z;
      }
      dummy.position.set(x, y, z);
      dummy.scale.setScalar(point.scale);
      dummy.updateMatrix();
      mesh.setMatrixAt(index, dummy.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, points.length]} geometry={SPHERE_GEOMETRY}>
      <meshBasicMaterial color={CHALK} transparent opacity={0.22} depthWrite={false} />
    </instancedMesh>
  );
}
