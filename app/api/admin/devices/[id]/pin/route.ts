import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdminContext } from "@/lib/auth/admin";
import { hashWithSalt } from "@/lib/crypto";
import { db } from "@/lib/db/client";

const Body = z.object({ pin: z.string().regex(/^\d{4}$/) });

/**
 * Fija o quita el PIN de canje del dispositivo. Comprueba en cada petición
 * que el dispositivo es del local del admin autenticado: el id va en la URL
 * y no hay que fiarse de que nadie lo haya manipulado a mano.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getAdminContext();
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  const { data, error } = await db()
    .from("devices")
    .update({ pin_hash: hashWithSalt(parsed.data.pin) })
    .eq("id", id)
    .eq("shop_id", ctx.shop.id)
    .select("id")
    .maybeSingle();

  if (error) return NextResponse.json({ error: "generic" }, { status: 500 });
  if (!data) return NextResponse.json({ error: "not_found" }, { status: 404 });

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getAdminContext();
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;

  const { data, error } = await db()
    .from("devices")
    .update({ pin_hash: null })
    .eq("id", id)
    .eq("shop_id", ctx.shop.id)
    .select("id")
    .maybeSingle();

  if (error) return NextResponse.json({ error: "generic" }, { status: 500 });
  if (!data) return NextResponse.json({ error: "not_found" }, { status: 404 });

  return NextResponse.json({ ok: true });
}
