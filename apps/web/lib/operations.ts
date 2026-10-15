import { type Operations,sealMismatches } from "./admin-content";
import { pool, query } from "./db";
import { budgetLimit, SILENT_MINUTES } from "./operations-shared";

/** What an operator reads to know whether the service is well: the pool and connections against their budget, the facts pipeline, silent live matches, the seals. */
export async function operations(): Promise<Operations> {
  const p = pool();
  const [budget] = await query<{ open: string; role_limit: number; server_limit: string }>(
    `SELECT (SELECT count(*) FROM pg_stat_activity WHERE datname = current_database()) AS open,
            (SELECT rolconnlimit FROM pg_roles WHERE rolname = current_user) AS role_limit,
            current_setting('max_connections') AS server_limit`,
  );
  const [facts] = await query<{ pending: string; oldest: number | null }>("SELECT count(*) AS pending, extract(epoch FROM now() - min(received_at)) / 60 AS oldest FROM match_events WHERE applied_at IS NULL");
  const [live] = await query<{ matches: string; silent: string }>(
    `SELECT count(*) AS matches,
            count(*) FILTER (WHERE coalesce((SELECT max(received_at) FROM match_events e WHERE e.match_id = x.id), x.kickoff_at) < now() - make_interval(mins => $1)) AS silent
       FROM matches x WHERE x.status = 'live'`,
    [SILENT_MINUTES],
  );
  const [refused] = await query<{ n: string }>("SELECT count(*) AS n FROM audit_log WHERE action = 'auth.sign_in_refused' AND at > now() - interval '24 hours'");
  return {
    pool: { max: p.options.max ?? 10, total: p.totalCount, idle: p.idleCount, waiting: p.waitingCount },
    connections: { open: Number(budget?.open ?? 0), limit: budgetLimit(Number(budget?.role_limit ?? -1), Number(budget?.server_limit ?? 0)) },
    facts: { pending: Number(facts?.pending ?? 0), oldestPendingMinutes: facts?.oldest == null ? null : Math.round(facts.oldest) },
    live: { matches: Number(live?.matches ?? 0), silentMatches: Number(live?.silent ?? 0) },
    mismatches: await sealMismatches(),
    refusedSignIns24h: Number(refused?.n ?? 0),
  };
}
