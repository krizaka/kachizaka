import { createHash } from "node:crypto";

import { z } from "zod";

/**
 * A league's scoring rules. Points only — never money, stakes or odds (Kachizaka's first rule). A rule set is a small,
 * explicit document: how many points each kind of right guess earns. It is **sealed** when the first match it applies
 * to kicks off: its canonical JSON is hashed (SHA-256) and the hash is stored with it and with every match it scores;
 * from then on it never changes (the database refuses it). A change is a new version, which applies only to matches
 * not yet kicked off.
 */
export const ruleSetSchema = z
  .object({
    /** The exact score (2–1 predicted, 2–1 played). */
    exactScore: z.number().int().min(0).max(100),
    /** The right outcome (home win, draw, away win) without the exact score. */
    outcome: z.number().int().min(0).max(100),
    /** With the right outcome, the right goal difference (2–0 for 3–1) — added to `outcome`. Never with an exact score. */
    goalDifference: z.number().int().min(0).max(100),
    /** For each team whose goals were guessed right, when the score is not exact — added to whatever else was earned. */
    teamGoals: z.number().int().min(0).max(100),
    /** A multiplier for matches the league marks as a final (knock-out finals, derbies): 1 to 3. */
    finalMultiplier: z.number().int().min(1).max(3),
  })
  .strict();

export type RuleSet = z.infer<typeof ruleSetSchema>;

/** The default a new league starts from: an exact score is worth more than any combination of partial guesses. */
export const DEFAULT_RULES: RuleSet = { exactScore: 5, outcome: 2, goalDifference: 1, teamGoals: 0, finalMultiplier: 2 };

/** JSON with its keys sorted at every level: the same rules always give the same bytes, whatever order they were written in. */
export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

/** The seal: `sha256:` + the hex SHA-256 of the canonical JSON of the validated rules. */
export function sealOf(rules: RuleSet): string {
  const valid = ruleSetSchema.parse(rules);
  return `sha256:${createHash("sha256").update(canonicalJson(valid)).digest("hex")}`;
}

/** True when the rules still match their seal — read on every scoring, so a tampered row is noticed, never used. */
export function sealHolds(rules: RuleSet, seal: string): boolean {
  return sealOf(rules) === seal;
}

/** Whether the rules may still change: only before the first kick-off they apply to. */
export function isSealed(sealedAt: Date | null | undefined): boolean {
  return sealedAt != null;
}
