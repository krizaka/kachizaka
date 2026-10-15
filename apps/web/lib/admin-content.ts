import { query } from "./db";

/** What the console reads of Kachizaka's own objects: leagues, matches and their facts, rule sets and their seals. Metadata only: never a member's prediction. */

export interface AdminLeague {
  id: string;
  name: string;
  owner: string | null;
  members: number;
  seasons: number;
  matches: number;
  createdAt: string;
}

export async function leaguesOverview(): Promise<AdminLeague[]> {
  const rows = await query<{ id: string; name: string; owner: string | null; members: string; seasons: string; matches: string; created_at: Date }>(
    `SELECT l.id, l.name, a.email AS owner, l.created_at,
            (SELECT count(*) FROM league_members m WHERE m.league_id = l.id) AS members,
            (SELECT count(*) FROM seasons s WHERE s.league_id = l.id) AS seasons,
            (SELECT count(*) FROM matches x JOIN seasons s ON s.id = x.season_id WHERE s.league_id = l.id) AS matches
       FROM leagues l LEFT JOIN accounts a ON a.id = l.owner_id ORDER BY l.created_at DESC LIMIT 500`,
  );
  return rows.map((r) => ({ id: r.id, name: r.name, owner: r.owner, members: Number(r.members), seasons: Number(r.seasons), matches: Number(r.matches), createdAt: r.created_at.toISOString() }));
}

export interface AdminMatch {
  id: string;
  league: string;
  season: string;
  fixture: string;
  kickoffAt: string;
  status: "scheduled" | "live" | "final";
  score: string;
  /** Facts received that are not applied yet: a gap in the sequence, or a pipeline that stopped. */
  pendingFacts: number;
  appliedSeq: number;
  /** The seal the match kicked off with; null while it is scheduled. */
  seal: string | null;
  predictions: number;
}

export async function matchesOverview(): Promise<AdminMatch[]> {
  const rows = await query<{ id: string; league: string; season: string; home: string; away: string; kickoff_at: Date; status: AdminMatch["status"]; home_score: number; away_score: number; applied_seq: number; rule_set_seal: string | null; pending: string; predictions: string }>(
    `SELECT x.id, l.name AS league, s.label AS season, x.home_team AS home, x.away_team AS away, x.kickoff_at, x.status, x.home_score, x.away_score, x.applied_seq, x.rule_set_seal,
            (SELECT count(*) FROM match_events e WHERE e.match_id = x.id AND e.applied_at IS NULL) AS pending,
            (SELECT count(*) FROM predictions p WHERE p.match_id = x.id) AS predictions
       FROM matches x JOIN seasons s ON s.id = x.season_id JOIN leagues l ON l.id = s.league_id ORDER BY x.kickoff_at DESC LIMIT 500`,
  );
  return rows.map((r) => ({ id: r.id, league: r.league, season: r.season, fixture: `${r.home} – ${r.away}`, kickoffAt: r.kickoff_at.toISOString(), status: r.status, score: `${r.home_score}–${r.away_score}`, pendingFacts: Number(r.pending), appliedSeq: r.applied_seq, seal: r.rule_set_seal, predictions: Number(r.predictions) }));
}

export interface AdminRuleSet {
  id: string;
  league: string;
  version: number;
  seal: string;
  sealedAt: string | null;
  /** Matches that kicked off under this exact seal. */
  matchesUsing: number;
  createdAt: string;
}

export async function ruleSetsOverview(): Promise<AdminRuleSet[]> {
  const rows = await query<{ id: string; league: string; version: number; seal: string; sealed_at: Date | null; created_at: Date; using: string }>(
    `SELECT r.id, l.name AS league, r.version, r.seal, r.sealed_at, r.created_at,
            (SELECT count(*) FROM matches x WHERE x.rule_set_id = r.id) AS using
       FROM rule_sets r JOIN leagues l ON l.id = r.league_id ORDER BY l.name, r.version DESC LIMIT 500`,
  );
  return rows.map((r) => ({ id: r.id, league: r.league, version: r.version, seal: r.seal, sealedAt: r.sealed_at?.toISOString() ?? null, matchesUsing: Number(r.using), createdAt: r.created_at.toISOString() }));
}

/** A match whose recorded seal differs from its rule set's: the invariant the database enforces — shown here so an operator can see it hold. */
export async function sealMismatches(): Promise<number> {
  const [row] = await query<{ n: string }>("SELECT count(*) AS n FROM matches x JOIN rule_sets r ON r.id = x.rule_set_id WHERE x.rule_set_seal IS DISTINCT FROM r.seal");
  return Number(row?.n ?? 0);
}

export interface Operations {
  pool: { max: number; total: number; idle: number; waiting: number };
  connections: { open: number; limit: number };
  facts: { pending: number; oldestPendingMinutes: number | null };
  live: { matches: number; silentMatches: number };
  mismatches: number;
  refusedSignIns24h: number;
}
