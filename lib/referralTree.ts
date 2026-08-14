import { assertNoQueryError, db } from "@/lib/db/client";
import { firstName } from "@/lib/scan-service";

export type ReferralNode = {
  id: string;
  name: string;
  /** El ahijado volvió y pagó: la rama se pinta como verificada. */
  billable: boolean;
  children: ReferralNode[];
};

/**
 * Árbol de quién trajo a quién, con el local como raíz.
 *
 * El padrino de cada cliente sale de `invitations` (padrino_id → claimed_by),
 * no de `attributions`: esa tabla solo registra invitaciones que llegaron a
 * canjearse, y el árbol quiere enseñar todo el árbol de altas, no solo el
 * subconjunto que ya facturó. `attributions` sí decide el color de la rama
 * —verificada o no— porque para eso está: solo ella sabe si el ahijado
 * volvió y pagó.
 */
export async function loadReferralTree(shopId: string): Promise<ReferralNode[]> {
  const { data: customers, error } = await db()
    .from("customers")
    .select("id, name")
    .eq("shop_id", shopId);
  assertNoQueryError(error, `customers.shop_id=${shopId}`);

  const { data: invitations, error: invError } = await db()
    .from("invitations")
    .select("padrino_id, claimed_by")
    .eq("shop_id", shopId)
    .not("claimed_by", "is", null);
  assertNoQueryError(invError, `invitations.shop_id=${shopId}`);

  const { data: attributions, error: attrError } = await db()
    .from("attributions")
    .select("ahijado_id, state")
    .eq("shop_id", shopId);
  assertNoQueryError(attrError, `attributions.shop_id=${shopId}`);

  const names = new Map((customers ?? []).map((row) => [row.id, firstName(row.name)]));
  const billable = new Set(
    (attributions ?? [])
      .filter((row) => row.state === "billable")
      .map((row) => row.ahijado_id),
  );

  const parentOf = new Map<string, string>();
  const childrenOf = new Map<string, string[]>();
  for (const invitation of invitations ?? []) {
    if (!invitation.claimed_by) continue;
    parentOf.set(invitation.claimed_by, invitation.padrino_id);
    const siblings = childrenOf.get(invitation.padrino_id) ?? [];
    siblings.push(invitation.claimed_by);
    childrenOf.set(invitation.padrino_id, siblings);
  }

  // Sin padrino: se alta directamente en el local, así que cuelga de la raíz.
  const roots = (customers ?? []).map((row) => row.id).filter((id) => !parentOf.has(id));

  function build(id: string, seen: Set<string>): ReferralNode {
    seen.add(id);
    const children = (childrenOf.get(id) ?? [])
      // Guarda de cordura: los datos no deberían tener ciclos, pero una fila
      // corrupta a mano no debe colgar el render en un bucle infinito.
      .filter((childId) => !seen.has(childId))
      .map((childId) => build(childId, seen));

    return { id, name: names.get(id) ?? "—", billable: billable.has(id), children };
  }

  const seen = new Set<string>();
  return roots.map((id) => build(id, seen));
}
