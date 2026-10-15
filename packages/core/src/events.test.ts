import { describe, expect, it } from "vitest";

import { applyInOrder, INITIAL_STATE, type MatchEvent } from "./events";

const at = "2026-10-15T19:00:00Z";
const facts: MatchEvent[] = [
  { kind: "kickoff", providerEventId: "p1", seq: 1, at },
  { kind: "goal", providerEventId: "p2", seq: 2, at, side: "home", minute: 12 },
  { kind: "goal", providerEventId: "p3", seq: 3, at, side: "away", minute: 40 },
  { kind: "goal", providerEventId: "p4", seq: 4, at, side: "home", minute: 77 },
  { kind: "final", providerEventId: "p5", seq: 5, at },
];

describe("match facts, applied in order and once", () => {
  it("gives the same final state whatever order the facts arrive in", () => {
    const inOrder = applyInOrder(INITIAL_STATE, facts).state;
    const shuffled = applyInOrder(INITIAL_STATE, [facts[3]!, facts[0]!, facts[4]!, facts[2]!, facts[1]!]).state;
    expect(inOrder).toEqual({ status: "final", home: 2, away: 1, appliedSeq: 5 });
    expect(shuffled).toEqual(inOrder);
  });

  it("waits at a gap, then resumes when the missing fact arrives", () => {
    const first = applyInOrder(INITIAL_STATE, [facts[0]!, facts[2]!]);
    expect(first.state.appliedSeq).toBe(1);
    expect(first.applied.map((e) => e.seq)).toEqual([1]);
    const second = applyInOrder(first.state, [facts[2]!, facts[1]!]);
    expect(second.applied.map((e) => e.seq)).toEqual([2, 3]);
    expect(second.state).toMatchObject({ home: 1, away: 1, status: "live" });
  });

  it("ignores a fact already applied (idempotent) and a duplicate in the same delivery", () => {
    const once = applyInOrder(INITIAL_STATE, facts).state;
    expect(applyInOrder(once, facts)).toEqual({ state: once, applied: [] });
    expect(applyInOrder(INITIAL_STATE, [facts[0]!, facts[0]!, facts[1]!]).state).toMatchObject({ appliedSeq: 2, home: 1 });
  });

  it("lets a correction set the score after the final whistle; a late goal changes nothing", () => {
    const done = applyInOrder(INITIAL_STATE, facts).state;
    const corrected = applyInOrder(done, [{ kind: "correction", providerEventId: "p6", seq: 6, at, home: 2, away: 2 }]).state;
    expect(corrected).toEqual({ status: "final", home: 2, away: 2, appliedSeq: 6 });
    expect(applyInOrder(corrected, [{ kind: "goal", providerEventId: "p7", seq: 7, at, side: "home" }]).state).toMatchObject({ home: 2, away: 2, appliedSeq: 7 });
  });
});
