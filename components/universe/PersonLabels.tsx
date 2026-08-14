"use client";

import { Billboard, Text } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useRef } from "react";
import { Group, Vector3 } from "three";
import { CHALK, LIME } from "@/components/universe/palette";
import { fill, type Dict } from "@/lib/i18n";
import type { Node } from "@/lib/giftGraph/types";
import type { Vec3 } from "@/lib/giftGraph/sphereLayout";

const LABEL_VISIBLE_DISTANCE = 26;
// Propia, no la de sistema: sin esto troika intenta resolver el glifo
// contra un CDN externo (unicode-font-resolver) en el primer render.
const FONT = "/fonts/plus-jakarta-sans-400.woff";

export function PersonLabels({
  nodes,
  positions,
  establishmentName,
  t,
}: {
  nodes: Node[];
  positions: Map<string, Vec3>;
  establishmentName: string;
  t: Dict;
}) {
  const groupRef = useRef<Group>(null);
  const { camera } = useThree();
  const worldPos = useRef(new Vector3());

  // getWorldPosition, no `.position`: más robusto que asumir que este grupo
  // nunca cuelga de nada con su propia transformación.
  useFrame(() => {
    const group = groupRef.current;
    if (!group) return;
    for (const child of group.children) {
      child.getWorldPosition(worldPos.current);
      child.visible = worldPos.current.distanceTo(camera.position) < LABEL_VISIBLE_DISTANCE;
    }
  });

  return (
    <group ref={groupRef}>
      <Billboard position={[0, 0, 0]}>
        <Text font={FONT} fontSize={0.7} color={CHALK} anchorY="top" position={[0, -0.9, 0]}>
          {establishmentName}
        </Text>
      </Billboard>
      {nodes.map((node) => {
        const pos = positions.get(node.id);
        if (!pos) return null;
        const remaining = node.childCount - node.loadedChildCount;
        return (
          <Billboard key={node.id} position={[pos.x, pos.y, pos.z]}>
            <Text font={FONT} fontSize={0.42} color={CHALK} anchorY="top" position={[0, -0.75, 0]}>
              {node.name}
            </Text>
            {remaining > 0 ? (
              <Text font={FONT} fontSize={0.34} color={LIME} anchorY="bottom" position={[0, 0.95, 0]}>
                {fill(t.admin.universeLoadMore, { n: remaining })}
              </Text>
            ) : null}
          </Billboard>
        );
      })}
    </group>
  );
}
