export type Node = {
  id: string;
  name: string;
  avatarUrl?: string;
  /** Saltos desde el establecimiento (el primero invitado por el local es depth 1). */
  depth: number;
  /** Id del cliente que inició esa cadena (un nodo de depth 1). */
  rootId: string;
  giftedAt: string;
  /** Total de hijos reales que tiene este nodo, cargados o no. */
  childCount: number;
  /** Cuántos de esos hijos vienen incluidos en el grafo cargado ahora mismo. */
  loadedChildCount: number;
};

export type Edge = {
  from: string;
  to: string;
  giftedAt: string;
};

export type GiftGraph = {
  establishment: { id: string; name: string };
  /** Ids de los nodos de depth 1, uno por cadena. */
  roots: string[];
  nodes: Node[];
  edges: Edge[];
};
