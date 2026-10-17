import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdminContext } from "@/lib/auth/admin";
import { db } from "@/lib/db/client";
import type { ShopRow } from "@/lib/db/types";
import { LOCALES } from "@/lib/i18n";

const Body = z
  .object({
    maxStampsPerScan: z.number().int().min(1).max(20).optional(),
    theme: z.enum(["dark", "light"]).optional(),
    cardStyle: z.enum(["digital", "real"]).optional(),
    cardBackground: z.enum(["lima", "blanco"]).optional(),
    defaultLocale: z.enum(LOCALES).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, { message: "empty" });

/** Ajustes del local. Solo el dueño puede tocarlos -mismo criterio que /admin/usuarios-. */
export async function PATCH(request: Request) {
  const ctx = await getAdminContext();
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (ctx.role !== "owner") return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  const update: Partial<
    Pick<ShopRow, "max_stamps_per_scan" | "theme" | "card_style" | "card_background" | "default_locale">
  > = {};
  if (parsed.data.maxStampsPerScan !== undefined) update.max_stamps_per_scan = parsed.data.maxStampsPerScan;
  if (parsed.data.theme !== undefined) update.theme = parsed.data.theme;
  if (parsed.data.cardStyle !== undefined) update.card_style = parsed.data.cardStyle;
  if (parsed.data.cardBackground !== undefined) update.card_background = parsed.data.cardBackground;
  if (parsed.data.defaultLocale !== undefined) update.default_locale = parsed.data.defaultLocale;

  const { error } = await db().from("shops").update(update).eq("id", ctx.shop.id);

  if (error) {
    return NextResponse.json({ error: "generic" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
