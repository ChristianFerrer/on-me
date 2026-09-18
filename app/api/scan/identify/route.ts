import { NextResponse } from "next/server";
import { z } from "zod";
import { getDeviceContext, touchDeviceSession } from "@/lib/auth/device";
import { identifyCustomer } from "@/lib/identify-service";

const Body = z.object({
  token: z.string().trim().min(6).max(128),
});

/**
 * Flujo identificador: escanear el código del cliente y traer su perfil,
 * sin sellar ni canjear nada todavía. Ver /api/scan/identify/apply para la
 * acción que de verdad muta algo.
 */
export async function POST(request: Request) {
  const ctx = await getDeviceContext();
  if (!ctx) {
    return NextResponse.json({ error: "device_session" }, { status: 401 });
  }

  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  const result = await identifyCustomer(ctx, parsed.data.token);

  void touchDeviceSession(ctx.sessionId);

  return NextResponse.json(result);
}
