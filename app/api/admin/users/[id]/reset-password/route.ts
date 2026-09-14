import { NextResponse } from "next/server";
import { getAdminContext } from "@/lib/auth/admin";
import { resetShopMemberPassword } from "@/lib/auth/userAdmin";

/** Reutiliza el mismo email de recuperación de /admin/constelacion-sol -sendPasswordReset-, no un flujo aparte. */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getAdminContext();
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (ctx.role !== "owner") return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { id } = await params;
  const result = await resetShopMemberPassword(ctx.shop.id, id);
  if ("error" in result) {
    const status = result.error === "not_found" ? 404 : 500;
    return NextResponse.json({ error: result.error }, { status });
  }

  return NextResponse.json({ ok: true });
}
