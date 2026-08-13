import { NextResponse } from "next/server";
import { z } from "zod";
import { getDeviceContext, touchDeviceSession } from "@/lib/auth/device";
import { runScan } from "@/lib/scan-service";

const Body = z.object({
  token: z.string().trim().min(6).max(128),
  /** Segunda llamada del barista sobre una acción que regala producto. */
  confirm: z.boolean().optional(),
  pin: z.string().regex(/^\d{4}$/).optional(),
  /** De apertura de cámara a resultado. Es el presupuesto de tiempo del piloto. */
  durationMs: z.number().int().min(0).max(120_000).optional(),
});

export async function POST(request: Request) {
  const ctx = await getDeviceContext();
  if (!ctx) {
    return NextResponse.json({ error: "device_session" }, { status: 401 });
  }

  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  const { token, confirm, pin, durationMs } = parsed.data;
  const outcome = await runScan(ctx, { token }, { confirm, pin, durationMs });

  // Sin await: la marca de actividad no debe entrar en el presupuesto de 3 s.
  void touchDeviceSession(ctx.sessionId);

  if (outcome.status === "pin_required") {
    return NextResponse.json({ error: "pin_required" }, { status: 403 });
  }
  if (outcome.status === "pin_wrong") {
    return NextResponse.json({ error: "pin_wrong" }, { status: 403 });
  }

  return NextResponse.json(outcome.result);
}
