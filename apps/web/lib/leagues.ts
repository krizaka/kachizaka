import { type BreakdownLine, MATCH_STATUS, parseRulesFor, roundOf, sealHoldsFor,SPORT_IDS, type SportId } from "@kachizaka/core";
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
  /** The rules in force for each sport, with their seal (re-checked on every read). */
  rules: { sport: SportId; version: number; seal: string; sealedAt: string | null; holds: boolean; values: Record<string, unknown> }[];
  /** My season in four figures. `streak`: the latest finished picks in a row that earned points. */
  stats: { rank: number | null; points: number; perfect: number; picks: number; streak: number };
  matches: { id: string; round: string; sport: SportId; competition: string | null; home: string; away: string; kickoffAt: string; status: "scheduled" | "live" | "final"; homeScore: number; awayScore: number; overtime: boolean; isFinal: boolean; seal: string | null; mine: { home: number | null; away: number | null; winner: "home" | "away" | null; band: number | null; overtime: boolean; points: number | null; breakdown: BreakdownLine[]; provisional: boolean; perfect: boolean } | null }[];
  table: { memberId: string; displayName: string; rank: number; points: number; exact: number; predictions: number }[];
  tableVersion: number;
  /** What everyone picked — only for a match that has kicked off (a pick stays private until then). */
  reveals: Record<string, { memberId: string; name: string; home: number | null; away: number | null; winner: "home" | "away" | null; band: number | null; overtime: boolean; points: number | null; breakdown: BreakdownLine[]; provisional: boolean; perfect: boolean }[]>;
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
  const all = await db().select().from(ruleSets).where(eq(ruleSets.leagueId, leagueId)).orderBy(desc(ruleSets.version));
  const rules = SPORT_IDS.flatMap((sport) => {
    const current = all.find((r) => r.sport === sport);
    if (!current) return [];
    const parsed = (() => {
      try {
        return parseRulesFor(sport, current.rules);
      } catch {
        return null;
      }
    })();
    return [{ sport, version: current.version, seal: current.seal, sealedAt: current.sealedAt?.toISOString() ?? null, holds: !!parsed && sealHoldsFor(sport, parsed, current.seal), values: (current.rules ?? {}) as Record<string, unknown> }];
  });
  if (!season) return { league: league!, me: { memberId: me.id, displayName: me.displayName }, season: null, rules, stats: { rank: null, points: 0, perfect: 0, picks: 0, streak: 0 }, matches: [], table: [], tableVersion: 0, reveals: {} };

  const games = await db().select().from(matches).where(eq(matches.seasonId, season.id)).orderBy(asc(matches.kickoffAt));
  const ids = games.map((g) => g.id);
  const myPredictions = ids.length ? await db().select().from(predictions).where(and(inArray(predictions.matchId, ids), eq(predictions.memberId, me.id))) : [];
  const myScores = ids.length ? await db().select().from(predictionScores).where(and(inArray(predictionScores.matchId, ids), eq(predictionScores.memberId, me.id))) : [];
  const rows = await db().select({ s: standings, name: members.displayName }).from(standings).innerJoin(members, eq(members.id, standings.memberId)).where(eq(standings.seasonId, season.id)).orderBy(asc(standings.rank), asc(members.displayName));
  const started = games.filter((g) => g.status !== MATCH_STATUS.scheduled).map((g) => g.id);
  const allScores = started.length ? await db().select({ p: predictions, s: predictionScores, name: members.displayName }).from(predictions).innerJoin(members, eq(members.id, predictions.memberId)).leftJoin(predictionScores, eq(predictionScores.predictionId, predictions.id)).where(inArray(predictions.matchId, started)) : [];
  const reveals: LeagueView["reveals"] = {};
  for (const { p, s, name } of allScores) {
    (reveals[p.matchId] ??= []).push({ memberId: p.memberId, name, home: p.home, away: p.away, winner: p.winner, band: p.band, overtime: p.overtime, points: s?.points ?? null, breakdown: (s?.breakdown as BreakdownLine[] | undefined) ?? [], provisional: s?.provisional ?? true, perfect: s?.perfect ?? false });
  }
  for (const list of Object.values(reveals)) list.sort((a, b) => (b.points ?? -1) - (a.points ?? -1) || a.name.localeCompare(b.name));
  const mine = rows.find((r) => r.s.memberId === me.id)?.s;
  const finished = [...games].reverse().filter((g) => g.status === MATCH_STATUS.final);
  let streak = 0;
  for (const g of finished) {
    const sc = myScores.find((x) => x.matchId === g.id);
    if (!sc || sc.points <= 0) break;
    streak++;
  }
  return {
    league: league!,
    me: { memberId: me.id, displayName: me.displayName },
    stats: { rank: mine?.rank ?? null, points: mine?.points ?? 0, perfect: mine?.exact ?? 0, picks: mine?.predictions ?? 0, streak },
    reveals,
    season: { id: season.id, label: season.label, competition: season.competition },
    rules,
    matches: games.map((g) => {
      const p = myPredictions.find((x) => x.matchId === g.id);
      const s = myScores.find((x) => x.matchId === g.id);
      return {
        id: g.id,
        round: roundOf(g.kickoffAt),
        sport: g.sport,
        competition: g.competition,
        home: g.homeTeam,
        away: g.awayTeam,
        kickoffAt: g.kickoffAt.toISOString(),
        status: g.status,
        homeScore: g.homeScore,
        awayScore: g.awayScore,
        overtime: g.overtime,
        isFinal: g.isFinal,
        seal: g.ruleSetSeal,
        mine: p ? { home: p.home, away: p.away, winner: p.winner, band: p.band, overtime: p.overtime, points: s?.points ?? null, breakdown: (s?.breakdown as BreakdownLine[] | undefined) ?? [], provisional: s?.provisional ?? true, perfect: s?.perfect ?? false } : null,
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
