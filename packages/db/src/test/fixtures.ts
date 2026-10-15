import { randomUUID } from "node:crypto";

import type { MatchEvent } from "@kachizaka/core";

import type { Db } from "../client";
import { createLeague } from "../leagues";
import { matches, members, predictions, seasons } from "../schema";

/** A league of three friends, one season, one match an hour from now, and their three predictions. */
export async function leagueWithMatch(db: Db, opts: { isFinal?: boolean } = {}) {
  const { league, owner, ruleSet } = await createLeague(db, { name: "Les Habitués", ownerId: null, ownerName: "Amina" });
  const [bruno, chloe] = await db
    .insert(members)
    .values([
      { leagueId: league.id, displayName: "Bruno" },
      { leagueId: league.id, displayName: "Chloé" },
    ])
    .returning();
  const [season] = await db.insert(seasons).values({ leagueId: league.id, label: "2026–27", competition: "NHL", startsOn: "2026-10-01", endsOn: "2027-04-30" }).returning();
  const [match] = await db
    .insert(matches)
    .values({ seasonId: season!.id, provider: "fake", providerMatchId: `MTL-TOR-${randomUUID()}`, homeTeam: "Montréal", awayTeam: "Toronto", kickoffAt: new Date(Date.now() + 3_600_000), isFinal: opts.isFinal ?? false })
    .returning();
  await db.insert(predictions).values([
    { matchId: match!.id, memberId: owner.id, home: 2, away: 1 },
    { matchId: match!.id, memberId: bruno!.id, home: 3, away: 2 },
    { matchId: match!.id, memberId: chloe!.id, home: 0, away: 1 },
  ]);
  return { league, season: season!, match: match!, ruleSet, members: { amina: owner, bruno: bruno!, chloe: chloe! } };
}

const at = "2026-10-15T23:00:00Z";
/** Montréal 2 – 1 Toronto, as a feed tells it. */
export const GAME: MatchEvent[] = [
  { kind: "kickoff", providerEventId: "e1", seq: 1, at },
  { kind: "goal", providerEventId: "e2", seq: 2, at, side: "home", minute: 8 },
  { kind: "goal", providerEventId: "e3", seq: 3, at, side: "away", minute: 31 },
  { kind: "goal", providerEventId: "e4", seq: 4, at, side: "home", minute: 52 },
  { kind: "final", providerEventId: "e5", seq: 5, at },
];
