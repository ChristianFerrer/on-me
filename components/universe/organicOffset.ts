import { createNoise3D } from "simplex-noise";
import { Vector3 } from "three";
import { hash01 } from "@/lib/giftGraph/organicMotion";

// Un único generador compartido: cada nodo se desplaza sobre una región
// distinta del mismo campo de ruido (ver seedFor), no uno por nodo.
const noise3D = createNoise3D();

const AXIS_SHIFT_Y = 137.2;
const AXIS_SHIFT_Z = 911.7;

/** Punto de partida propio de cada nodo en el campo de ruido, a partir de su id. */
function seedFor(id: string): number {
  return hash01(id) * 1000;
}

/**
 * Deriva orgánica sobre la posición base de un nodo: un offset de ruido
 * simplex 3D, uno por eje, desplazado en el propio campo para que los tres
 * ejes (y cada nodo entre sí) no se muevan correlacionados.
 */
export function organicOffset(id: string, elapsedSeconds: number, amplitude: number, out: Vector3): Vector3 {
  const seed = seedFor(id);
  // Más lento que antes: se pide que floten como globos de helio, no que
  // tiemblen.
  const t = elapsedSeconds * 0.04;
  out.set(
    noise3D(seed + t, seed, seed) * amplitude,
    noise3D(seed, seed + AXIS_SHIFT_Y + t, seed) * amplitude,
    noise3D(seed, seed, seed + AXIS_SHIFT_Z + t) * amplitude,
  );
  return out;
}
