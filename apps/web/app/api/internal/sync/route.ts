import { devFeed, runSync } from "@kachizaka/db";

import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { handle, refuse } from "@/lib/http";
import { syncAuthorised, unlicensedSourcesAllowed } from "@/lib/sync-auth";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * The scheduled results sync: fixtures and results of the competitions the open seasons follow, the picks of every game
 * that ended scored by the sealed rules, the table recomputed. Called every 30 minutes by `.github/workflows/dev-sync.yml`
 * with OPERATOR_SYNC_TOKEN; answers 404 when no token is configured. Idempotent.
 */
export function POST(req: Request) {
  return handle(async () => {
    const door = syncAuthorised(req.headers.get("authorization"), env().OPERATOR_SYNC_TOKEN);
    if (door === "absent") return new Response("Not found", { status: 404 });
    if (door === "refused") throw refuse(401, "UNAUTHORISED", "A bearer token is required");
    const out = await runSync(db(), { feed: devFeed({ unlicensed: unlicensedSourcesAllowed() }), now: new Date(), back: 5, ahead: 14 });
    return Response.json({ ...out, at: new Date().toISOString() });
  });
}
