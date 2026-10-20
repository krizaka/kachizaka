import { describe, expect, it } from "vitest";

import { espnResultsFor, parseEspnScoreboard, resultsFeed, sameTeam, TtlCache } from "./index";

/** A slice of the scoreboard answer of the day (fields we read). */
const board = (events: { date: string; state?: string; home: string; away: string; hs: string; as: string }[]) => ({
  events: events.map((e) => ({
    date: e.date,
    status: { type: { name: e.state ?? "STATUS_FULL_TIME" } },
    competitions: [{ competitors: [{ homeAway: "home", score: e.hs, team: { displayName: e.home } }, { homeAway: "away", score: e.as, team: { displayName: e.away } }] }],
  })),
});

const OF_FIXTURE = (id: string, homeTeam: string, awayTeam: string, kickoffAt: string) => ({ sport: "soccer" as const, competition: "Ligue 1", providerMatchId: id, homeTeam, awayTeam, kickoffAt, isFinal: false });

describe("the second source of soccer results (openfootball stopped updating on 2026-09-20)", () => {
  it("reads only the games that are over", () => {
    const games = parseEspnScoreboard(board([{ date: "2026-10-17T18:45Z", home: "Lille", away: "Brest", hs: "1", as: "1" }, { date: "2026-10-17T20:00Z", state: "STATUS_IN_PROGRESS", home: "A", away: "B", hs: "0", as: "0" }]));
    expect(games).toEqual([{ at: "2026-10-17T18:45:00.000+00:00", home: "Lille", away: "Brest", homeScore: 1, awayScore: 1 }]);
  });

  it("recognises a team under the two spellings of the two sources", () => {
    expect(sameTeam("Strasbourg", "RC Strasbourg Alsace")).toBe(true);
    expect(sameTeam("Paris Saint-Germain", "Paris Saint-Germain")).toBe(true);
    expect(sameTeam("Marseille", "Olympique de Marseille")).toBe(true);
    expect(sameTeam("Lille", "Lille OSC")).toBe(true);
    expect(sameTeam("Paris FC", "Paris Saint-Germain")).toBe(false);
    expect(sameTeam("Nice", "Nottingham Forest")).toBe(false);
  });

  it("fills the result of a game that has none, by the kick-off and the teams, and leaves the others alone", () => {
    const games = parseEspnScoreboard(
      board([
        { date: "2026-10-17T18:45Z", home: "Lille", away: "Brest", hs: "1", as: "1" },
        { date: "2026-10-17T18:45Z", home: "Troyes", away: "Lens", hs: "1", as: "3" },
        { date: "2026-10-18T15:15Z", home: "Paris FC", away: "Stade Rennais", hs: "4", as: "3" },
      ]),
    );
    const fixtures = [
      OF_FIXTURE("a", "Lille OSC", "Stade Brestois 29", "2026-10-17T18:45:00.000+00:00"),
      OF_FIXTURE("b", "ES Troyes AC", "Racing Club de Lens", "2026-10-17T18:45:00.000+00:00"),
      OF_FIXTURE("c", "Paris FC", "Stade Rennais FC 1901", "2026-10-18T15:15:00.000+00:00"),
      { ...OF_FIXTURE("d", "Lyon", "Nice", "2026-10-19T18:45:00.000+00:00"), result: { home: 9, away: 9, overtime: false } },
      OF_FIXTURE("e", "Monaco", "Nantes", "2026-10-25T18:45:00.000+00:00"),
    ];
    const out = espnResultsFor(fixtures, games);
    expect(out.map((f) => f.result)).toEqual([{ home: 1, away: 1, overtime: false }, { home: 1, away: 3, overtime: false }, { home: 4, away: 3, overtime: false }, { home: 9, away: 9, overtime: false }, undefined]);
  });

  it("does not guess when two games fit as well", () => {
    const games = parseEspnScoreboard(board([{ date: "2026-10-17T18:45Z", home: "Paris", away: "Lyon", hs: "2", as: "0" }, { date: "2026-10-17T18:45Z", home: "Paris", away: "Lyon", hs: "0", as: "2" }]));
    const out = espnResultsFor([OF_FIXTURE("a", "Paris FC", "Olympique Lyonnais", "2026-10-17T18:45:00.000+00:00")], games);
    expect(out[0]!.result).toBeUndefined();
  });

  it("is used by the results feed for the games already played, one request per day, cached", async () => {
    const asked: string[] = [];
    const doFetch = (async (url: string) => {
      asked.push(String(url));
      if (String(url).includes("raw.githubusercontent")) return Response.json({ matches: [{ date: "2026-10-17", time: "20:45", team1: "Lille OSC", team2: "Stade Brestois 29" }, { date: "2026-10-30", time: "20:45", team1: "Lyon", team2: "Nice" }] });
      return Response.json(board([{ date: "2026-10-17T18:45Z", home: "Lille", away: "Brest", hs: "1", as: "1" }]));
    }) as unknown as typeof fetch;
    const feed = resultsFeed({ fetch: doFetch, cache: new TtlCache(60_000, () => 0), now: () => Date.parse("2026-10-19T12:00:00Z"), unlicensed: true });
    const { fixtures } = await feed.fixtures({ competition: "Ligue 1", from: "2026-10-16", to: "2026-11-01" });
    expect(fixtures.map((f) => f.result)).toEqual([{ home: 1, away: 1, overtime: false }, undefined]);
    expect(asked.filter((u) => u.includes("espn")).map((u) => u.slice(-8))).toEqual(["20261017", "20261018"]);
  });

  it("is dev only: without the explicit opt-in (production) the provider is never called and the games stay « to play »", async () => {
    const asked: string[] = [];
    const doFetch = (async (url: string) => {
      asked.push(String(url));
      return Response.json({ matches: [{ date: "2026-10-17", time: "20:45", team1: "Lille OSC", team2: "Stade Brestois 29" }] });
    }) as unknown as typeof fetch;
    const feed = resultsFeed({ fetch: doFetch, cache: new TtlCache(60_000, () => 0), now: () => Date.parse("2026-10-19T12:00:00Z") });
    const { fixtures } = await feed.fixtures({ competition: "Ligue 1", from: "2026-10-16", to: "2026-11-01" });
    expect(fixtures[0]!.result).toBeUndefined();
    expect(asked.some((u) => u.includes("espn"))).toBe(false);
  });
});
