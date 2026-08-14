import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdminContext } from "@/lib/auth/admin";
import { newToken } from "@/lib/crypto";
import { db } from "@/lib/db/client";

const Body = z.object({ name: z.string().trim().min(1).max(60) });

/** Alta de un dispositivo de barra: genera su token de una tacada. */
export async function POST(request: Request) {
  const ctx = await getAdminContext();
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  const { error } = await db().from("devices").insert({
    shop_id: ctx.shop.id,
    name: parsed.data.name,
    token: newToken(),
  });

  if (error) {
    return NextResponse.json({ error: "generic" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
