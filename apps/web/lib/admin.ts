import { query } from "./db";

export interface Overview {
  accounts: number;
  admins: number;
  suspended: number;
  leagues: number;
  live: number;
  facts: number;
  lastFactAt: string | null;
}

/** The administration's counts — metadata only, never a member's predictions. */
export async function overview(): Promise<Overview> {
  const [row] = await query<{ accounts: string; admins: string; suspended: string; leagues: string; live: string; facts: string; last_fact_at: Date | null }>(
    `SELECT (SELECT count(*) FROM accounts) AS accounts,
            (SELECT count(*) FROM accounts WHERE role = 'ADMIN') AS admins,
            (SELECT count(*) FROM accounts WHERE status = 'SUSPENDED') AS suspended,
            (SELECT count(*) FROM leagues) AS leagues,
            (SELECT count(*) FROM matches WHERE status = 'live') AS live,
            (SELECT count(*) FROM match_events) AS facts,
            (SELECT max(received_at) FROM match_events) AS last_fact_at`,
  );
  return {
    accounts: Number(row?.accounts ?? 0),
    admins: Number(row?.admins ?? 0),
    suspended: Number(row?.suspended ?? 0),
    leagues: Number(row?.leagues ?? 0),
    live: Number(row?.live ?? 0),
    facts: Number(row?.facts ?? 0),
    lastFactAt: row?.last_fact_at?.toISOString() ?? null,
  };
}
