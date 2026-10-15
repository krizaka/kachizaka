import { describe, expect, it } from "vitest";

import { canonicalJson, DEFAULT_RULES, ruleSetSchema, sealHolds, sealOf } from "./rules";

describe("the seal of a rule set", () => {
  it("is the same for the same rules, whatever order they were written in", () => {
    const shuffled = { finalMultiplier: 2, teamGoals: 0, goalDifference: 1, outcome: 2, exactScore: 5 };
    expect(canonicalJson(shuffled)).toBe(canonicalJson(DEFAULT_RULES));
    expect(sealOf(shuffled)).toBe(sealOf(DEFAULT_RULES));
    expect(sealOf(DEFAULT_RULES)).toMatch(/^sha256:[0-9a-f]{64}$/);
  });

  it("changes with any rule, and says so when the rules no longer match it", () => {
    const seal = sealOf(DEFAULT_RULES);
    const tampered = { ...DEFAULT_RULES, exactScore: 6 };
    expect(sealOf(tampered)).not.toBe(seal);
    expect(sealHolds(DEFAULT_RULES, seal)).toBe(true);
    expect(sealHolds(tampered, seal)).toBe(false);
  });

  it("refuses rules it does not know, money included: points only", () => {
    expect(() => sealOf({ ...DEFAULT_RULES, stake: 10 } as never)).toThrow();
    expect(ruleSetSchema.safeParse({ ...DEFAULT_RULES, finalMultiplier: 10 }).success).toBe(false);
    expect(ruleSetSchema.safeParse({ ...DEFAULT_RULES, exactScore: 2.5 }).success).toBe(false);
  });
});
