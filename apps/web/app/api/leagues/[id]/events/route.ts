import { eventStream } from "@krizaka/realtime";
import { z } from "zod";

import { requireSession } from "@/lib/access";
import { handle, refuse } from "@/lib/http";
import { isMember } from "@/lib/leagues";
import { leagueTopic, realtimeBus } from "@/lib/realtime";

export const dynamic = "force-dynamic";

/**
 * The league's live stream (Server-Sent Events): a member receives `standings` and `match` facts as the pipeline
 * applies them; the page then re-reads the table from the database. Reconnects on its own (retry 2 s, the stream ends
 * every 5 minutes under the platform's request timeout); a stranger gets a 404.
 */
export function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const session = await requireSession(req);
    const id = z.uuid().safeParse((await params).id);
    if (!id.success || !(await isMember(id.data, session.account.id))) throw refuse(404, "NOT_FOUND", "No such league");
    return eventStream({
      retryMs: 2000,
      heartbeatMs: 15_000,
      maxLifetimeMs: 300_000,
      start: ({ send }) => realtimeBus().subscribe(leagueTopic(id.data), (event) => send({ data: event })),
    });
  });
}
