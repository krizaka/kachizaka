import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { ingest } from "./pipeline";
import { matches, matchEvents, predictionScores, standings } from "./schema";
import { freshDatabase, refusal } from "./test/db";
import { GAME, leagueWithMatch } from "./test/fixtures";

let t: Awaited<ReturnType<typeof freshDatabase>>;
beforeAll(async () => {
  t = await freshDatabase();
});
afterAll(async () => t.drop());

const table = async (seasonId: string) =>
  (await t.db.select().from(standings).where(eq(standings.seasonId, seasonId))).map((r) => [r.memberId, r.rank, r.points, r.exact]).sort((a, b) => Number(a[1]) - Number(b[1]) || String(a[0]).localeCompare(String(b[0])));

describe("the live pipeline (real PostgreSQL 16)", () => {
  it("applies facts in order whatever order they arrive in, and once whatever how often", async () => {
    const { match, season, members } = await leagueWithMatch(t.db);
    // Out of order, with a gap: only the kick-off applies; the rest waits for fact 2.
    expect((await ingest(t.db, match.id, [GAME[3]!, GAME[0]!, GAME[2]!])).applied).toBe(1);
    // The missing fact arrives with a duplicate: 2, 3, 4 apply.
    expect((await ingest(t.db, match.id, [GAME[1]!, GAME[1]!])).applied).toBe(3);
    // The final whistle, delivered twice in two deliveries: applied once.
    expect((await ingest(t.db, match.id, [GAME[4]!])).applied).toBe(1);
    expect((await ingest(t.db, match.id, GAME)).applied).toBe(0);
    const [m] = await t.db.select().from(matches).where(eq(matches.id, match.id));
    expect(m).toMatchObject({ status: "final", homeScore: 2, awayScore: 1, appliedSeq: 5 });
    expect(await t.db.select().from(matchEvents).where(eq(matchEvents.matchId, match.id))).toHaveLength(5);
    // Amina 2–1 exact (5), Bruno 3–2 outcome + difference (3), Chloé 0–1 wrong (0).
    expect(await table(season.id)).toEqual([
      [members.amina.id, 1, 5, 1],
      [members.bruno.id, 2, 3, 0],
      [members.chloe.id, 3, 0, 0],
    ]);
  });

  it("keeps every point's breakdown and the seal it was scored with; final scores are no longer provisional", async () => {
    const { match, members, ruleSet } = await leagueWithMatch(t.db);
    await ingest(t.db, match.id, GAME.slice(0, 2));
    const live = await t.db.select().from(predictionScores).where(eq(predictionScores.matchId, match.id));
    expect(live.every((s) => s.provisional)).toBe(true);
    await ingest(t.db, match.id, GAME.slice(2));
    const [bruno] = await t.db.select().from(predictionScores).where(eq(predictionScores.memberId, members.bruno.id));
    expect(bruno).toMatchObject({ points: 3, provisional: false, ruleSetSeal: ruleSet.seal, breakdown: [{ rule: "outcome", points: 2 }, { rule: "goalDifference", points: 1 }] });
  });

  it("recomputes the same table from the same facts, delivered fact by fact or all at once (deterministic)", async () => {
    const a = await leagueWithMatch(t.db);
    const b = await leagueWithMatch(t.db);
    for (const fact of [...GAME].reverse()) await ingest(t.db, a.match.id, [fact]);
    for (const fact of GAME) await ingest(t.db, a.match.id, [fact]);
    await ingest(t.db, b.match.id, GAME);
    const strip = (rows: (string | number)[][], ids: Record<string, { id: string }>) => {
      const names = Object.fromEntries(Object.entries(ids).map(([n, m]) => [m.id, n]));
      return rows.map(([id, ...rest]) => [names[String(id)], ...rest]);
    };
    expect(strip(await table(a.season.id), a.members)).toEqual(strip(await table(b.season.id), b.members));
  });

  it("doubles a final's points, on a line of its own", async () => {
    const { match, members } = await leagueWithMatch(t.db, { isFinal: true });
    await ingest(t.db, match.id, GAME);
    const [amina] = await t.db.select().from(predictionScores).where(eq(predictionScores.memberId, members.amina.id));
    expect(amina!.points).toBe(10);
    expect(amina!.breakdown).toEqual([{ rule: "exactScore", points: 5 }, { rule: "finalMultiplier", points: 5 }]);
  });

  it("broadcasts the match and a new standings version after each applied delivery — nothing for a repeat", async () => {
    const { match, league, season } = await leagueWithMatch(t.db);
    const first = await ingest(t.db, match.id, GAME.slice(0, 2));
    expect(first.events).toEqual([
      { type: "match", matchId: match.id, status: "live", home: 1, away: 0, seq: 2 },
      { type: "standings", leagueId: league.id, seasonId: season.id, version: 1 },
    ]);
    expect((await ingest(t.db, match.id, GAME.slice(0, 2))).events).toEqual([]);
    expect((await ingest(t.db, match.id, GAME.slice(2))).events.at(-1)).toMatchObject({ type: "standings", version: 2 });
  });

  it("writes a fact once: the database refuses to rewrite it", async () => {
    const { match } = await leagueWithMatch(t.db);
    await ingest(t.db, match.id, GAME.slice(0, 1));
    expect(await refusal(t.db.update(matchEvents).set({ seq: 9 }).where(eq(matchEvents.matchId, match.id)))).toMatch(/KZ_EVENT_IMMUTABLE/);
  });

  it("refuses a malformed fact before it touches the database", async () => {
    const { match } = await leagueWithMatch(t.db);
    expect(await refusal(ingest(t.db, match.id, [{ kind: "goal", providerEventId: "x", seq: 0, at: "", side: "home" }]))).toMatch(/seq|too_small|>=1/i);
  });
});
