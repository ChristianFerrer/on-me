import { IcosahedronGeometry } from "three";

/**
 * Una única geometría de alta resolución, compartida por el núcleo del
 * local y por todas las instancias de PersonNodes: con geometría
 * compartida (InstancedMesh reutiliza una sola geometría para todas sus
 * instancias por diseño) el nivel de detalle no cuesta nada extra, así que
 * no hay excusa de rendimiento para verse facetada.
 */
export const SPHERE_GEOMETRY = new IcosahedronGeometry(1, 5);
