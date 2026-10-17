import { savePick, schema } from "@kachizaka/db";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { requireSession } from "@/lib/access";
import { db } from "@/lib/db";
import { handle, readJson, refuse } from "@/lib/http";
import { playing } from "@/lib/play-http";
import { limit } from "@/lib/rate-limit";

const body = z.object({ matchId: z.uuid(), pick: z.record(z.string(), z.unknown()) });

/** A member picks (or changes a pick) for a match of their league, in the shape of its sport; closed at kick-off. */
export function PUT(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const session = await requireSession(req);
    const id = z.uuid().safeParse((await ctx.params).id);
    if (!id.success) throw refuse(404, "NOT_FOUND", "Unknown league");
    limit("pick", req, session.account.id, [300, 900]);
    const { matchId, pick } = await readJson(req, body);
    const [me] = await db().select().from(schema.members).where(and(eq(schema.members.leagueId, id.data), eq(schema.members.accountId, session.account.id)));
    if (!me) throw refuse(404, "NOT_FOUND", "Unknown league");
    await playing(() => savePick(db(), { leagueId: id.data, memberId: me.id, matchId, pick }));
    return Response.json({ ok: true });
  });
}
