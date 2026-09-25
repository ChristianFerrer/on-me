import { NextResponse } from "next/server";
import { z } from "zod";
import { getDeviceContext, touchDeviceSession } from "@/lib/auth/device";
import { updateIdentifiedCustomer } from "@/lib/identify-service";

const Body = z.object({
  customerId: z.string().uuid(),
  name: z.string().trim().min(1).max(80),
  phone: z.string().trim().min(5).max(32),
});

/** Edita nombre/teléfono desde el panel del flujo identificador -ver CustomerProfilePanel.tsx-. */
export async function POST(request: Request) {
  const ctx = await getDeviceContext();
  if (!ctx) {
    return NextResponse.json({ error: "device_session" }, { status: 401 });
  }

  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  const result = await updateIdentifiedCustomer(ctx, parsed.data.customerId, {
    name: parsed.data.name,
    phone: parsed.data.phone,
  });

  void touchDeviceSession(ctx.sessionId);

  if (result.status === "error") {
    const status = result.reason === "not_found" || result.reason === "other_shop" ? 404 : 400;
    return NextResponse.json({ error: result.reason }, { status });
  }

  return NextResponse.json(result.profile);
}
