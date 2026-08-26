/**
 * Rampa de avance propia de /admin/metricas -no los tokens del sistema
 * compartido-: la especificación de esta página pide valores exactos que no
 * tienen por qué existir en la paleta del resto del panel. Mismo criterio
 * que CONSTELACION_PHASE_COLOR en ConstelacionSolMap.tsx: una paleta
 * deliberadamente separada, documentada como tal, no un descuido.
 *
 * Un solo eje de avance -de "sin resolver" a "se ha quedado"-, más un coral
 * reservado exclusivamente para pérdida. Nada de cian ni magenta.
 */
export const METRICS_RAMP = ["#8b85a3", "#f0954f", "#f7c854", "#d3e768", "#d6f34c"] as const;
export const METRICS_LOSS = "#ff7b8c";

export const METRICS_CARD_BG = "rgba(12,10,20,.72)";

/** Un color de la rampa por índice, repitiendo el último si hay más pasos que colores. */
export function rampColor(index: number): string {
  return METRICS_RAMP[Math.min(index, METRICS_RAMP.length - 1)];
}
