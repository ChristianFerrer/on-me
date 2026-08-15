"use client";

import { Billboard, Text } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useRef } from "react";
import type { Group } from "three";
import { INK, LIME } from "@/components/universe/palette";
import { computeRadius } from "@/lib/giftGraph/organicMotion";
import { fill, type Dict } from "@/lib/i18n";
import type { LiveNodesRef } from "@/components/universe/liveNodes";
import type { Node } from "@/lib/giftGraph/types";

// Antes 26: menos que la distancia inicial de la cámara (~35), así que
// ningún nombre se veía nunca nada más entrar. Ahora, además, se apaga con
// un desvanecido en vez de un corte seco.
const FADE_START = 32;
const FADE_END = 58;
const FONT = "/fonts/plus-jakarta-sans-400.woff";

type TextLike = { fillOpacity: number };

function opacityForDistance(distance: number): number {
  if (distance <= FADE_START) return 1;
  if (distance >= FADE_END) return 0;
  const t = (distance - FADE_START) / (FADE_END - FADE_START);
  return 1 - t * t * (3 - 2 * t);
}

export function PersonLabels({
  nodes,
  establishmentName,
  establishmentRadius,
  liveRef,
  t,
}: {
  nodes: Node[];
  establishmentName: string;
  establishmentRadius: number;
  liveRef: LiveNodesRef;
  t: Dict;
}) {
  const { camera } = useThree();
  const billboardRefs = useRef(new Map<string, Group>());
  const nameTextRefs = useRef(new Map<string, TextLike>());
  const badgeTextRefs = useRef(new Map<string, TextLike>());
  const establishmentGroupRef = useRef<Group>(null);
  const establishmentTextRef = useRef<TextLike>(null);

  useFrame(() => {
    if (establishmentGroupRef.current && establishmentTextRef.current) {
      const distance = establishmentGroupRef.current.position.distanceTo(camera.position);
      establishmentTextRef.current.fillOpacity = opacityForDistance(distance);
    }

    for (const node of nodes) {
      const live = liveRef.current.get(node.id);
      const billboard = billboardRefs.current.get(node.id);
      if (!live || !billboard) continue;
      billboard.position.copy(live.position);

      const opacity = opacityForDistance(billboard.position.distanceTo(camera.position));
      const nameText = nameTextRefs.current.get(node.id);
      if (nameText) nameText.fillOpacity = opacity;
      const badgeText = badgeTextRefs.current.get(node.id);
      if (badgeText) badgeText.fillOpacity = opacity;
    }
  });

  return (
    <group>
      <Billboard ref={establishmentGroupRef} position={[0, 0, 0]}>
        <Text
          ref={establishmentTextRef}
          font={FONT}
          fontSize={Math.min(0.6, establishmentRadius * 0.4)}
          color={INK}
          anchorX="center"
          anchorY="middle"
          maxWidth={establishmentRadius * 1.7}
          textAlign="center"
          position={[0, 0, establishmentRadius * 0.92]}
        >
          {establishmentName}
        </Text>
      </Billboard>
      {nodes.map((node) => {
        const remaining = node.childCount - node.loadedChildCount;
        const radius = computeRadius(node.childCount);
        // El nombre vive sobre la propia esfera, no debajo: centrado, y
        // empujado hacia la cámara lo justo para asentarse en la superficie
        // en vez de quedar a medias dentro del volumen.
        const fontSize = Math.min(0.5, Math.max(0.16, radius * 0.55));
        return (
          <Billboard
            key={node.id}
            ref={(el: Group | null) => {
              if (el) billboardRefs.current.set(node.id, el);
              else billboardRefs.current.delete(node.id);
            }}
          >
            <Text
              ref={(el: TextLike | null) => {
                if (el) nameTextRefs.current.set(node.id, el);
                else nameTextRefs.current.delete(node.id);
              }}
              font={FONT}
              fontSize={fontSize}
              color={INK}
              anchorX="center"
              anchorY="middle"
              maxWidth={radius * 1.7}
              textAlign="center"
              position={[0, 0, radius * 0.92]}
            >
              {node.name}
            </Text>
            {remaining > 0 ? (
              <Text
                ref={(el: TextLike | null) => {
                  if (el) badgeTextRefs.current.set(node.id, el);
                  else badgeTextRefs.current.delete(node.id);
                }}
                font={FONT}
                fontSize={0.34}
                color={LIME}
                anchorY="bottom"
                position={[0, radius + 0.4, 0]}
              >
                {fill(t.admin.universeLoadMore, { n: remaining })}
              </Text>
            ) : null}
          </Billboard>
        );
      })}
    </group>
  );
}
