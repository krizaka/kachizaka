import { and, desc, eq, sql } from "drizzle-orm";

import type { Db } from "./client";
import { accounts, leagues, matches, members, predictions, predictionScores, seasons, standings } from "./schema";

/** The personas' addresses end here: a league owned by one of them is a demonstration league, never a real person's. */
export const PERSONA_DOMAIN = "@personas.kachizaka.test";

export type ShowcaseSport = "soccer" | "hockey" | "basketball";

export interface ShowcasePick {
  member: string;
  home: number | null;
  away: number | null;
  overtime: boolean;
  points: number | null;
}

export interface ShowcaseResult {
  competition: string | null;
  home: string;
  away: string;
  homeScore: number;
  awayScore: number;
  overtime: boolean;
  kickoffAt: string;
  picks: ShowcasePick[];
}

export interface ShowcaseRow {
  member: string;
  points: number;
  exact: number;
  predictions: number;
}

export interface ShowcaseLeague {
  name: string;
  /** The season's table, overall (every sport), best first. */
  table: ShowcaseRow[];
  /** When the table last moved (a result applied). */
  updatedAt: string | null;
  sports: Record<ShowcaseSport, { table: ShowcaseRow[]; results: ShowcaseResult[] }>;
}

const SPORTS: ShowcaseSport[] = ["soccer", "hockey", "basketball"];

/**
 * The demonstration league of the dev environment as the public landing shows it — its real table and its last results,
 * read from the database. Only a league owned by a persona (`PERSONA_DOMAIN`) is ever returned: the landing never shows a
 * real member. `null` when there is no such league (a fresh database, production).
 */
export async function showcaseLeague(db: Db, input: { name: string; results?: number }): Promise<ShowcaseLeague | null> {
  const [league] = await db
    .select({ id: leagues.id, name: leagues.name })
    .from(leagues)
    .innerJoin(accounts, eq(accounts.id, leagues.ownerId))
    .where(and(eq(leagues.name, input.name), sql`${accounts.email} LIKE ${`%${PERSONA_DOMAIN}`}`))
    .limit(1);
  if (!league) return null;
  const [season] = await db.select({ id: seasons.id }).from(seasons).where(eq(seasons.leagueId, league.id)).orderBy(desc(seasons.startsOn)).limit(1);
  if (!season) return null;

  const names = new Map((await db.select({ id: members.id, name: members.displayName }).from(members).where(eq(members.leagueId, league.id))).map((m) => [m.id, m.name]));

  const overall = await db.select().from(standings).where(eq(standings.seasonId, season.id));
  const row = (memberId: string, points: number, exact: number, n: number): ShowcaseRow => ({ member: names.get(memberId) ?? "?", points, exact, predictions: n });
  const byPoints = (a: ShowcaseRow, b: ShowcaseRow) => b.points - a.points || b.exact - a.exact || a.member.localeCompare(b.member);

  const perSport = await db
    .select({
      sport: matches.sport,
      memberId: predictionScores.memberId,
      points: sql<number>`sum(${predictionScores.points})::int`,
      exact: sql<number>`count(*) filter (where ${predictionScores.perfect})::int`,
      n: sql<number>`count(*)::int`,
    })
    .from(predictionScores)
    .innerJoin(matches, eq(matches.id, predictionScores.matchId))
    .where(eq(matches.seasonId, season.id))
    .groupBy(matches.sport, predictionScores.memberId);

  const last = await db
    .select()
    .from(matches)
    .where(and(eq(matches.seasonId, season.id), eq(matches.status, "final")))
    .orderBy(desc(matches.kickoffAt));
  const picks = await db
    .select({ matchId: predictions.matchId, memberId: predictions.memberId, home: predictions.home, away: predictions.away, overtime: predictions.overtime, points: predictionScores.points })
    .from(predictions)
    .leftJoin(predictionScores, eq(predictionScores.predictionId, predictions.id))
    .innerJoin(matches, eq(matches.id, predictions.matchId))
    .where(and(eq(matches.seasonId, season.id), eq(matches.status, "final")));

  const sports = {} as ShowcaseLeague["sports"];
  for (const sport of SPORTS) {
    sports[sport] = {
      table: perSport
        .filter((r) => r.sport === sport)
        .map((r) => row(r.memberId, r.points, r.exact, r.n))
        .sort(byPoints),
      results: last
        .filter((m) => m.sport === sport)
        .slice(0, input.results ?? 3)
        .map((m) => ({
          competition: m.competition,
          home: m.homeTeam,
          away: m.awayTeam,
          homeScore: m.homeScore,
          awayScore: m.awayScore,
          overtime: m.overtime,
          kickoffAt: m.kickoffAt.toISOString(),
          picks: picks
            .filter((p) => p.matchId === m.id)
            .map((p) => ({ member: names.get(p.memberId) ?? "?", home: p.home, away: p.away, overtime: p.overtime, points: p.points }))
            .sort((a, b) => (b.points ?? -1) - (a.points ?? -1) || a.member.localeCompare(b.member)),
        })),
    };
  }
  const updated = overall.map((s) => s.updatedAt.getTime()).sort((a, b) => b - a)[0];
  return {
    name: league.name,
    table: overall.map((s) => row(s.memberId, s.points, s.exact, s.predictions)).sort(byPoints),
    updatedAt: updated ? new Date(updated).toISOString() : null,
    sports,
  };
}
