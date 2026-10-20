import type { ShowcaseLeague } from "@kachizaka/db";
import { describe, expect, it } from "vitest";

import { buildLeagueData } from "./league-view";

const LIVE: ShowcaseLeague = {
  name: "La gang du vendredi",
  updatedAt: "2026-10-20T03:00:25.000Z",
  table: [
    { member: "Salma", points: 50, exact: 3, predictions: 26 },
    { member: "Éric", points: 43, exact: 4, predictions: 26 },
  ],
  sports: {
    soccer: { table: [{ member: "Salma", points: 20, exact: 1, predictions: 10 }, { member: "Éric", points: 11, exact: 0, predictions: 10 }], results: [{ competition: "Ligue 1", home: "Lille", away: "Brest", homeScore: 1, awayScore: 1, overtime: false, kickoffAt: "2026-10-17T18:45:00.000Z", picks: [{ member: "Salma", home: 1, away: 1, overtime: false, points: 8 }] }] },
    hockey: { table: [{ member: "Éric", points: 32, exact: 4, predictions: 16 }], results: [{ competition: "NHL", home: "Montréal Canadiens", away: "Detroit Red Wings", homeScore: 2, awayScore: 1, overtime: true, kickoffAt: "2026-10-18T23:00:00.000Z", picks: [{ member: "Éric", home: 2, away: 1, overtime: true, points: 5 }] }] },
    basketball: { table: [], results: [] },
  },
};

describe("what the hero's league shows", () => {
  it("is the live league's table per sport and its last results, with the points the scorer gave", () => {
    const d = buildLeagueData(LIVE, "en");
    expect(d.source).toBe("league");
    expect(d.sports.map((s) => s.sport)).toEqual(["soccer", "hockey", "basketball"]);
    expect(d.sports[0]!.table).toEqual([{ member: "Salma", pts: "20 pts" }, { member: "Éric", pts: "11 pts" }]);
    expect(d.sports[0]!.results[0]).toMatchObject({ title: "Lille 1 – 1 Brest", picks: [{ member: "Salma", pick: "1–1", pts: "8 pts" }] });
    expect(d.sports[1]!.results[0]).toMatchObject({ title: "Montréal Canadiens 2 – 1 Detroit Red Wings", overtime: true, picks: [{ member: "Éric", pick: "2–1 · OT", pts: "5 pts" }] });
    expect(d.friends).toBe(2);
    expect(d.sportsLive).toBe(2);
    expect(d.picksScored).toBe(52);
    expect(d.updated).toMatch(/^Table updated /);
  });

  it("says basketball is in preparation: no table points, no result, no seal", () => {
    const b = buildLeagueData(LIVE, "fr").sports[2]!;
    expect(b.ready).toBe(false);
    expect(b.results).toEqual([]);
    expect(b.table.every((r) => r.pts === null)).toBe(true);
    expect(b.seal).toBeNull();
  });

  it("speaks French, with « Prol. » for the overtime and the French update line", () => {
    const d = buildLeagueData(LIVE, "fr");
    expect(d.sports[1]!.results[0]!.picks[0]!.pick).toBe("2–1 · Prol.");
    expect(d.updated).toMatch(/^Classement mis à jour /);
  });

  it("falls back to the example, said so, when the league cannot be read", () => {
    const d = buildLeagueData(null, "en");
    expect(d.source).toBe("example");
    expect(d.updated).toBeNull();
    expect(d.sportsLive).toBe(2);
    expect(d.picksScored).toBe(0);
    expect(d.sports[2]!.table.every((r) => r.pts === null)).toBe(true);
  });
});
