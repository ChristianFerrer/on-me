import { NextResponse } from "next/server";
import { z } from "zod";
import { sendPasswordReset } from "@/lib/auth/admin";
import { clientIp, rateLimit } from "@/lib/rate-limit";

const Body = z.object({
  email: z.string().trim().email().max(160),
});

export async function POST(request: Request) {
  // Tan estricto como el propio login: dispara un email por intento.
  const limit = rateLimit(`admin-reset:${clientIp(request.headers)}`, 5, 60_000);
  if (!limit.ok) {
    return NextResponse.json({ error: "rate" }, { status: 429 });
  }

  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  await sendPasswordReset(parsed.data.email);

  // Siempre "ok", exista o no la cuenta: ver sendPasswordReset.
  return NextResponse.json({ ok: true });
}
