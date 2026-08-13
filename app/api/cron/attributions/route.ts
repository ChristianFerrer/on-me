import { NextResponse } from "next/server";
import { runAttributionSweep } from "@/lib/cron/attributions";
import { env } from "@/lib/env";

/** El barrido recorre filas de una en una; puede pasar de los 10 s por defecto. */
export const maxDuration = 60;

/**
 * Barrido diario a las 04:00, disparado por Vercel Cron, que manda
 * `Authorization: Bearer $CRON_SECRET`.
 */
export async function GET(request: Request) {
  const authorization = request.headers.get("authorization");
  if (authorization !== `Bearer ${env.cronSecret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const report = await runAttributionSweep();
  return NextResponse.json(report);
}
