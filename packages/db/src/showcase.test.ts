import type { Fixture, SportsFeed } from "@kachizaka/mcp";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createLeagueWithSeason, joinWithInvite, createInvite } from "./play";
import { accounts, matches, members, predictions } from "./schema";
import { showcaseLeague } from "./showcase";
import { runSync } from "./sync";
import { hoursFrom, kickoffAfter } from "./test/clock";
import { freshDatabase } from "./test/db";

/** The game kicks off tomorrow evening by the real clock (the database locks predictions with its own `now()`). */
const KICKOFF = kickoffAfter(new Date());

let t: Awaited<ReturnType<typeof freshDatabase>>;
beforeAll(async () => {
  t = await freshDatabase();
});
afterAll(async () => t.drop());

const fixture = (id: string, home: string, away: string, result?: Fixture["result"]): Fixture => ({ sport: "hockey", competition: "NHL", providerMatchId: id, homeTeam: home, awayTeam: away, kickoffAt: KICKOFF.toISOString(), isFinal: false, ...(result ? { result } : {}) });
const feedOf = (list: () => Fixture[]): SportsFeed => ({
  async fixtures() {
    return { provider: "t", fixtures: list() };
  },
  async events({ providerMatchId }) {
    return { provider: "t", providerMatchId, events: [] };
  },
});

describe("the league the public landing shows", () => {
  it("is the persona league's real table and last results, with each friend's pick and points", async () => {
    const [eric, salma] = await t.db
      .insert(accounts)
      .values([{ email: "eric@personas.kachizaka.test", locale: "fr" }, { email: "salma@personas.kachizaka.test", locale: "fr" }])
      .returning();
    const { league } = await createLeagueWithSeason(t.db, { name: "La gang du vendredi", ownerId: eric!.id, ownerName: "Éric", competitions: ["NHL"], now: hoursFrom(KICKOFF, -24 * 19 - 11) });
    const [ericMember] = await t.db.select().from(members).where(eq(members.leagueId, league.id));
    const invite = await createInvite(t.db, { leagueId: league.id, memberId: ericMember!.id, now: hoursFrom(KICKOFF, -24 * 19 - 11) });
    await joinWithInvite(t.db, { token: invite.token, accountId: salma!.id, displayName: "Salma", now: hoursFrom(KICKOFF, -24 * 19 - 10) });

    let games = [fixture("nhl:1", "Montréal Canadiens", "Toronto Maple Leafs"), fixture("nhl:2", "Boston Bruins", "Detroit Red Wings")];
    const feed = feedOf(() => games);
    await runSync(t.db, { feed, now: hoursFrom(KICKOFF, -11) });
    const rows = await t.db.select().from(matches).orderBy(matches.providerMatchId);
    const all = await t.db.select().from(members).where(eq(members.leagueId, league.id));
    const id = (name: string) => all.find((m) => m.displayName === name)!.id;
    await t.db.insert(predictions).values([
      { matchId: rows[0]!.id, memberId: id("Éric"), home: 4, away: 3, overtime: true },
      { matchId: rows[0]!.id, memberId: id("Salma"), home: 1, away: 2 },
      { matchId: rows[1]!.id, memberId: id("Salma"), home: 3, away: 1 },
    ]);

    games = [fixture("nhl:1", "Montréal Canadiens", "Toronto Maple Leafs", { home: 4, away: 3, overtime: true }), fixture("nhl:2", "Boston Bruins", "Detroit Red Wings", { home: 3, away: 1, overtime: false })];
    await runSync(t.db, { feed, now: hoursFrom(KICKOFF, 9) });

    const view = await showcaseLeague(t.db, { name: "La gang du vendredi" });
    expect(view).not.toBeNull();
    expect(view!.table.map((r) => [r.member, r.points])).toEqual([["Éric", 5], ["Salma", 4]]); // Salma: Boston 3–1 exact = winner 3 + goal difference 1; her Montréal pick was wrong
    expect(view!.sports.hockey.table[0]).toMatchObject({ points: 5 });
    expect(view!.sports.hockey.results).toHaveLength(2);
    const montreal = view!.sports.hockey.results.find((r) => r.home === "Montréal Canadiens")!;
    expect(montreal).toMatchObject({ homeScore: 4, awayScore: 3, overtime: true, competition: "NHL" });
    expect(montreal.picks).toEqual([
      { member: "Éric", home: 4, away: 3, overtime: true, points: 5 },
      { member: "Salma", home: 1, away: 2, overtime: false, points: 0 },
    ]);
    expect(view!.sports.soccer.results).toEqual([]);
    expect(view!.updatedAt).not.toBeNull();
  });

  it("never shows a league owned by a real person, nor one that does not exist", async () => {
    const [real] = await t.db.insert(accounts).values({ email: "someone@example.com", locale: "en" }).returning();
    await createLeagueWithSeason(t.db, { name: "Les vrais amis", ownerId: real!.id, ownerName: "Someone", competitions: ["NHL"], now: hoursFrom(KICKOFF, -24 * 19 - 11) });
    expect(await showcaseLeague(t.db, { name: "Les vrais amis" })).toBeNull();
    expect(await showcaseLeague(t.db, { name: "Nobody's league" })).toBeNull();
  });
});
