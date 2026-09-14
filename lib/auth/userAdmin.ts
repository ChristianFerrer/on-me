import { randomUUID } from "node:crypto";
import { sendPasswordReset } from "@/lib/auth/admin";
import { assertNoQueryError, db } from "@/lib/db/client";

export type ShopMemberRole = "owner" | "operator";

export type ShopMember = {
  id: string;
  userId: string;
  email: string;
  role: ShopMemberRole;
  banned: boolean;
  lastSignInAt: string | null;
  createdAt: string;
};

export type UserAdminError =
  | "already_member"
  | "last_owner"
  | "self"
  | "not_found"
  | "generic";

/**
 * El roster de admins del local: `shop_members` para el vínculo (rol,
 * fecha), Supabase Auth -vía `auth.admin`, la misma `db()` con
 * `service_role`- para todo lo que vive en la cuenta (email, si está
 * bloqueada, último acceso). No hay tabla propia que duplique ese email:
 * pedirlo a Auth es una llamada más por miembro, pero evita que se
 * desincronice si alguien lo cambia desde fuera de este panel.
 */
export async function loadShopMembers(shopId: string): Promise<ShopMember[]> {
  const { data: rows, error } = await db()
    .from("shop_members")
    .select("id, user_id, role, created_at")
    .eq("shop_id", shopId)
    .order("created_at", { ascending: true });

  assertNoQueryError(error, `shop_members.shop_id=${shopId}`);
  const members = rows ?? [];
  if (members.length === 0) return [];

  const users = await Promise.all(
    members.map((member) => db().auth.admin.getUserById(member.user_id)),
  );

  return members.map((member, i) => {
    const user = users[i].data.user;
    const bannedUntil = user?.banned_until ?? null;
    return {
      id: member.id,
      userId: member.user_id,
      email: user?.email ?? "—",
      role: member.role as ShopMemberRole,
      banned: bannedUntil !== null && new Date(bannedUntil).getTime() > Date.now(),
      lastSignInAt: user?.last_sign_in_at ?? null,
      createdAt: member.created_at,
    };
  });
}

async function countOwners(shopId: string): Promise<number> {
  const { count, error } = await db()
    .from("shop_members")
    .select("id", { count: "exact", head: true })
    .eq("shop_id", shopId)
    .eq("role", "owner");
  assertNoQueryError(error, `shop_members.count owners shop=${shopId}`);
  return count ?? 0;
}

/** Busca por email entre las cuentas de Supabase Auth -no hay `getUserByEmail` en la API de admin-, paginando. Vale para el puñado de cuentas que tiene un solo local. */
async function findAuthUserByEmail(email: string) {
  const perPage = 200;
  for (let page = 1; ; page += 1) {
    const { data, error } = await db().auth.admin.listUsers({ page, perPage });
    if (error || !data) return null;
    const match = data.users.find((user) => user.email?.toLowerCase() === email);
    if (match) return match;
    if (data.users.length < perPage) return null;
  }
}

/**
 * Da de alta un admin nuevo -o engancha uno ya existente en Supabase Auth,
 * si esa persona ya es admin de otro local- y le manda el mismo email de
 * "pon tu contraseña" que ya usa la recuperación normal: no hace falta un
 * flujo de invitación aparte, la contraseña con la que se crea la cuenta
 * es aleatoria y no se usa nunca -solo hace de placeholder hasta que la
 * cambien desde ese enlace-.
 */
export async function createShopMember(
  shopId: string,
  email: string,
  role: ShopMemberRole,
): Promise<{ ok: true } | { error: UserAdminError }> {
  const created = await db().auth.admin.createUser({
    email,
    email_confirm: true,
    password: `${randomUUID()}${randomUUID()}`,
  });

  let userId: string;
  if (created.error) {
    if (created.error.code !== "email_exists") return { error: "generic" };
    const existing = await findAuthUserByEmail(email);
    if (!existing) return { error: "generic" };
    userId = existing.id;
  } else {
    userId = created.data.user.id;
  }

  const { data: existingMember } = await db()
    .from("shop_members")
    .select("id")
    .eq("shop_id", shopId)
    .eq("user_id", userId)
    .maybeSingle();
  if (existingMember) return { error: "already_member" };

  const { error: insertError } = await db()
    .from("shop_members")
    .insert({ shop_id: shopId, user_id: userId, role });
  if (insertError) return { error: "generic" };

  await sendPasswordReset(email);
  return { ok: true };
}

export async function setShopMemberRole(
  shopId: string,
  memberId: string,
  role: ShopMemberRole,
): Promise<{ ok: true } | { error: UserAdminError }> {
  const { data: member } = await db()
    .from("shop_members")
    .select("id, role")
    .eq("id", memberId)
    .eq("shop_id", shopId)
    .maybeSingle();
  if (!member) return { error: "not_found" };

  if (member.role === "owner" && role !== "owner" && (await countOwners(shopId)) <= 1) {
    return { error: "last_owner" };
  }

  const { error } = await db().from("shop_members").update({ role }).eq("id", memberId);
  if (error) return { error: "generic" };
  return { ok: true };
}

export async function setShopMemberBanned(
  shopId: string,
  memberId: string,
  banned: boolean,
  actingUserId: string,
): Promise<{ ok: true } | { error: UserAdminError }> {
  const { data: member } = await db()
    .from("shop_members")
    .select("id, user_id, role")
    .eq("id", memberId)
    .eq("shop_id", shopId)
    .maybeSingle();
  if (!member) return { error: "not_found" };

  if (banned) {
    if (member.user_id === actingUserId) return { error: "self" };
    if (member.role === "owner" && (await countOwners(shopId)) <= 1) {
      return { error: "last_owner" };
    }
  }

  const { error } = await db().auth.admin.updateUserById(member.user_id, {
    ban_duration: banned ? "876000h" : "none",
  });
  if (error) return { error: "generic" };
  return { ok: true };
}

/** Quita la fila de `shop_members`: corta el acceso a este local en la siguiente petición -misma lógica que revocar un dispositivo-. La cuenta de Supabase Auth sigue existiendo, por si esa persona es admin de otro local. */
export async function removeShopMember(
  shopId: string,
  memberId: string,
  actingUserId: string,
): Promise<{ ok: true } | { error: UserAdminError }> {
  const { data: member } = await db()
    .from("shop_members")
    .select("id, user_id, role")
    .eq("id", memberId)
    .eq("shop_id", shopId)
    .maybeSingle();
  if (!member) return { error: "not_found" };
  if (member.user_id === actingUserId) return { error: "self" };
  if (member.role === "owner" && (await countOwners(shopId)) <= 1) {
    return { error: "last_owner" };
  }

  const { error } = await db().from("shop_members").delete().eq("id", memberId);
  if (error) return { error: "generic" };
  return { ok: true };
}

export async function resetShopMemberPassword(
  shopId: string,
  memberId: string,
): Promise<{ ok: true } | { error: UserAdminError }> {
  const { data: member } = await db()
    .from("shop_members")
    .select("user_id")
    .eq("id", memberId)
    .eq("shop_id", shopId)
    .maybeSingle();
  if (!member) return { error: "not_found" };

  const { data, error } = await db().auth.admin.getUserById(member.user_id);
  if (error || !data.user?.email) return { error: "generic" };

  await sendPasswordReset(data.user.email);
  return { ok: true };
}
