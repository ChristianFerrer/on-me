import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdminContext } from "@/lib/auth/admin";
import { db } from "@/lib/db/client";

const Body = z.object({
  maxStampsPerScan: z.number().int().min(1).max(20),
});

/** Ajustes del local. Solo el dueño puede tocarlos -mismo criterio que /admin/usuarios-. */
export async function PATCH(request: Request) {
  const ctx = await getAdminContext();
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (ctx.role !== "owner") return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  const { error } = await db()
    .from("shops")
    .update({ max_stamps_per_scan: parsed.data.maxStampsPerScan })
    .eq("id", ctx.shop.id);

  if (error) {
    return NextResponse.json({ error: "generic" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
