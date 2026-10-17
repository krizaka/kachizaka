import { type AnyRuleSet, type SportId } from "@kachizaka/core";

/** The lines a sport's rule set shows, in reading order: `points` lines, a `multiplier`, and the basketball `bands`. */
export type RuleLine = { id: string; kind: "points" | "multiplier"; value: number } | { id: string; kind: "bands"; value: readonly number[] };

const ORDER: Record<SportId, readonly string[]> = {
  soccer: ["exactScore", "outcome", "goalDifference", "teamGoals", "finalMultiplier"],
  hockey: ["winner", "goalDifference", "overtime", "playoffMultiplier"],
  basketball: ["winner", "marginBand", "bands", "playoffMultiplier"],
};

export function ruleLines(sport: SportId, values: Record<string, unknown> | AnyRuleSet): RuleLine[] {
  const v = values as Record<string, unknown>;
  return ORDER[sport].flatMap((id): RuleLine[] => {
    const value = v[id];
    if (id === "bands") return Array.isArray(value) ? [{ id, kind: "bands", value: value as number[] }] : [];
    if (typeof value !== "number") return [];
    return [{ id, kind: id.endsWith("Multiplier") ? "multiplier" : "points", value }];
  });
}
