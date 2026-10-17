import { DEFAULT_BASKETBALL_RULES, DEFAULT_HOCKEY_RULES, type MatchEvent, sealOfFor } from "@kachizaka/core";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { changeRules, createLeague, currentRuleSet } from "./leagues";
import { ingest } from "./pipeline";
import { matches, members, predictions, predictionScores, ruleSets, seasons, standings } from "./schema";
import { freshDatabase, refusal } from "./test/db";

let t: Awaited<ReturnType<typeof freshDatabase>>;
beforeAll(async () => {
  t = await freshDatabase();
});
afterAll(async () => t.drop());

const at = "2026-10-17T23:00:00Z";
/** A result as a daily feed tells it: the score (and whether it went beyond regulation), then the final whistle. */
const RESULT = (home: number, away: number, overtime: boolean): MatchEvent[] => [
  { kind: "kickoff", providerEventId: "k", seq: 1, at },
  { kind: "correction", providerEventId: `r-${home}-${away}-${overtime}`, seq: 2, at, home, away, overtime },
  { kind: "final", providerEventId: "f", seq: 3, at },
];

async function league() {
  const { league, owner, ruleSets: sets } = await createLeague(t.db, { name: "La gang du vendredi", ownerId: null, ownerName: "Éric" });
  const [salma, jade] = await t.db.insert(members).values([{ leagueId: league.id, displayName: "Salma" }, { leagueId: league.id, displayName: "Jade" }]).returning();
  const [season] = await t.db.insert(seasons).values({ leagueId: league.id, label: "2026–27", competition: "Multi", startsOn: "2026-10-01", endsOn: "2027-06-30" }).returning();
  const game = async (sport: "soccer" | "hockey" | "basketball", extra: Partial<typeof matches.$inferInsert> = {}) =>
    (await t.db.insert(matches).values({ seasonId: season!.id, sport, competition: sport === "hockey" ? "NHL" : sport === "basketball" ? "NBA" : "MLS", provider: "fake", providerMatchId: crypto.randomUUID(), homeTeam: "Montréal", awayTeam: "Toronto", kickoffAt: new Date(Date.now() + 3_600_000), ...extra }).returning())[0]!;
  return { league, season: season!, owner, salma: salma!, jade: jade!, sets, game };
}

describe("one league, three sports (real PostgreSQL 16)", () => {
  it("starts with one rule set per sport, each sealed by its own recipe", async () => {
    const { sets } = await league();
    expect(sets.map((s) => s.sport).sort()).toEqual(["basketball", "hockey", "soccer"]);
    expect(sets.find((s) => s.sport === "hockey")!.seal).toBe(sealOfFor("hockey", DEFAULT_HOCKEY_RULES));
    expect(sets.find((s) => s.sport === "basketball")!.seal).toBe(sealOfFor("basketball", DEFAULT_BASKETBALL_RULES));
  });

  it("scores a hockey game: winner, goal difference and the overtime called right", async () => {
    const { owner, salma, jade, game, season } = await league();
    const m = await game("hockey");
    await t.db.insert(predictions).values([
      { matchId: m.id, memberId: owner.id, home: 4, away: 3, overtime: true },
      { matchId: m.id, memberId: salma.id, home: 5, away: 1 },
      { matchId: m.id, memberId: jade.id, home: 1, away: 2, overtime: true },
    ]);
    await ingest(t.db, m.id, RESULT(4, 3, true));
    const [row] = await t.db.select().from(matches).where(eq(matches.id, m.id));
    expect(row).toMatchObject({ status: "final", homeScore: 4, awayScore: 3, overtime: true });
    const scores = await t.db.select().from(predictionScores).where(eq(predictionScores.matchId, m.id));
    const by = (id: string) => scores.find((s) => s.memberId === id)!;
    expect(by(owner.id)).toMatchObject({ points: 5, perfect: true, breakdown: [{ rule: "winner", points: 3 }, { rule: "goalDifference", points: 1 }, { rule: "overtime", points: 1 }] });
    expect(by(salma.id)).toMatchObject({ points: 3, perfect: false });
    expect(by(jade.id)).toMatchObject({ points: 1, perfect: false, breakdown: [{ rule: "overtime", points: 1 }] });
    const table = await t.db.select().from(standings).where(eq(standings.seasonId, season.id));
    expect(table.find((r) => r.memberId === owner.id)).toMatchObject({ rank: 1, points: 5, exact: 1 });
  });

  it("scores a basketball game: the winner and the margin band", async () => {
    const { owner, salma, game } = await league();
    const m = await game("basketball");
    await t.db.insert(predictions).values([
      { matchId: m.id, memberId: owner.id, winner: "home", band: 1 },
      { matchId: m.id, memberId: salma.id, winner: "away", band: 0 },
    ]);
    await ingest(t.db, m.id, RESULT(108, 99, false));
    const scores = await t.db.select().from(predictionScores).where(eq(predictionScores.matchId, m.id));
    expect(scores.find((s) => s.memberId === owner.id)).toMatchObject({ points: 5, perfect: true });
    expect(scores.find((s) => s.memberId === salma.id)).toMatchObject({ points: 0, perfect: false });
  });

  it("seals each sport on its own: a sealed hockey change is a new hockey version, soccer is untouched", async () => {
    const { league: l, owner, game } = await league();
    const m = await game("hockey");
    await t.db.insert(predictions).values({ matchId: m.id, memberId: owner.id, home: 2, away: 1 });
    await ingest(t.db, m.id, RESULT(2, 1, false));
    const next = await changeRules(t.db, l.id, { ...DEFAULT_HOCKEY_RULES, winner: 4 }, "hockey");
    expect(next.version).toBe(2);
    expect((await currentRuleSet(t.db, l.id, "soccer"))!.version).toBe(1);
    const [hockey1] = await t.db.select().from(ruleSets).where(eq(ruleSets.id, (await t.db.select().from(matches).where(eq(matches.id, m.id)))[0]!.ruleSetId!));
    expect(hockey1).toMatchObject({ sport: "hockey", version: 1 });
    expect(hockey1!.sealedAt).not.toBeNull();
  });

  it("refuses, by the database itself, a pick of the wrong shape", async () => {
    const { owner, game } = await league();
    const soccer = await game("soccer");
    const hockey = await game("hockey");
    const basket = await game("basketball");
    expect(await refusal(t.db.insert(predictions).values({ matchId: soccer.id, memberId: owner.id, home: 1, away: 0, overtime: true }))).toContain("KZ_PICK_SHAPE");
    expect(await refusal(t.db.insert(predictions).values({ matchId: soccer.id, memberId: owner.id, winner: "home", band: 1 }))).toContain("KZ_PICK_SHAPE");
    expect(await refusal(t.db.insert(predictions).values({ matchId: hockey.id, memberId: owner.id, home: 2, away: 2 }))).toContain("KZ_PICK_SHAPE");
    expect(await refusal(t.db.insert(predictions).values({ matchId: basket.id, memberId: owner.id, winner: "home" }))).toContain("KZ_PICK_SHAPE");
    expect(await refusal(t.db.insert(predictions).values({ matchId: basket.id, memberId: owner.id, home: 100, away: 90 }))).toContain("KZ_PICK_SHAPE");
  });

  it("refuses a match that starts under another sport's rules", async () => {
    const { sets, game } = await league();
    const hockey = await game("hockey");
    const soccerRules = sets.find((s) => s.sport === "soccer")!;
    await t.db.update(ruleSets).set({ sealedAt: new Date() }).where(eq(ruleSets.id, soccerRules.id));
    expect(await refusal(t.db.update(matches).set({ status: "live", ruleSetId: soccerRules.id, ruleSetSeal: soccerRules.seal }).where(eq(matches.id, hockey.id)))).toContain("KZ_MATCH_WRONG_SPORT");
  });
});

describe("fixtures stored for a season (real PostgreSQL 16)", () => {
  const fx = (id: string, kickoffAt: string) => ({ sport: "hockey" as const, competition: "NHL", providerMatchId: id, homeTeam: "Montréal Canadiens", awayTeam: "Detroit Red Wings", kickoffAt, isFinal: false });

  it("inserts once, follows a rescheduled kick-off while the game is scheduled, and never touches a started game", async () => {
    const { upsertFixtures } = await import("./fixtures");
    const { season, owner } = await league();
    const a = await upsertFixtures(t.db, season.id, "results", [fx("nhl:1", "2027-01-05T00:00:00Z")]);
    expect(a).toHaveLength(1);
    expect(await upsertFixtures(t.db, season.id, "results", [fx("nhl:1", "2027-01-05T00:00:00Z")])).toEqual(a);
    await upsertFixtures(t.db, season.id, "results", [fx("nhl:1", "2027-01-05T01:00:00Z")]);
    const [m] = await t.db.select().from(matches).where(eq(matches.id, a[0]!.id));
    expect(m).toMatchObject({ sport: "hockey", competition: "NHL" });
    expect(m!.kickoffAt.toISOString()).toBe("2027-01-05T01:00:00.000Z");
    await t.db.insert(predictions).values({ matchId: m!.id, memberId: owner.id, home: 2, away: 1 });
    await ingest(t.db, m!.id, RESULT(2, 1, false));
    await upsertFixtures(t.db, season.id, "results", [fx("nhl:1", "2027-02-01T00:00:00Z")]);
    const [after] = await t.db.select().from(matches).where(eq(matches.id, m!.id));
    expect(after!.kickoffAt.toISOString()).toBe("2027-01-05T01:00:00.000Z");
  });

  it("lets two leagues follow the same game, each on its own rows", async () => {
    const { upsertFixtures } = await import("./fixtures");
    const one = await league();
    const two = await league();
    const [a] = await upsertFixtures(t.db, one.season.id, "results", [fx("nhl:77", "2027-01-05T00:00:00Z")]);
    const [b] = await upsertFixtures(t.db, two.season.id, "results", [fx("nhl:77", "2027-01-05T00:00:00Z")]);
    expect(a!.id).not.toBe(b!.id);
  });
});
