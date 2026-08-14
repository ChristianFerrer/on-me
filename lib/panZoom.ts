export type Pan = { x: number; y: number; scale: number };

export function clampScale(scale: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, scale));
}

/**
 * Zoom centrado en un punto del mapa (no en el centro del lienzo): el punto
 * de contenido que hay bajo `(viewX, viewY)` antes de escalar tiene que
 * seguir estando bajo ese mismo punto después. `viewX/viewY` ya vienen en
 * unidades del mapa (constantes, no dependen del pan/zoom actual — ver
 * `screenToView`), así que el cálculo no necesita saber nada de píxeles.
 */
export function zoomAtPoint(
  pan: Pan,
  viewX: number,
  viewY: number,
  factor: number,
  min: number,
  max: number,
): Pan {
  const newScale = clampScale(pan.scale * factor, min, max);
  const contentX = (viewX - pan.x) / pan.scale;
  const contentY = (viewY - pan.y) / pan.scale;
  return { scale: newScale, x: viewX - contentX * newScale, y: viewY - contentY * newScale };
}

/** Arrastra por un delta ya convertido a unidades del mapa. El zoom actual no importa. */
export function panBy(pan: Pan, deltaViewX: number, deltaViewY: number): Pan {
  return { ...pan, x: pan.x + deltaViewX, y: pan.y + deltaViewY };
}

/**
 * Reescala un desplazamiento en píxeles de pantalla a unidades del mapa.
 * El viewBox es un cuadrado fijo, así que basta un único factor (el lado
 * más corto del contenedor determina cuánto cabe, con `preserveAspectRatio`
 * por defecto).
 */
export function pixelsToUnits(deltaPx: number, containerPx: number, viewBoxSize: number): number {
  if (containerPx <= 0) return deltaPx;
  return deltaPx * (viewBoxSize / containerPx);
}
