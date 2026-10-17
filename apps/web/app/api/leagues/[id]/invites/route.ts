import { createInvite } from "@kachizaka/db";
import { schema } from "@kachizaka/db";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { requireSession } from "@/lib/access";
import { db } from "@/lib/db";
import { handle, refuse } from "@/lib/http";
import { playing } from "@/lib/play-http";
import { limit } from "@/lib/rate-limit";

/** A member creates an invite link for their league (7 days). The token is shown once; only its hash is kept. */
export function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const session = await requireSession(req);
    const id = z.uuid().safeParse((await ctx.params).id);
    if (!id.success) throw refuse(404, "NOT_FOUND", "Unknown league");
    limit("league-invite", req, session.account.id, [30, 3600]);
    const [me] = await db().select().from(schema.members).where(and(eq(schema.members.leagueId, id.data), eq(schema.members.accountId, session.account.id)));
    if (!me) throw refuse(404, "NOT_FOUND", "Unknown league");
    const invite = await playing(() => createInvite(db(), { leagueId: id.data, memberId: me.id, now: new Date() }));
    return Response.json({ token: invite.token, expiresAt: invite.expiresAt.toISOString() }, { status: 201 });
  });
}
