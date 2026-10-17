/**
 * The landing's structure — ids and destinations, never words (the words are in messages/, keyed by the same ids).
 * One story in five sections: the promise and its proof, what you can do, how it works, trust, the closing call.
 */
export const HOME_SECTIONS = ["hero", "outcomes", "how", "trust", "closing"] as const;

/** What a group of friends gets — outcomes, not features — each card a way in (no dead-end card). */
export const OUTCOMES = [
  { id: "settle", to: "sign-in" },
  { id: "fair", to: "sign-in" },
  { id: "memory", to: "sign-in" },
] as const;

/** How it works: three steps. */
export const HOW_STEPS = ["league", "predict", "table"] as const;

/** Why friends can trust it: points only, sealed rules, the code. */
export const TRUST = ["points", "sealed", "open"] as const;

type DevPreview = { criteria: Record<string, { evidence: string | null; na?: boolean }> };

/** The honest status chip, from dev-preview.json: « Dev preview » only once every criterion has its evidence. */
export function productStatus(preview: DevPreview): "development" | "preview" {
  return Object.values(preview.criteria).every((c) => c.evidence !== null || c.na === true) ? "preview" : "development";
}
