import type { Vector3 } from "three";

/**
 * Estado animado "vivo" de un nodo en el frame actual: posición base más
 * deriva orgánica, y radio ya con el tween de tamaño y la respiración
 * aplicados. PersonNodes es quien lo escribe cada frame (ya recorre todos
 * los nodos para posicionar el InstancedMesh); ConnectionLines,
 * PersonLabels y GlowSprites solo lo leen, para no recalcular la misma
 * deriva en varios sitios y desincronizarse entre ellos.
 */
export type LiveNode = { position: Vector3; radius: number };
export type LiveNodesRef = React.RefObject<Map<string, LiveNode>>;
