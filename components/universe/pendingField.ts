import { hash01 } from "@/lib/giftGraph/organicMotion";

export type PendingPoint = { x: number; y: number; z: number; scale: number };

/**
 * Puntos dispersos en un cascarón esférico alrededor del grafo cargado:
 * de fondo, sin conectar a nada. No son datos reales todavía -son la
 * sensación de que hay mucho más universo del que se ve conectado, gente
 * que ha recibido una invitación pero aún no la ha abierto.
 */
export function generatePendingField(count: number, innerRadius: number, outerRadius: number): PendingPoint[] {
  const goldenAngle = Math.PI * (3 - Math.sqrt(5));
  const points: PendingPoint[] = [];

  for (let i = 0; i < count; i++) {
    const seed = `pending:${i}`;
    const y = count === 1 ? 0 : 1 - (2 * (i + 0.5)) / count;
    const radiusAtY = Math.sqrt(Math.max(0, 1 - y * y));
    const theta = goldenAngle * i;
    const radius = innerRadius + hash01(`${seed}:r`) * (outerRadius - innerRadius);

    points.push({
      x: Math.cos(theta) * radiusAtY * radius,
      y: y * radius,
      z: Math.sin(theta) * radiusAtY * radius,
      scale: 0.05 + hash01(`${seed}:s`) * 0.09,
    });
  }

  return points;
}
