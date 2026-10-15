import type { MatchEvent } from "@kachizaka/core";
import { eq } from "drizzle-orm";

import type { Db } from "./client";
import { createLeague } from "./leagues";
import { ingest } from "./pipeline";
import { accounts, matches, members, predictions, seasons } from "./schema";

const at = (minutesFromNow: number) => new Date(Date.now() + minutesFromNow * 60_000);
type Fact = { kind: "kickoff" } | { kind: "final" } | { kind: "goal"; side: "home" | "away" };
const fact = (seq: number, e: Fact): MatchEvent => ({ ...e, seq, providerEventId: `seed-${seq}`, at: new Date().toISOString() });

/**
 * A demo league for a development database (never a shared or production one): the QA member's league with three friends,
 * a finished match, one being played and one to come — the facts applied by the real pipeline, so the page shows the
 * sealed rules, real scores and a real table. Idempotent per account: a league already there is returned as is.
 */
export async function seedDemoLeague(db: Db, ownerEmail: string) {
  const [owner] = await db.select().from(accounts).where(eq(accounts.email, ownerEmail.toLowerCase()));
  if (!owner) throw new Error(`no account ${ownerEmail}: run the QA accounts script first`);
  const [existing] = await db.select().from(members).where(eq(members.accountId, owner.id));
  if (existing) return { leagueId: existing.leagueId, created: false };
  const { league, owner: me } = await createLeague(db, { name: "Les Habitués", ownerId: owner.id, ownerName: owner.email.split("@")[0]! });
  const friends = await db.insert(members).values(["Amina", "Bruno", "Chloé"].map((displayName) => ({ leagueId: league.id, displayName }))).returning();
  const [season] = await db.insert(seasons).values({ leagueId: league.id, label: "2026–27", competition: "NHL", startsOn: "2026-10-01", endsOn: "2027-04-30" }).returning();
  const games = await db
    .insert(matches)
    .values([
      { seasonId: season!.id, provider: "seed", providerMatchId: `${league.id}-1`, homeTeam: "Montréal", awayTeam: "Toronto", kickoffAt: at(5) },
      { seasonId: season!.id, provider: "seed", providerMatchId: `${league.id}-2`, homeTeam: "Ottawa", awayTeam: "Boston", kickoffAt: at(6) },
      { seasonId: season!.id, provider: "seed", providerMatchId: `${league.id}-3`, homeTeam: "Québec", awayTeam: "Montréal", kickoffAt: at(60 * 24 * 3), isFinal: true },
    ])
    .returning();
  const guesses: [number, number][][] = [
    [[2, 1], [3, 2], [1, 1], [0, 2]],
    [[1, 0], [2, 2], [3, 1], [1, 2]],
    [[2, 2], [1, 3], [2, 0], [4, 1]],
  ];
  const everyone = [me, ...friends];
  for (const [g, game] of games.entries()) {
    await db.insert(predictions).values(everyone.map((m, i) => ({ matchId: game.id, memberId: m.id, home: guesses[g]![i]![0], away: guesses[g]![i]![1] })));
  }
  // Match 1 is over (2–1), match 2 is being played (1–1) — through the real pipeline, so the rules are sealed for real.
  await ingest(db, games[0]!.id, [fact(1, { kind: "kickoff" }), fact(2, { kind: "goal", side: "home" }), fact(3, { kind: "goal", side: "away" }), fact(4, { kind: "goal", side: "home" }), fact(5, { kind: "final" })]);
  await ingest(db, games[1]!.id, [fact(1, { kind: "kickoff" }), fact(2, { kind: "goal", side: "away" }), fact(3, { kind: "goal", side: "home" })]);
  return { leagueId: league.id, created: true };
}
