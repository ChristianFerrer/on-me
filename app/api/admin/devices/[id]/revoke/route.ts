import { NextResponse } from "next/server";
import { getAdminContext } from "@/lib/auth/admin";
import { db } from "@/lib/db/client";

/**
 * Revoca toda sesión activa del dispositivo. El token de alta no cambia:
 * si el iPad reaparece, se reabre el mismo enlace y listo. Lo que corta
 * el acceso inmediato es esto, no borrar ni desactivar el dispositivo.
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getAdminContext();
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;

  const { data: device } = await db()
    .from("devices")
    .select("id")
    .eq("id", id)
    .eq("shop_id", ctx.shop.id)
    .maybeSingle();

  if (!device) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const { error } = await db()
    .from("device_sessions")
    .update({ revoked_at: new Date().toISOString() })
    .eq("device_id", id)
    .is("revoked_at", null);

  if (error) return NextResponse.json({ error: "generic" }, { status: 500 });

  return NextResponse.json({ ok: true });
}
