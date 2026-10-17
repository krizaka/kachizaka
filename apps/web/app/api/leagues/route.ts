import { COMPETITION_IDS } from "@kachizaka/core";
import { createLeagueWithSeason } from "@kachizaka/db";
import { z } from "zod";

import { requireSession } from "@/lib/access";
import { db } from "@/lib/db";
import { handle, readJson } from "@/lib/http";
import { limit } from "@/lib/rate-limit";

const body = z.object({ name: z.string().trim().min(2).max(60), competitions: z.array(z.enum(COMPETITION_IDS as [string, ...string[]])).min(1).max(COMPETITION_IDS.length) });

/** A member starts a league: its rules (one set per sport), its season on the competitions chosen. 10 per IP per hour. */
export function POST(req: Request) {
  return handle(async () => {
    const session = await requireSession(req);
    limit("league-create", req, session.account.id, [10, 3600]);
    const { name, competitions } = await readJson(req, body);
    const owner = session.account.email.split("@")[0]!;
    const { league } = await createLeagueWithSeason(db(), { name, ownerId: session.account.id, ownerName: owner, competitions: [...new Set(competitions)], now: new Date() });
    return Response.json({ id: league.id }, { status: 201 });
  });
}
