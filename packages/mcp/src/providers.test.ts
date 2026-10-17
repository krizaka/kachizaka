import { applyInOrder, INITIAL_STATE } from "@kachizaka/core";
import { describe, expect, it } from "vitest";

import { fixtureSchema, nhlWeeks, parseNhlSchedule, parseOpenFootball, resultEvents, resultsFeed, seasonDir, TtlCache, zonedToUtc } from "./index";

/** A slice of the NHL's own answer for the week of 2026-10-10 (api-web.nhle.com/v1/schedule/2026-10-10), fields we read. */
const NHL = {
  gameWeek: [
    {
      date: "2026-10-10",
      games: [
        { id: 2026020075, gameType: 2, startTimeUTC: "2026-10-10T23:00:00Z", gameState: "OFF", homeTeam: { commonName: { default: "Canadiens" }, placeName: { default: "Montréal" }, abbrev: "MTL", score: 1 }, awayTeam: { commonName: { default: "Red Wings" }, placeName: { default: "Detroit" }, abbrev: "DET", score: 0 }, gameOutcome: { lastPeriodType: "SO" } },
        { id: 2026020070, gameType: 2, startTimeUTC: "2026-10-10T17:00:00Z", gameState: "OFF", homeTeam: { commonName: { default: "Bruins" }, placeName: { default: "Boston" }, abbrev: "BOS", score: 5 }, awayTeam: { commonName: { default: "Flyers" }, placeName: { default: "Philadelphia" }, abbrev: "PHI", score: 1 }, gameOutcome: { lastPeriodType: "REG" } },
        { id: 2026020099, gameType: 3, startTimeUTC: "2026-10-12T23:30:00Z", gameState: "FUT", homeTeam: { commonName: { default: "Maple Leafs" }, placeName: { default: "Toronto" }, abbrev: "TOR" }, awayTeam: { commonName: { default: "Canadiens" }, placeName: { default: "Montréal" }, abbrev: "MTL" } },
        { nonsense: true },
      ],
    },
  ],
};

/** A slice of github.com/openfootball/football.json (CC0), the Premier League 2026/27. */
const EPL = {
  name: "English Premier League 2026/27",
  matches: [
    { round: "Matchday 1", date: "2026-08-21", time: "20:00", team1: "Arsenal FC", team2: "Coventry City FC", score: { ht: [2, 0], ft: [3, 0] } },
    { round: "Matchday 1", date: "2026-01-10", time: "12:30", team1: "AFC Bournemouth", team2: "Hull City AFC", score: [0, 0] },
    { round: "Matchday 9", date: "2026-10-31", team1: "Liverpool FC", team2: "Chelsea FC" },
  ],
};

describe("the NHL adapter", () => {
  const fixtures = parseNhlSchedule(NHL);
  it("reads the games, the results and the overtime, and skips what it cannot read", () => {
    expect(fixtures).toHaveLength(3);
    expect(fixtures[0]).toMatchObject({ sport: "hockey", competition: "NHL", providerMatchId: "nhl:2026020075", homeTeam: "Montréal Canadiens", awayTeam: "Detroit Red Wings", result: { home: 1, away: 0, overtime: true } });
    expect(fixtures[1]!.result).toEqual({ home: 5, away: 1, overtime: false });
  });
  it("leaves a game to come without a result, and marks a playoff game as a final", () => {
    expect(fixtures[2]!.result).toBeUndefined();
    expect(fixtures[2]!.isFinal).toBe(true);
    expect(fixtures[0]!.isFinal).toBe(false);
  });
  it("speaks the connector's contract", () => {
    for (const f of fixtures) expect(fixtureSchema.safeParse(f).success).toBe(true);
  });
  it("asks for one week at a time", () => {
    expect(nhlWeeks("2026-10-01", "2026-10-20")).toEqual(["2026-10-01", "2026-10-08", "2026-10-15"]);
  });
});

describe("the openfootball adapter", () => {
  const fixtures = parseOpenFootball(EPL, "Premier League");
  it("reads the score in both of the file's shapes and a game still to play", () => {
    expect(fixtures.map((f) => f.result)).toEqual([{ home: 3, away: 0, overtime: false }, { home: 0, away: 0, overtime: false }, undefined]);
    expect(fixtures[0]).toMatchObject({ sport: "soccer", competition: "Premier League", homeTeam: "Arsenal", awayTeam: "Coventry City" });
  });
  it("gives each game a stable id of its own", () => {
    expect(fixtures[0]!.providerMatchId).toBe("of:premier-league:2026-08-21:arsenal-fc-coventry-city-fc");
  });
  it("puts the local kick-off in UTC, summer and winter", () => {
    expect(fixtures[0]!.kickoffAt).toBe("2026-08-21T19:00:00.000+00:00"); // 20:00 BST
    expect(fixtures[1]!.kickoffAt).toBe("2026-01-10T12:30:00.000+00:00"); // 12:30 GMT
    expect(zonedToUtc("2026-10-31", "21:00", "Europe/Paris").toISOString()).toBe("2026-10-31T20:00:00.000Z");
  });
  it("finds the season's directory: August to July", () => {
    expect([seasonDir("2026-10-17"), seasonDir("2027-03-01"), seasonDir("2026-07-01")]).toEqual(["2026-27", "2026-27", "2026-27"]);
  });
});

describe("a result is a handful of facts the pipeline already understands", () => {
  const [mtl] = parseNhlSchedule(NHL);
  it("applies in order to the final score, overtime included", () => {
    const { state } = applyInOrder(INITIAL_STATE, resultEvents(mtl!));
    expect(state).toMatchObject({ status: "final", home: 1, away: 0, overtime: true, appliedSeq: 3 });
  });
  it("is the same facts when the same result comes again, and none for a game to come", () => {
    expect(resultEvents(mtl!)).toEqual(resultEvents(mtl!));
    expect(resultEvents(parseNhlSchedule(NHL)[2]!)).toEqual([]);
  });
});

describe("the results feed", () => {
  it("asks a provider once for everyone (cached), then answers fixtures and facts through the contract", async () => {
    let asked = 0;
    const doFetch = (async (url: string) => {
      asked++;
      return Response.json(String(url).includes("nhle") ? NHL : EPL);
    }) as unknown as typeof fetch;
    const now = 0;
    const feed = resultsFeed({ fetch: doFetch, cache: new TtlCache(60_000, () => now) });
    const a = await feed.fixtures({ competition: "NHL", from: "2026-10-10", to: "2026-10-12" });
    await feed.fixtures({ competition: "NHL", from: "2026-10-10", to: "2026-10-12" });
    expect(asked).toBe(1);
    expect(a.fixtures.map((f) => f.providerMatchId)).toContain("nhl:2026020075");
    const out = await feed.events({ providerMatchId: "nhl:2026020075", afterSeq: 1 });
    expect(out.events.map((e) => e.seq)).toEqual([2, 3]);
    await expect(feed.fixtures({ competition: "NBA", from: "2026-10-10", to: "2026-10-12" })).rejects.toThrow("KZ_COMPETITION_UNKNOWN");
  });

  it("refreshes after the time to live", async () => {
    let clock = 0;
    const cache = new TtlCache<number>(1000, () => clock);
    let n = 0;
    expect(await cache.get("k", async () => ++n)).toBe(1);
    clock = 999;
    expect(await cache.get("k", async () => ++n)).toBe(1);
    clock = 1000;
    expect(await cache.get("k", async () => ++n)).toBe(2);
  });
});

describe("the fixtures sync", () => {
  const feedWith = (fixtures: ReturnType<typeof parseNhlSchedule>, fail = false) => ({
    async fixtures({ competition }: { competition: string }) {
      if (fail && competition === "Ligue 1") throw new Error("down");
      return { provider: "t", fixtures: competition === "NHL" ? fixtures : [] };
    },
    async events() {
      return { provider: "t", providerMatchId: "x", events: [] };
    },
  });

  it("stores the fixtures and closes only the games that are over and not yet closed", async () => {
    const { syncFixtures } = await import("./sync");
    const list = parseNhlSchedule(NHL);
    const ingested: string[] = [];
    const out = await syncFixtures({
      feed: feedWith(list),
      competitions: ["NHL"],
      from: "2026-10-10",
      to: "2026-10-12",
      upsert: async (fx) => fx.map((f, i) => ({ id: `m${i}`, providerMatchId: f.providerMatchId, status: i === 1 ? ("final" as const) : ("scheduled" as const) })),
      ingest: async (id) => {
        ingested.push(id);
        return { applied: 3, events: [] };
      },
    });
    expect(ingested).toEqual(["m0"]); // m1 is already final; m2 has no result yet
    expect(out).toEqual({ fixtures: 3, closed: 1, failed: [] });
  });

  it("reports a competition that fails and carries on with the others", async () => {
    const { syncFixtures } = await import("./sync");
    const out = await syncFixtures({ feed: feedWith([], true), competitions: ["Ligue 1", "NHL"], from: "2026-10-10", to: "2026-10-12", upsert: async () => [], ingest: async () => ({ applied: 0, events: [] }) });
    expect(out.failed).toEqual([{ competition: "Ligue 1", reason: "down" }]);
  });
});
