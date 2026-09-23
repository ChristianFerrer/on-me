import { NextResponse } from "next/server";
import { z } from "zod";
import { getDeviceContext, touchDeviceSession } from "@/lib/auth/device";
import { applyIdentifiedVisit } from "@/lib/identify-service";

const Body = z.object({
  customerId: z.string().uuid(),
  // El tope de verdad -el que se ve en pantalla- es shops.max_stamps_per_scan,
  // configurable por local y aplicado en applyIdentifiedVisit(); 20 aquí es
  // solo el techo absoluto del propio input, igual que redeemCount.
  addStamps: z.number().int().min(0).max(20),
  redeemCount: z.number().int().min(0).max(20),
  pin: z.string().regex(/^\d{4}$/).optional(),
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

  const { customerId, addStamps, redeemCount, pin } = parsed.data;
  const outcome = await applyIdentifiedVisit(ctx, customerId, { addStamps, redeemCount, pin });

  void touchDeviceSession(ctx.sessionId);

  if (outcome.status === "pin_required") {
    return NextResponse.json({ error: "pin_required" }, { status: 403 });
  }
  if (outcome.status === "pin_wrong") {
    return NextResponse.json({ error: "pin_wrong" }, { status: 403 });
  }

  return NextResponse.json(outcome.result);
}
