import { NextResponse } from "next/server";
import { getAdminContext } from "@/lib/auth/admin";
import { db } from "@/lib/db/client";

const BUCKET = "shop-logos";
/** De sobra para un logo -no es una foto de producto-: más grande solo tarda más en cargar sobre la tarjeta del cliente. */
const MAX_BYTES = 2 * 1024 * 1024;
const ALLOWED_TYPES: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/svg+xml": "svg",
};

/** Logo del local, para la tarjeta del cliente. Solo el dueño puede tocarlo -mismo criterio que el resto de /admin/ajustes-. */
export async function POST(request: Request) {
  const ctx = await getAdminContext();
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (ctx.role !== "owner") return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const form = await request.formData().catch(() => null);
  const file = form?.get("logo");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  const ext = ALLOWED_TYPES[file.type];
  if (!ext) return NextResponse.json({ error: "unsupported_type" }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "too_large" }, { status: 400 });

  // Mismo nombre siempre -un logo por local-: subir uno nuevo sustituye al
  // anterior en vez de acumular archivos huérfanos en el bucket.
  const path = `${ctx.shop.id}/logo.${ext}`;
  const bytes = new Uint8Array(await file.arrayBuffer());

  const { error: uploadError } = await db()
    .storage.from(BUCKET)
    .upload(path, bytes, { contentType: file.type, upsert: true });

  if (uploadError) {
    return NextResponse.json({ error: "generic" }, { status: 500 });
  }

  const { data } = db().storage.from(BUCKET).getPublicUrl(path);
  // El path no cambia entre subidas -upsert-, así que sin algo que lo
  // distinga el navegador seguiría enseñando el logo viejo desde caché.
  const logoUrl = `${data.publicUrl}?v=${Date.now()}`;

  const { error } = await db().from("shops").update({ logo_url: logoUrl }).eq("id", ctx.shop.id);
  if (error) {
    return NextResponse.json({ error: "generic" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, logoUrl });
}

export async function DELETE() {
  const ctx = await getAdminContext();
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (ctx.role !== "owner") return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { error } = await db().from("shops").update({ logo_url: null }).eq("id", ctx.shop.id);
  if (error) {
    return NextResponse.json({ error: "generic" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
