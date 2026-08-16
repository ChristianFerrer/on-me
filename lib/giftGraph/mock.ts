import type { Edge, GiftGraph, Node, NodeState } from "@/lib/giftGraph/types";

/**
 * El "universo" completo, como si fuera toda la tabla de invitaciones en BD.
 * getGiftGraph() recorta esto en trozos; nada fuera de este archivo conoce
 * la forma del árbol entero de una vez.
 *
 * Los estados y fechas de cada persona están elegidos a propósito, no al
 * azar, para que las cuatro preguntas que el mapa debe responder tengan
 * una respuesta clara en este mismo dataset:
 *  - cadena viva (Chris) vs. cadena apagada (Youssef, toda de hace meses)
 *  - una cadena cortada (Martina, descartada, sin hijos)
 *  - el mejor padrino (Chris, con más descendencia facturable que nadie)
 *  - invitaciones a punto de caducar (Iker, Nadia, Iris, Rubén)
 */
type TreeSpec = {
  name: string;
  state: NodeState;
  /** Cafés consumidos en la tarjeta actual. Solo tiene sentido si ya es cliente (no sent/opened/expired). */
  stamps?: number;
  /** Tarjetas completadas antes de la actual, para el total histórico de cafés. */
  cardsCompleted?: number;
  /** Hace cuántos días fue la última actividad conocida. */
  lastActivityDaysAgo: number;
  /** Solo para sent/opened: dentro de cuántas horas caduca la invitación. */
  expiresInHours?: number;
  children?: TreeSpec[];
};

const ESTABLISHMENT = { id: "shop", name: "OnMe Café" };

// Ancla en el momento real, no una fecha fija: así "a punto de caducar"
// sigue queriendo decir algo cada vez que se abra la demo.
const NOW = Date.now();

const CHAINS: TreeSpec[] = [
  {
    name: "Chris",
    state: "billable",
    stamps: 8,
    // Cliente de toda la vida: ya completó dos tarjetas antes de esta -el
    // total histórico (2*10+8=28) tiene que notarse distinto de los 8 de
    // la tarjeta en curso.
    cardsCompleted: 2,
    lastActivityDaysAgo: 1,
    children: [
      {
        name: "Delia",
        state: "billable",
        stamps: 6,
        lastActivityDaysAgo: 2,
        children: [
          {
            name: "Bru",
            state: "billable",
            stamps: 10,
            lastActivityDaysAgo: 1,
            children: [
              {
                name: "Nora",
                state: "window",
                stamps: 3,
                lastActivityDaysAgo: 5,
                children: [
                  { name: "Iker", state: "opened", lastActivityDaysAgo: 1, expiresInHours: 20 },
                ],
              },
              // Nuevo verificado recién estrenado: el mínimo coherente son 2 sellos
              // -el del canje (applyInvitationRedeem) más el de su primer retorno
              // pagado (evaluateAttribution), nunca menos.
              { name: "Vega", state: "billable", stamps: 2, lastActivityDaysAgo: 1 },
            ],
          },
          // Cadena cortada: descartada, hace dos meses, sin nadie después.
          { name: "Martina", state: "discarded", stamps: 1, lastActivityDaysAgo: 60 },
        ],
      },
      {
        name: "Pau",
        state: "billable",
        stamps: 9,
        lastActivityDaysAgo: 2,
        children: [
          { name: "Nadia", state: "sent", lastActivityDaysAgo: 0, expiresInHours: 10 },
          {
            name: "Leo",
            state: "billable",
            stamps: 5,
            lastActivityDaysAgo: 4,
            children: [
              {
                name: "Clara",
                state: "window",
                stamps: 2,
                lastActivityDaysAgo: 6,
                children: [{ name: "Aitor", state: "opened", lastActivityDaysAgo: 3, expiresInHours: 200 }],
              },
            ],
          },
        ],
      },
    ],
  },
  {
    name: "Marta",
    state: "billable",
    stamps: 7,
    lastActivityDaysAgo: 3,
    children: [
      {
        name: "Sara",
        state: "window",
        stamps: 4,
        lastActivityDaysAgo: 10,
        children: [
          {
            name: "Marc",
            state: "billable",
            stamps: 6,
            lastActivityDaysAgo: 4,
            children: [{ name: "Julia", state: "opened", lastActivityDaysAgo: 2, expiresInHours: 300 }],
          },
        ],
      },
      { name: "Diego", state: "discarded", stamps: 1, lastActivityDaysAgo: 45 },
      { name: "Rubén", state: "sent", lastActivityDaysAgo: 0, expiresInHours: 15 },
    ],
  },
  {
    // Cadena apagada: todo hace mucho, casi todo descartado.
    name: "Youssef",
    state: "discarded",
    stamps: 2,
    lastActivityDaysAgo: 90,
    children: [
      {
        name: "Alba",
        state: "discarded",
        stamps: 1,
        lastActivityDaysAgo: 80,
        children: [
          {
            name: "Hugo",
            state: "discarded",
            stamps: 1,
            lastActivityDaysAgo: 75,
            children: [{ name: "Noa", state: "expired", lastActivityDaysAgo: 70 }],
          },
        ],
      },
      {
        name: "Vera",
        state: "window",
        stamps: 3,
        lastActivityDaysAgo: 20,
        children: [{ name: "Adam", state: "billable", stamps: 2, lastActivityDaysAgo: 5 }],
      },
      { name: "Mia", state: "discarded", stamps: 1, lastActivityDaysAgo: 70 },
    ],
  },
  {
    name: "Elena",
    state: "window",
    stamps: 4,
    lastActivityDaysAgo: 15,
    children: [
      {
        name: "Kai",
        state: "billable",
        stamps: 6,
        lastActivityDaysAgo: 3,
        children: [
          {
            name: "Lucia",
            state: "billable",
            stamps: 3,
            lastActivityDaysAgo: 4,
            children: [{ name: "Enzo", state: "opened", lastActivityDaysAgo: 2, expiresInHours: 150 }],
          },
        ],
      },
      {
        name: "Zoe",
        state: "discarded",
        stamps: 1,
        lastActivityDaysAgo: 50,
        children: [{ name: "Max", state: "expired", lastActivityDaysAgo: 48 }],
      },
      {
        name: "Nina",
        state: "billable",
        stamps: 8,
        lastActivityDaysAgo: 1,
        children: [
          {
            name: "Theo",
            state: "window",
            stamps: 2,
            lastActivityDaysAgo: 6,
            children: [
              {
                name: "Elsa",
                state: "billable",
                stamps: 5,
                lastActivityDaysAgo: 2,
                children: [{ name: "Iris", state: "sent", lastActivityDaysAgo: 0, expiresInHours: 8 }],
              },
            ],
          },
        ],
      },
    ],
  },
  {
    name: "Toni",
    state: "billable",
    stamps: 10,
    cardsCompleted: 1,
    lastActivityDaysAgo: 2,
    children: [
      { name: "Eva", state: "opened", lastActivityDaysAgo: 5, expiresInHours: 400 },
      {
        name: "Gael",
        state: "billable",
        stamps: 4,
        lastActivityDaysAgo: 3,
        children: [{ name: "Mar", state: "window", stamps: 2, lastActivityDaysAgo: 7 }],
      },
    ],
  },
  // Clientes directos: alta por QR en el mostrador, sin invitación de nadie.
  { name: "Noel", state: "direct", stamps: 6, lastActivityDaysAgo: 1 },
  {
    name: "Uxue",
    state: "direct",
    stamps: 10,
    lastActivityDaysAgo: 3,
    // Un cliente directo también puede invitar: no tiene padrino, pero sí puede ser uno.
    children: [
      // "claimed": ya se dio de alta desde la invitación, todavía sin canjear en barra.
      { name: "Kike", state: "claimed", lastActivityDaysAgo: 1 },
      // "en ventana" a un día del canje: casi sin encoger, parpadeo lento.
      { name: "Yago", state: "window", stamps: 1, lastActivityDaysAgo: 1 },
      // "en ventana" a 25 días del canje: bien encogido, parpadeo rápido -a
      // 5 días de que el barrido diario la resuelva a facturable o descartada.
      { name: "Zaida", state: "window", stamps: 2, lastActivityDaysAgo: 25 },
    ],
  },
  { name: "Vale", state: "direct", stamps: 9, lastActivityDaysAgo: 26 },
  { name: "Bea", state: "direct", stamps: 10, lastActivityDaysAgo: 55 },
  // Un solo invitado: sigue oscilando pegada al núcleo -sin desplazamiento
  // de radio ni de brillo, el mismo trato que un directo sin descendencia.
  {
    name: "Ona",
    state: "direct",
    stamps: 7,
    lastActivityDaysAgo: 4,
    children: [{ name: "Pol", state: "billable", stamps: 3, lastActivityDaysAgo: 4 }],
  },
  // Seis invitados directos, dos de ellos con su propia descendencia: se
  // aleja del núcleo y brilla más que el resto de raíces directas, para
  // leerse como su propia pequeña constelación.
  {
    name: "Roc",
    state: "direct",
    stamps: 10,
    cardsCompleted: 1,
    lastActivityDaysAgo: 1,
    children: [
      {
        name: "Aina",
        state: "billable",
        stamps: 6,
        lastActivityDaysAgo: 1,
        children: [
          { name: "Biel", state: "window", stamps: 1, lastActivityDaysAgo: 1 },
          { name: "Cata", state: "claimed", lastActivityDaysAgo: 2 },
        ],
      },
      {
        name: "Dani",
        state: "opened",
        lastActivityDaysAgo: 3,
        expiresInHours: 200,
      },
      { name: "Erin", state: "billable", stamps: 4, lastActivityDaysAgo: 2 },
      { name: "Fran", state: "window", stamps: 3, lastActivityDaysAgo: 10 },
      { name: "Gina", state: "sent", lastActivityDaysAgo: 1, expiresInHours: 500 },
      {
        name: "Ivo",
        state: "billable",
        stamps: 9,
        lastActivityDaysAgo: 1,
        children: [{ name: "Ines", state: "window", stamps: 2, lastActivityDaysAgo: 3 }],
      },
    ],
  },
];

function slug(name: string): string {
  return name.toLowerCase().replace(/[^a-z]/g, "");
}

const DAY_MS = 86_400_000;
const HOUR_MS = 3_600_000;

/** Tiene ficha propia -nombre, ficha, tarjeta- en cualquier estado salvo los tres previos a reclamar la invitación. */
function isCustomer(state: NodeState): boolean {
  return state !== "sent" && state !== "opened" && state !== "expired";
}

/** Además, ya canjeó en barra: "claimed" es cliente real, pero todavía sin ese canje. */
function hasRedeemed(state: NodeState): boolean {
  return isCustomer(state) && state !== "claimed";
}

/** Solo "billable" implica que además volvió a pagar dentro de la ventana. */
function hasReturned(state: NodeState): boolean {
  return state === "billable";
}

function buildGraph(): GiftGraph {
  const nodes: Node[] = [];
  const edges: Edge[] = [];
  const roots: string[] = [];

  function walk(spec: TreeSpec, depth: number, rootId: string, parentId: string) {
    const id = slug(spec.name);
    const children = spec.children ?? [];
    const lastActivityAt = new Date(NOW - spec.lastActivityDaysAgo * DAY_MS).toISOString();
    const customer = isCustomer(spec.state);

    nodes.push({
      id,
      name: spec.name,
      depth,
      rootId,
      state: spec.state,
      // Los nombres de este mock son ficticios y siempre "conocidos" -a
      // diferencia del grafo real, donde una invitación sin reclamar
      // todavía no tiene identidad.
      claimed: true,
      stamps: customer ? (spec.stamps ?? 0) : 0,
      cardsCompleted: customer ? (spec.cardsCompleted ?? 0) : 0,
      redeemedAt: hasRedeemed(spec.state) ? lastActivityAt : null,
      returnedAt: hasReturned(spec.state) ? lastActivityAt : null,
      lastActivityAt,
      expiresAt: spec.expiresInHours != null ? new Date(NOW + spec.expiresInHours * HOUR_MS).toISOString() : null,
      childCount: children.length,
      loadedChildCount: children.length,
    });
    edges.push({ from: parentId, to: id, giftedAt: lastActivityAt });

    for (const child of children) walk(child, depth + 1, rootId, id);
  }

  for (const root of CHAINS) {
    const rootId = slug(root.name);
    roots.push(rootId);
    walk(root, 1, rootId, ESTABLISHMENT.id);
  }

  return { establishment: ESTABLISHMENT, roots, nodes, edges };
}

/** Todo el universo, calculado una sola vez al cargar el módulo. */
export const MOCK_GIFT_GRAPH: GiftGraph = buildGraph();
