/**
 * Estado real de un salto: las mismas seis situaciones que ya existen en
 * `AttributionState` ("window" | "billable" | "discarded") e
 * `InvitationState` ("sent" | "opened" | ...) — aquí unificadas para poder
 * pintar en el mismo mapa tanto a quien ya es cliente como a quien todavía
 * no ha canjeado su invitación.
 */
export type NodeState = "billable" | "window" | "discarded" | "opened" | "sent" | "expired";

export const ALL_NODE_STATES: NodeState[] = ["billable", "window", "opened", "sent", "expired", "discarded"];

export type Node = {
  id: string;
  name: string;
  avatarUrl?: string;
  /** Saltos desde el establecimiento (el primero invitado por el local es depth 1). */
  depth: number;
  /** Id del cliente que inició esa cadena (un nodo de depth 1). */
  rootId: string;
  state: NodeState;
  /**
   * Si tiene identidad real -nombre, ficha propia- o es solo una invitación
   * sin reclamar. `createInvitation` no pide el nombre de a quién se invita
   * -eso llega en el claim-, así que un nodo sin reclamar no tiene nombre
   * que enseñar: nunca en el mapa, y en la ficha se sustituye por un texto
   * genérico. false solo para invitaciones sent/opened/expired sin claimed_by.
   */
  claimed: boolean;
  /** Cafés consumidos hasta ahora. 0 si todavía no es cliente (sent/opened). */
  stamps: number;
  /** Cuándo canjeó su primer café. null si todavía no es cliente. */
  redeemedAt: string | null;
  /** Cuándo volvió a pagar dentro de la ventana de atribución. null si no ha vuelto. */
  returnedAt: string | null;
  /** Última actividad conocida (canje, escaneo...), para el brillo por recencia. */
  lastActivityAt: string;
  /** Cuándo caduca la invitación, si sigue pendiente (sent/opened). null en cualquier otro estado. */
  expiresAt: string | null;
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
