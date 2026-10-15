import { describe, expect, it } from "vitest";

import { DEFAULT_RULES } from "./rules";
import { scorePrediction } from "./scoring";

const rules = DEFAULT_RULES; // exact 5, outcome 2, goal difference 1, team goals 0, final ×2

describe("scoring, with its breakdown", () => {
  it.each([
    ["exact score", { home: 2, away: 1 }, { home: 2, away: 1 }, 5, ["exactScore"]],
    ["outcome and goal difference", { home: 3, away: 2 }, { home: 2, away: 1 }, 3, ["outcome", "goalDifference"]],
    ["outcome only", { home: 1, away: 0 }, { home: 3, away: 1 }, 2, ["outcome"]],
    ["a draw, not the score", { home: 0, away: 0 }, { home: 2, away: 2 }, 3, ["outcome", "goalDifference"]],
    ["wrong outcome", { home: 0, away: 1 }, { home: 2, away: 1 }, 0, []],
  ] as const)("%s", (_, predicted, actual, points, rulesUsed) => {
    const s = scorePrediction(rules, predicted, actual);
    expect(s.points).toBe(points);
    expect(s.breakdown.map((l) => l.rule)).toEqual(rulesUsed);
    expect(s.breakdown.reduce((sum, l) => sum + l.points, 0)).toBe(s.points);
  });

  it("adds team goals when the league counts them, never on top of an exact score", () => {
    const withTeams = { ...rules, teamGoals: 1 };
    expect(scorePrediction(withTeams, { home: 2, away: 0 }, { home: 2, away: 1 })).toEqual({ points: 3, breakdown: [{ rule: "outcome", points: 2 }, { rule: "teamGoals", points: 1 }] });
    expect(scorePrediction(withTeams, { home: 2, away: 1 }, { home: 2, away: 1 }).points).toBe(5);
  });

  it("multiplies a final, on a line of its own", () => {
    const s = scorePrediction(rules, { home: 1, away: 0 }, { home: 1, away: 0 }, { final: true });
    expect(s).toEqual({ points: 10, breakdown: [{ rule: "exactScore", points: 5 }, { rule: "finalMultiplier", points: 5 }] });
    expect(scorePrediction(rules, { home: 0, away: 1 }, { home: 1, away: 0 }, { final: true }).breakdown).toEqual([]);
  });

  it("is deterministic: the same inputs, the same lines, every time", () => {
    const runs = Array.from({ length: 5 }, () => JSON.stringify(scorePrediction(rules, { home: 3, away: 1 }, { home: 2, away: 0 }, { final: true })));
    expect(new Set(runs).size).toBe(1);
  });
});
