import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { ADMIN_COOKIE, issueAdminSession, verifyCredentials } from "@/lib/auth/admin";
import { db } from "@/lib/db/client";
import { env } from "@/lib/env";
import { clientIp, rateLimit } from "@/lib/rate-limit";

const Body = z.object({
  email: z.string().trim().email().max(160),
  password: z.string().min(8).max(200),
});

const SEVEN_DAYS = 60 * 60 * 24 * 7;

export async function POST(request: Request) {
  // Más estricto que el resto: aquí se prueban contraseñas.
  const limit = rateLimit(`admin:${clientIp(request.headers)}`, 8, 60_000);
  if (!limit.ok) {
    return NextResponse.json({ error: "rate" }, { status: 429 });
  }

  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "credentials" }, { status: 400 });
  }

  const userId = await verifyCredentials(parsed.data.email, parsed.data.password);
  if (!userId) {
    return NextResponse.json({ error: "credentials" }, { status: 401 });
  }

  // Tener cuenta en Supabase no basta: hay que ser miembro de un local.
  const { data: member } = await db()
    .from("shop_members")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();

  if (!member) {
    return NextResponse.json({ error: "no_access" }, { status: 403 });
  }

  const jar = await cookies();
  jar.set(ADMIN_COOKIE, issueAdminSession(userId), {
    httpOnly: true,
    sameSite: "lax",
    secure: env.isProduction,
    path: "/",
    maxAge: SEVEN_DAYS,
  });

  return NextResponse.json({ ok: true });
}
