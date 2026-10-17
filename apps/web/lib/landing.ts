/**
 * The landing's structure — ids and destinations, never words (the words are in messages/, keyed by the same ids).
 * One story in five sections: the promise and the league as it will look (a sport switch), how it works on a phone, how it
 * compares, trust, the closing call.
 */
export const HOME_SECTIONS = ["hero", "how", "compare", "trust", "closing"] as const;

/** The journey on the phone, in order: start a league, pick, watch the table move, win the season. */
export const STORY_STEPS = ["create", "pick", "table", "season"] as const;
export type StoryStep = (typeof STORY_STEPS)[number];

/** The rows of the comparison with the typical prediction apps (three to six). */
export const COMPARE_ROWS = ["pays", "points", "sports", "peek", "home"] as const;

/** Why friends can trust it: points only, sealed rules, the code. */
export const TRUST = ["points", "sealed", "open"] as const;

type DevPreview = { criteria: Record<string, { evidence: string | null; na?: boolean }> };

/** The honest status chip, from dev-preview.json: « Dev preview » only once every criterion has its evidence. */
export function productStatus(preview: DevPreview): "development" | "preview" {
  return Object.values(preview.criteria).every((c) => c.evidence !== null || c.na === true) ? "preview" : "development";
}
