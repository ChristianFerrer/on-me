import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdminContext } from "@/lib/auth/admin";
import { setShopMemberRole } from "@/lib/auth/userAdmin";

const Body = z.object({ role: z.enum(["owner", "operator"]) });

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getAdminContext();
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (ctx.role !== "owner") return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { id } = await params;
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  const result = await setShopMemberRole(ctx.shop.id, id, parsed.data.role);
  if ("error" in result) {
    const status =
      result.error === "not_found" ? 404 : result.error === "last_owner" ? 409 : 500;
    return NextResponse.json({ error: result.error }, { status });
  }

  return NextResponse.json({ ok: true });
}
