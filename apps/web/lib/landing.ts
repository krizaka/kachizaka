import { DEFAULT_RULES } from "@kachizaka/core";

/**
 * The landing's structure — ids and destinations, never words (the words are in messages/, keyed by the same ids).
 * One story in five sections: the promise and the league as it will look (a sport switch), how it works on a phone, how it
 * compares, trust, the closing call.
 */
export const HOME_SECTIONS = ["hero", "features", "how", "points", "compare", "trust", "faq", "closing"] as const;

/** The journey on the phone, in order: start a league, pick, watch the table move, win the season. */
export const STORY_STEPS = ["create", "pick", "table", "season"] as const;
export type StoryStep = (typeof STORY_STEPS)[number];

/** The rows of the comparison with the typical prediction apps (three to six). */
export const COMPARE_ROWS = ["pays", "points", "sports", "peek", "home"] as const;

/** Why friends can trust it: points only, sealed rules, the code. */
export const TRUST = ["points", "sealed", "open"] as const;

type DevPreview = { criteria: Record<string, { evidence?: string | null; na?: string | boolean }> };

/** The honest status chip, from dev-preview.json: « Dev preview » only once every criterion has its evidence. */
export function productStatus(preview: DevPreview): "development" | "preview" {
  return Object.values(preview.criteria).every((c) => (c.evidence !== undefined && c.evidence !== null) || Boolean(c.na)) ? "preview" : "development";
}

/**
 * The rules worth points in a new league, read from the real scorer's defaults (`DEFAULT_RULES` of @kachizaka/core) — never
 * typed here: a rule at 0 points is not listed. The final's multiplier is shown on its own line.
 */
export const POINT_RULES = (["exactScore", "outcome", "goalDifference"] as const)
  .map((id) => ({ id, points: DEFAULT_RULES[id] }))
  .filter((r) => r.points > 0);

export const FAQ_IDS = ["money", "sealed", "sports", "signup", "data", "engine"] as const;
