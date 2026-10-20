import type { Fixture, SportsFeed } from "@kachizaka/mcp";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createLeagueWithSeason } from "./play";
import { accounts, matches, members, predictions, predictionScores, standings } from "./schema";
import { runSync } from "./sync";
import { freshDatabase } from "./test/db";

let t: Awaited<ReturnType<typeof freshDatabase>>;
beforeAll(async () => {
  t = await freshDatabase();
});
afterAll(async () => t.drop());

const feedOf = (list: () => Fixture[]): SportsFeed => ({
  async fixtures() {
    return { provider: "t", fixtures: list() };
  },
  async events({ providerMatchId }) {
    return { provider: "t", providerMatchId, events: [] };
  },
});
const game = (kickoffAt: string, result?: Fixture["result"]): Fixture => ({ sport: "hockey", competition: "NHL", providerMatchId: "nhl:1", homeTeam: "Montréal Canadiens", awayTeam: "Toronto Maple Leafs", kickoffAt, isFinal: false, ...(result ? { result } : {}) });

describe("the results sync — what keeps the league's table live", () => {
  it("stores the fixtures of every open season, scores the picks of a game once its result is in, and a second pass changes nothing", async () => {
    const [owner] = await t.db.insert(accounts).values({ email: "eric@personas.kachizaka.test", locale: "fr" }).returning();
    const { league } = await createLeagueWithSeason(t.db, { name: "La gang du vendredi", ownerId: owner!.id, ownerName: "Éric", competitions: ["NHL"], now: new Date("2026-10-01T12:00:00Z") });
    let fixture = game("2026-10-20T23:00:00+00:00");
    const feed = feedOf(() => [fixture]);

    const first = await runSync(t.db, { feed, now: new Date("2026-10-20T12:00:00Z"), back: 3, ahead: 14 });
    expect(first).toMatchObject({ seasons: 1, fixtures: 1, closed: 0, failed: [] });

    const [m] = await t.db.select().from(matches);
    const [member] = await t.db.select().from(members).where(eq(members.leagueId, league.id));
    await t.db.insert(predictions).values({ matchId: m!.id, memberId: member!.id, home: 4, away: 3, overtime: true });

    fixture = game("2026-10-20T23:00:00+00:00", { home: 4, away: 3, overtime: true });
    const second = await runSync(t.db, { feed, now: new Date("2026-10-21T08:00:00Z"), back: 3, ahead: 14 });
    expect(second).toMatchObject({ fixtures: 1, closed: 1, failed: [] });

    const [scored] = await t.db.select().from(predictionScores);
    expect(scored!.points).toBe(5); // winner 3 + goal difference 1 + overtime 1
    const [row] = await t.db.select().from(standings);
    expect(row).toMatchObject({ points: 5, predictions: 1 });

    const third = await runSync(t.db, { feed, now: new Date("2026-10-21T09:00:00Z"), back: 3, ahead: 14 });
    expect(third.closed).toBe(0);
  });

  it("reports a competition the feed cannot answer instead of stopping", async () => {
    const failing: SportsFeed = {
      async fixtures() {
        throw new Error("down");
      },
      async events({ providerMatchId }) {
        return { provider: "t", providerMatchId, events: [] };
      },
    };
    const out = await runSync(t.db, { feed: failing, now: new Date("2026-10-21T09:00:00Z") });
    expect(out.failed[0]).toMatchObject({ reason: "down" });
  });
});
