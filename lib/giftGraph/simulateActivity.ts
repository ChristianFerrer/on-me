import type { GiftGraph, Node, NodeState } from "@/lib/giftGraph/types";
import type { LiveEventKind } from "@/lib/giftGraph/liveEvents";

/**
 * Generador de actividad de mentira para el "modo simulación" de la vista
 * sol: un cliente real casi nunca tiene 118 personas tocando la campana a
 * la vez, así que para enseñar el mapa "vivo" -destellos, HUD, el feed de
 * actividad- de verdad, hace falta fabricar esa actividad. Cada llamada
 * aplica UN cambio -nunca varios de golpe, para que el feed se lea como
 * sucesos sueltos, no un volcado- sobre una copia del grafo, nunca sobre
 * el original ni sobre la base de datos: es cosmético, vive y muere en el
 * cliente, y en cuanto se apaga el modo simulación el siguiente sondeo
 * real lo pisa sin dejar rastro.
 */

const FIRST_NAMES = [
  "Sofía", "Mateo", "Valeria", "Hugo", "Martina", "Bruno", "Aitana", "Pau",
  "Vera", "Iker", "Noa", "Leo", "Alba", "Dani", "Nora", "Adrián", "Clara",
  "Marcos", "Inés", "Rubén", "Celia", "Álvaro", "Lucía", "Diego", "Paula",
  "Nico", "Elena", "Toni", "Marta", "Gael",
];

let simIdCounter = 0;
/** Ids con prefijo propio -nunca coinciden con un id real de Supabase-, así el sondeo real que llega al apagar la simulación no puede chocar con ninguno de estos por casualidad. */
function nextSimId(): string {
  simIdCounter += 1;
  return `sim:${Date.now()}:${simIdCounter}`;
}

function randomName(taken: Set<string>): string {
  const pool = FIRST_NAMES.filter((n) => !taken.has(n));
  const from = pool.length > 0 ? pool : FIRST_NAMES;
  return from[Math.floor(Math.random() * from.length)];
}

function pick<T>(items: T[]): T | null {
  return items.length > 0 ? items[Math.floor(Math.random() * items.length)] : null;
}

/** `state` es el de LA ESTRELLA tras aplicar el paso -no antes-: la burbuja/panel del feed pinta un punto de ese color, así que tiene que ser el que de verdad se ve en el mapa después de este suceso. */
export type SimulatedEvent = { kind: LiveEventKind; nodeId: string; name: string; state: NodeState };

/**
 * Un paso de simulación: elige al azar, entre los sucesos que ahora mismo
 * tienen sentido para el estado del grafo -no se puede "abrir" una
 * invitación si no hay ninguna "enviada" esperando-, aplica uno solo y
 * devuelve el grafo ya actualizado -nuevo array, nunca mutado en sitio,
 * como el resto de esta vista- junto con qué pasó, para que quien llama
 * pueda anunciarlo en el feed sin tener que adivinarlo comparando grafos.
 */
export function simulateGraphStep(graph: GiftGraph, stampsGoal: number): { graph: GiftGraph; event: SimulatedEvent } | null {
  const now = new Date().toISOString();
  const takenNames = new Set(graph.nodes.filter((n) => n.claimed).map((n) => n.name));

  const pendingSent = graph.nodes.filter((n) => !n.claimed && n.state === "sent");
  const pendingAny = graph.nodes.filter((n) => !n.claimed && (n.state === "sent" || n.state === "opened"));
  // Quién puede sumar un sello más: "direct"/"billable" son estados finales
  // -nunca cambian de color, ver CONSTELACION_PHASE_COLOR- así que completar
  // una tarjeta ahí solo suma cardsCompleted, nunca cambia el estado. Solo
  // "claimed" -se dio de alta desde invitación, todavía no ha canjeado su
  // primera tarjeta- entra de verdad en la ventana de retorno al completarla:
  // esa tabla de atribuciones -ver loadRealGiftGraph.ts- solo existe para
  // pares padrino/ahijado, un alta directa nunca pasa por ahí.
  const stampable = graph.nodes.filter((n) => n.claimed && (n.state === "direct" || n.state === "billable" || n.state === "claimed"));
  const windowNodes = graph.nodes.filter((n) => n.claimed && n.state === "window");
  const referrers = graph.nodes.filter((n) => n.claimed);

  /** Completa una tarjeta sobre `target`: solo "claimed" entra en ventana de retorno -ver el comentario de `stampable` arriba-, "direct"/"billable" se quedan en su propio estado para siempre, solo crecen en sellos/tarjetas. */
  function redeemCard(target: Node): Node {
    const entersWindow = target.state === "claimed";
    return {
      ...target,
      state: entersWindow ? "window" : target.state,
      stamps: 0,
      cardsCompleted: target.cardsCompleted + 1,
      redeemedAt: now,
      returnedAt: entersWindow ? null : target.returnedAt,
      lastActivityAt: now,
    };
  }

  type Scenario = { kind: LiveEventKind; weight: number };
  // El literal se tipa aparte, antes del .filter(): TypeScript no ve a
  // través de la llamada encadenada, así que anotar solo `scenarios` dejaba
  // `kind` inferido como `string` a secas -perdía la unión literal- y el
  // filter ya no encajaba con Scenario[].
  const allScenarios: Scenario[] = [
    { kind: "new_direct", weight: 2 },
    { kind: "new_invite", weight: 2 },
    { kind: "invite_opened", weight: pendingSent.length > 0 ? 2 : 0 },
    { kind: "invite_expiring", weight: pendingAny.length > 0 ? 1 : 0 },
    { kind: "invite_expired", weight: pendingAny.length > 0 ? 1 : 0 },
    { kind: "stamp", weight: stampable.length > 0 ? 3 : 0 },
    { kind: "redeemed", weight: stampable.length > 0 ? 2 : 0 },
    { kind: "returned", weight: windowNodes.length > 0 ? 2 : 0 },
  ];
  const scenarios = allScenarios.filter((s) => s.weight > 0);

  const totalWeight = scenarios.reduce((sum, s) => sum + s.weight, 0);
  let roll = Math.random() * totalWeight;
  let chosen: LiveEventKind = scenarios[0].kind;
  for (const s of scenarios) {
    roll -= s.weight;
    if (roll <= 0) {
      chosen = s.kind;
      break;
    }
  }

  const nodes = [...graph.nodes];
  const edges = [...graph.edges];
  const roots = [...graph.roots];
  const indexOf = new Map(nodes.map((n, i) => [n.id, i]));
  function replaceNode(next: Node) {
    const i = indexOf.get(next.id);
    if (i != null) nodes[i] = next;
  }

  switch (chosen) {
    case "new_direct": {
      const id = nextSimId();
      const name = randomName(takenNames);
      const node: Node = {
        id,
        name,
        depth: 1,
        rootId: id,
        state: "direct",
        claimed: true,
        stamps: 0,
        cardsCompleted: 0,
        redeemedAt: null,
        returnedAt: null,
        lastActivityAt: now,
        expiresAt: null,
        childCount: 0,
        loadedChildCount: 0,
      };
      nodes.push(node);
      edges.push({ from: graph.establishment.id, to: id, giftedAt: now });
      roots.push(id);
      return { graph: { ...graph, nodes, edges, roots }, event: { kind: "new_direct", nodeId: id, name, state: node.state } };
    }
    case "new_invite": {
      const parent = pick(referrers) ?? null;
      const parentId = parent?.id ?? graph.establishment.id;
      const id = nextSimId();
      const node: Node = {
        id,
        name: "",
        depth: parent ? parent.depth + 1 : 1,
        rootId: parent ? parent.rootId : id,
        state: "sent",
        claimed: false,
        stamps: 0,
        cardsCompleted: 0,
        redeemedAt: null,
        returnedAt: null,
        lastActivityAt: now,
        expiresAt: new Date(Date.now() + 7 * 86_400_000).toISOString(),
        childCount: 0,
        loadedChildCount: 0,
      };
      nodes.push(node);
      edges.push({ from: parentId, to: id, giftedAt: now });
      if (parent) {
        replaceNode({ ...parent, childCount: parent.childCount + 1, loadedChildCount: parent.loadedChildCount + 1 });
      }
      return { graph: { ...graph, nodes, edges }, event: { kind: "new_invite", nodeId: id, name: parent?.name ?? "", state: node.state } };
    }
    case "invite_opened": {
      const target = pick(pendingSent);
      if (!target) return null;
      replaceNode({ ...target, state: "opened", lastActivityAt: now });
      return { graph: { ...graph, nodes }, event: { kind: "invite_opened", nodeId: target.id, name: "", state: "opened" } };
    }
    case "invite_expiring": {
      const target = pick(pendingAny);
      if (!target) return null;
      replaceNode({ ...target, expiresAt: new Date(Date.now() + 3 * 3_600_000).toISOString() });
      return { graph: { ...graph, nodes }, event: { kind: "invite_expiring", nodeId: target.id, name: "", state: target.state } };
    }
    case "invite_expired": {
      const target = pick(pendingAny);
      if (!target) return null;
      replaceNode({ ...target, state: "expired", expiresAt: null, lastActivityAt: now });
      return { graph: { ...graph, nodes }, event: { kind: "invite_expired", nodeId: target.id, name: "", state: "expired" } };
    }
    case "stamp": {
      const target = pick(stampable);
      if (!target) return null;
      const nextStamps = target.stamps + 1;
      // Llega a la meta -stampsGoal-: es un canje, no un sello más, o la
      // tarjeta se pintaría con más sellos de los que caben.
      if (nextStamps >= stampsGoal) {
        const next = redeemCard(target);
        replaceNode(next);
        return { graph: { ...graph, nodes }, event: { kind: "redeemed", nodeId: target.id, name: target.name, state: next.state } };
      }
      replaceNode({ ...target, stamps: nextStamps, lastActivityAt: now });
      return { graph: { ...graph, nodes }, event: { kind: "stamp", nodeId: target.id, name: target.name, state: target.state } };
    }
    case "redeemed": {
      const target = pick(stampable);
      if (!target) return null;
      const next = redeemCard(target);
      replaceNode(next);
      return { graph: { ...graph, nodes }, event: { kind: "redeemed", nodeId: target.id, name: target.name, state: next.state } };
    }
    case "returned": {
      const target = pick(windowNodes);
      if (!target) return null;
      replaceNode({ ...target, state: "billable", returnedAt: now, lastActivityAt: now });
      return { graph: { ...graph, nodes }, event: { kind: "returned", nodeId: target.id, name: target.name, state: "billable" } };
    }
  }
}
