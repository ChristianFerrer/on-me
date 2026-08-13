import { NextResponse } from "next/server";
import { z } from "zod";
import { getDeviceContext, touchDeviceSession } from "@/lib/auth/device";
import { runScan } from "@/lib/scan-service";

const Body = z.object({
  customerId: z.string().uuid(),
  confirm: z.boolean().optional(),
  pin: z.string().regex(/^\d{4}$/).optional(),
});

/**
 * Sellado por búsqueda, cuando el cliente se ha dejado el móvil o no hay luz
 * suficiente para la cámara. Marca `manual = true`: si esta vía supera el 15%
 * de los sellos, el escáner no está funcionando y hay que arreglarlo antes
 * que ninguna otra cosa.
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

  const { customerId, confirm, pin } = parsed.data;
  const outcome = await runScan(
    ctx,
    { customerId },
    { confirm, pin, manual: true },
  );

  void touchDeviceSession(ctx.sessionId);

  if (outcome.status === "pin_required") {
    return NextResponse.json({ error: "pin_required" }, { status: 403 });
  }
  if (outcome.status === "pin_wrong") {
    return NextResponse.json({ error: "pin_wrong" }, { status: 403 });
  }

  return NextResponse.json(outcome.result);
}
