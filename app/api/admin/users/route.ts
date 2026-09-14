import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdminContext } from "@/lib/auth/admin";
import { createShopMember } from "@/lib/auth/userAdmin";

const Body = z.object({
  email: z.string().trim().toLowerCase().email().max(160),
  role: z.enum(["owner", "operator"]),
});

export async function POST(request: Request) {
  const ctx = await getAdminContext();
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (ctx.role !== "owner") return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  const result = await createShopMember(ctx.shop.id, parsed.data.email, parsed.data.role);
  if ("error" in result) {
    const status = result.error === "already_member" ? 409 : 500;
    return NextResponse.json({ error: result.error }, { status });
  }

  return NextResponse.json({ ok: true });
}
