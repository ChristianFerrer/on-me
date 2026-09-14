import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdminContext } from "@/lib/auth/admin";
import { setShopMemberPassword } from "@/lib/auth/userAdmin";

const Body = z.object({ password: z.string().min(8).max(200) });

/** Fija la contraseña a mano -no manda ningún email-: la alternativa directa a /reset-password para cuando el admin ya sabe qué contraseña quiere poner. */
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

  const result = await setShopMemberPassword(ctx.shop.id, id, parsed.data.password);
  if ("error" in result) {
    const status = result.error === "not_found" ? 404 : 500;
    return NextResponse.json({ error: result.error }, { status });
  }

  return NextResponse.json({ ok: true });
}
