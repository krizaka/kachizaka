import { describe, expect, it } from "vitest";

import { DEFAULT_RULES } from "./rules";
import { DEFAULT_BASKETBALL_RULES, DEFAULT_HOCKEY_RULES, bandOf, defaultRulesFor, parseRulesFor, scoreFor, sealOfFor, SPORT_IDS } from "./sports";

const rules = DEFAULT_HOCKEY_RULES; // winner 3, goal difference 1, overtime 1, playoffs ×2

describe("hockey: the winner, the goal difference, the overtime", () => {
  const h = (home: number, away: number, overtime = false) => ({ home, away, overtime });
  it.each([
    ["everything right, in regulation", h(4, 2), h(4, 2), 4, ["winner", "goalDifference"], true],
    ["everything right, overtime called", h(3, 2, true), h(3, 2, true), 5, ["winner", "goalDifference", "overtime"], true],
    ["the winner only", h(5, 1), h(3, 2), 3, ["winner"], false],
    ["overtime called, the winner wrong", h(2, 3, true), h(3, 2, true), 1, ["overtime"], false],
    ["overtime not called, it happened", h(3, 2), h(3, 2, true), 4, ["winner", "goalDifference"], false],
    ["nothing right", h(1, 2), h(3, 2), 0, [], false],
  ] as const)("%s", (_, pick, actual, points, used, perfect) => {
    const s = scoreFor("hockey", rules, pick, actual);
    expect(s.points).toBe(points);
    expect(s.breakdown.map((l) => l.rule)).toEqual(used);
    expect(s.perfect).toBe(perfect);
    expect(s.breakdown.reduce((n, l) => n + l.points, 0)).toBe(s.points);
  });

  it("multiplies a playoff game, on a line of its own", () => {
    const s = scoreFor("hockey", rules, h(4, 2), h(4, 2), { final: true });
    expect(s.points).toBe(8);
    expect(s.breakdown.at(-1)).toEqual({ rule: "playoffMultiplier", points: 4 });
  });

  it("refuses a tie: hockey always has a winner", () => {
    expect(() => scoreFor("hockey", rules, h(2, 2), h(3, 2))).toThrow(RangeError);
    expect(() => scoreFor("hockey", rules, h(3, 2), h(2, 2))).toThrow(RangeError);
  });
});

describe("basketball: the winner and the margin band", () => {
  const b = (winner: "home" | "away", band: number) => ({ winner, band });
  it("cuts the margin by the league's bands (5, 10, 15 → 0…3)", () => {
    expect([1, 5, 6, 10, 11, 15, 16, 40].map((m) => bandOf([5, 10, 15], m))).toEqual([0, 0, 1, 1, 2, 2, 3, 3]);
  });

  it.each([
    ["winner and band", b("home", 1), { home: 108, away: 99 }, 5, ["winner", "marginBand"], true],
    ["the winner, the wrong band", b("home", 3), { home: 108, away: 99 }, 3, ["winner"], false],
    ["the wrong winner earns nothing, even with the band", b("away", 1), { home: 108, away: 99 }, 0, [], false],
  ] as const)("%s", (_, pick, actual, points, used, perfect) => {
    const s = scoreFor("basketball", DEFAULT_BASKETBALL_RULES, pick, actual);
    expect([s.points, s.breakdown.map((l) => l.rule), s.perfect]).toEqual([points, used, perfect]);
  });

  it("refuses a tie and a band outside the rules", () => {
    expect(() => scoreFor("basketball", DEFAULT_BASKETBALL_RULES, b("home", 1), { home: 100, away: 100 })).toThrow(RangeError);
    expect(() => scoreFor("basketball", DEFAULT_BASKETBALL_RULES, b("home", 9), { home: 101, away: 100 })).toThrow(RangeError);
  });
});

describe("soccer keeps its scorer, and every sport seals the same way", () => {
  it("scores soccer through the same entry point", () => {
    const s = scoreFor("soccer", DEFAULT_RULES, { home: 2, away: 1 }, { home: 2, away: 1 });
    expect(s).toMatchObject({ points: 5, perfect: true });
  });

  it("has a default rule set per sport, valid and sealed by its own schema", () => {
    expect(SPORT_IDS).toEqual(["soccer", "hockey", "basketball"]);
    for (const sport of SPORT_IDS) {
      const r = defaultRulesFor(sport);
      expect(parseRulesFor(sport, r)).toEqual(r);
      expect(sealOfFor(sport, r)).toMatch(/^sha256:[0-9a-f]{64}$/);
    }
    expect(sealOfFor("hockey", DEFAULT_HOCKEY_RULES)).not.toBe(sealOfFor("basketball", DEFAULT_BASKETBALL_RULES));
  });

  it("refuses rules of another sport or bands out of order", () => {
    expect(() => parseRulesFor("hockey", DEFAULT_RULES)).toThrow();
    expect(() => parseRulesFor("basketball", { ...DEFAULT_BASKETBALL_RULES, bands: [10, 5] })).toThrow();
  });
});

describe("a band says which margins it covers", () => {
  it("reads 1–5, 6–10, 11–15, 16+ from the edges 5, 10, 15", async () => {
    const { bandRange } = await import("./sports");
    expect([0, 1, 2, 3].map((i) => bandRange([5, 10, 15], i))).toEqual([{ from: 1, to: 5 }, { from: 6, to: 10 }, { from: 11, to: 15 }, { from: 16, to: null }]);
  });
});
