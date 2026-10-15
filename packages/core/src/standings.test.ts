import { describe, expect, it } from "vitest";

import { longestStreak, nemeses, podium } from "./memory";
import { standings } from "./standings";

const s = (points: number, exact = false) => ({ points, breakdown: exact ? [{ rule: "exactScore" as const, points }] : points ? [{ rule: "outcome" as const, points }] : [] });

describe("the standings", () => {
  it("rank by points, exact scores, fewer predictions, then name — ties share a rank", () => {
    const table = standings([
      { memberId: "a", displayName: "Amina", scored: [s(5, true), s(2)] },
      { memberId: "b", displayName: "Bruno", scored: [s(5, true), s(2)] },
      { memberId: "c", displayName: "Chloé", scored: [s(2), s(2), s(3)] },
      { memberId: "d", displayName: "Dev", scored: [s(7)] },
    ]);
    expect(table.map((r) => [r.displayName, r.rank, r.points, r.exact])).toEqual([
      ["Amina", 1, 7, 1],
      ["Bruno", 1, 7, 1],
      ["Dev", 3, 7, 0],
      ["Chloé", 4, 7, 0],
    ]);
  });
});

describe("the league's memory", () => {
  it("gives the podium its honours", () => {
    const table = standings([
      { memberId: "a", displayName: "A", scored: [s(9)] },
      { memberId: "b", displayName: "B", scored: [s(5)] },
      { memberId: "c", displayName: "C", scored: [s(1)] },
      { memberId: "d", displayName: "D", scored: [s(0)] },
    ]);
    expect(podium("2026", table).map((h) => [h.memberId, h.kind])).toEqual([
      ["a", "champion"],
      ["b", "runnerUp"],
      ["c", "third"],
    ]);
  });

  it("counts the longest scoring streak", () => {
    expect(longestStreak([2, 3, 0, 5, 5, 2, 0])).toBe(3);
    expect(longestStreak([])).toBe(0);
  });

  it("names a nemesis only after enough matchdays, stably", () => {
    const days = [
      { a: 1, b: 3, c: 0 },
      { a: 0, b: 2, c: 2 },
      { a: 2, b: 5, c: 1 },
    ];
    expect(nemeses("2026", days)).toEqual([{ memberId: "a", kind: "nemesis", seasonId: "2026", detail: { other: "b", count: 3 } }]);
    expect(nemeses("2026", days.slice(0, 2))).toEqual([]);
  });
});
