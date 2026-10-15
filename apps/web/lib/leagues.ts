import { type BreakdownLine, ruleSetSchema, sealHolds } from "@kachizaka/core";
import { schema } from "@kachizaka/db";
import { and, asc, desc, eq, inArray } from "drizzle-orm";

import { db } from "./db";

const { leagues, matches, members, predictionScores, predictions, ruleSets, seasons, standings } = schema;

export interface LeagueSummary {
  id: string;
  name: string;
  members: number;
}

/** The leagues an account belongs to. */
export async function leaguesOf(accountId: string): Promise<LeagueSummary[]> {
  const mine = await db().select({ id: leagues.id, name: leagues.name }).from(members).innerJoin(leagues, eq(leagues.id, members.leagueId)).where(eq(members.accountId, accountId)).orderBy(asc(leagues.name));
  if (!mine.length) return [];
  const roster = await db().select({ leagueId: members.leagueId }).from(members).where(inArray(members.leagueId, mine.map((l) => l.id)));
  return mine.map((l) => ({ ...l, members: roster.filter((r) => r.leagueId === l.id).length }));
}

export interface LeagueView {
  league: { id: string; name: string };
  me: { memberId: string; displayName: string };
  season: { id: string; label: string; competition: string } | null;
  rules: { version: number; seal: string; sealedAt: string | null; holds: boolean; values: Record<string, number> } | null;
  versions: { version: number; sealedAt: string | null }[];
  matches: { id: string; home: string; away: string; kickoffAt: string; status: "scheduled" | "live" | "final"; homeScore: number; awayScore: number; isFinal: boolean; seal: string | null; mine: { home: number; away: number; points: number | null; breakdown: BreakdownLine[]; provisional: boolean } | null }[];
  table: { memberId: string; displayName: string; rank: number; points: number; exact: number; predictions: number }[];
  tableVersion: number;
}

/**
 * Everything the league page draws, read on the server — and only for a member (anyone else gets `null`: a 404). The
 * seal is re-checked against the rules on every read: a row that no longer matches it says so instead of hiding it.
 */
export async function leagueView(leagueId: string, accountId: string): Promise<LeagueView | null> {
  const [me] = await db().select().from(members).where(and(eq(members.leagueId, leagueId), eq(members.accountId, accountId)));
  if (!me) return null;
  const [league] = await db().select({ id: leagues.id, name: leagues.name }).from(leagues).where(eq(leagues.id, leagueId));
  const [season] = await db().select().from(seasons).where(and(eq(seasons.leagueId, leagueId), eq(seasons.status, "open"))).orderBy(desc(seasons.startsOn)).limit(1);
  const versions = await db().select().from(ruleSets).where(eq(ruleSets.leagueId, leagueId)).orderBy(desc(ruleSets.version));
  const current = versions[0];
  const parsed = current ? ruleSetSchema.safeParse(current.rules) : null;
  const rules = current
    ? { version: current.version, seal: current.seal, sealedAt: current.sealedAt?.toISOString() ?? null, holds: !!parsed?.success && sealHolds(parsed.data, current.seal), values: (current.rules ?? {}) as Record<string, number> }
    : null;
  if (!season) return { league: league!, me: { memberId: me.id, displayName: me.displayName }, season: null, rules, versions: versions.map((v) => ({ version: v.version, sealedAt: v.sealedAt?.toISOString() ?? null })), matches: [], table: [], tableVersion: 0 };

  const games = await db().select().from(matches).where(eq(matches.seasonId, season.id)).orderBy(asc(matches.kickoffAt));
  const ids = games.map((g) => g.id);
  const myPredictions = ids.length ? await db().select().from(predictions).where(and(inArray(predictions.matchId, ids), eq(predictions.memberId, me.id))) : [];
  const myScores = ids.length ? await db().select().from(predictionScores).where(and(inArray(predictionScores.matchId, ids), eq(predictionScores.memberId, me.id))) : [];
  const rows = await db().select({ s: standings, name: members.displayName }).from(standings).innerJoin(members, eq(members.id, standings.memberId)).where(eq(standings.seasonId, season.id)).orderBy(asc(standings.rank), asc(members.displayName));
  return {
    league: league!,
    me: { memberId: me.id, displayName: me.displayName },
    season: { id: season.id, label: season.label, competition: season.competition },
    rules,
    versions: versions.map((v) => ({ version: v.version, sealedAt: v.sealedAt?.toISOString() ?? null })),
    matches: games.map((g) => {
      const p = myPredictions.find((x) => x.matchId === g.id);
      const s = myScores.find((x) => x.matchId === g.id);
      return {
        id: g.id,
        home: g.homeTeam,
        away: g.awayTeam,
        kickoffAt: g.kickoffAt.toISOString(),
        status: g.status,
        homeScore: g.homeScore,
        awayScore: g.awayScore,
        isFinal: g.isFinal,
        seal: g.ruleSetSeal,
        mine: p ? { home: p.home, away: p.away, points: s?.points ?? null, breakdown: (s?.breakdown as BreakdownLine[] | undefined) ?? [], provisional: s?.provisional ?? true } : null,
      };
    }),
    table: rows.map(({ s, name }) => ({ memberId: s.memberId, displayName: name, rank: s.rank, points: s.points, exact: s.exact, predictions: s.predictions })),
    tableVersion: rows[0]?.s.version ?? 0,
  };
}

/** Whether an account is a member of a league (the realtime stream checks it before it opens). */
export async function isMember(leagueId: string, accountId: string): Promise<boolean> {
  const [row] = await db().select({ id: members.id }).from(members).where(and(eq(members.leagueId, leagueId), eq(members.accountId, accountId)));
  return !!row;
}
