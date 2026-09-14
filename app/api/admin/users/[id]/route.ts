import { NextResponse } from "next/server";
import { getAdminContext } from "@/lib/auth/admin";
import { removeShopMember } from "@/lib/auth/userAdmin";

/** Quita el acceso de este admin al local -no borra su cuenta de Supabase Auth, ver removeShopMember-. */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getAdminContext();
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (ctx.role !== "owner") return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { id } = await params;
  const result = await removeShopMember(ctx.shop.id, id, ctx.userId);
  if ("error" in result) {
    const status =
      result.error === "not_found"
        ? 404
        : result.error === "self" || result.error === "last_owner"
          ? 409
          : 500;
    return NextResponse.json({ error: result.error }, { status });
  }

  return NextResponse.json({ ok: true });
}
