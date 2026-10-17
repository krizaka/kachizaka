import { joinWithInvite } from "@kachizaka/db";
import { z } from "zod";

import { requireSession } from "@/lib/access";
import { db } from "@/lib/db";
import { handle, readJson } from "@/lib/http";
import { playing } from "@/lib/play-http";
import { limit } from "@/lib/rate-limit";

const body = z.object({ token: z.string().min(8).max(128) });

/** A signed-in account joins a league with an invite link's token (sign-up stays closed: the account already exists). */
export function POST(req: Request) {
  return handle(async () => {
    const session = await requireSession(req);
    limit("join", req, session.account.id, [20, 900]);
    const { token } = await readJson(req, body);
    const joined = await playing(() => joinWithInvite(db(), { token, accountId: session.account.id, displayName: session.account.email.split("@")[0]!, now: new Date() }));
    return Response.json({ leagueId: joined.leagueId, joined: joined.joined });
  });
}
