import { z } from "zod";

import { canonicalJson, DEFAULT_RULES, type RuleSet, ruleSetSchema } from "./rules";
import { type BreakdownLine, scorePrediction, type Scored, type Score } from "./scoring";
import { createHash } from "node:crypto";

/**
 * The games a league follows. Each sport has its own rule set (a small data document, sealed at kick-off like soccer's)
 * and its own kind of pick: soccer and hockey a score (hockey also « overtime or shootout »), basketball the winner and a
 * margin band. Points only. The scoring is pure and deterministic; the database stores the rules, their seal and the lines.
 */
export const SPORT_IDS = ["soccer", "hockey", "basketball"] as const;
export type SportId = (typeof SPORT_IDS)[number];

const points = z.number().int().min(0).max(100);

/** NHL: the winner, the goal difference once the winner is right, and the overtime (or shootout) called right. */
export const hockeyRuleSetSchema = z
  .object({ winner: points, goalDifference: points, overtime: points, playoffMultiplier: z.number().int().min(1).max(3) })
  .strict();
export type HockeyRuleSet = z.infer<typeof hockeyRuleSetSchema>;
export const DEFAULT_HOCKEY_RULES: HockeyRuleSet = { winner: 3, goalDifference: 1, overtime: 1, playoffMultiplier: 2 };

/** NBA: the winner, then the margin band; `bands` are the upper edges in points (5, 10, 15 → 1–5, 6–10, 11–15, 16+). */
export const basketballRuleSetSchema = z
  .object({
    winner: points,
    marginBand: points,
    bands: z
      .array(z.number().int().min(1).max(60))
      .min(1)
      .max(6)
      .refine((b) => b.every((v, i) => i === 0 || v > b[i - 1]!), "bands must increase"),
    playoffMultiplier: z.number().int().min(1).max(3),
  })
  .strict();
export type BasketballRuleSet = z.infer<typeof basketballRuleSetSchema>;
export const DEFAULT_BASKETBALL_RULES: BasketballRuleSet = { winner: 3, marginBand: 2, bands: [5, 10, 15], playoffMultiplier: 2 };

export type AnyRuleSet = RuleSet | HockeyRuleSet | BasketballRuleSet;

const SCHEMAS = { soccer: ruleSetSchema, hockey: hockeyRuleSetSchema, basketball: basketballRuleSetSchema } as const;

export function defaultRulesFor(sport: SportId): AnyRuleSet {
  return sport === "soccer" ? DEFAULT_RULES : sport === "hockey" ? DEFAULT_HOCKEY_RULES : DEFAULT_BASKETBALL_RULES;
}

/** The rules of a sport, validated — refused if they are another sport's. */
export function parseRulesFor(sport: SportId, rules: unknown): AnyRuleSet {
  return SCHEMAS[sport].parse(rules);
}

/** The seal of a sport's rules: `sha256:` + the hash of their canonical JSON (the same recipe as soccer's `sealOf`). */
export function sealOfFor(sport: SportId, rules: unknown): string {
  return `sha256:${createHash("sha256").update(canonicalJson(parseRulesFor(sport, rules))).digest("hex")}`;
}

export function sealHoldsFor(sport: SportId, rules: unknown, seal: string): boolean {
  return sealOfFor(sport, rules) === seal;
}

/** The band (0-based) of a winning margin, by the league's upper edges. */
export function bandOf(edges: readonly number[], margin: number): number {
  const i = edges.findIndex((edge) => margin <= edge);
  return i === -1 ? edges.length : i;
}

export interface HockeyPick extends Score {
  /** Called to go beyond regulation (overtime or shootout). */
  overtime: boolean;
}
export interface BasketballPick {
  winner: "home" | "away";
  band: number;
}
export type Pick = Score | HockeyPick | BasketballPick;
export type Result = Score & { overtime?: boolean };

export interface SportScored extends Scored {
  /** Every available rule earned — what the table counts as a perfect pick (soccer: the exact score). */
  perfect: boolean;
}

const noTie = (s: Score, label: string) => {
  if (s.home === s.away) throw new RangeError(`${label}: a tie is impossible in this sport`);
};
const finish = (lines: BreakdownLine[], multiplier: number, final: boolean | undefined): { points: number; breakdown: BreakdownLine[] } => {
  const base = lines.reduce((n, l) => n + l.points, 0);
  const out = [...lines];
  if (final && multiplier > 1 && base > 0) out.push({ rule: "playoffMultiplier", points: base * (multiplier - 1) });
  const breakdown = out.filter((l) => l.points !== 0);
  return { points: breakdown.reduce((n, l) => n + l.points, 0), breakdown };
};

/**
 * One pick against one result, in any sport, with the lines that add up to the points. `final` marks a game the league
 * counts double (the playoffs). Input is validated: a pick of another shape, or a tie in hockey or basketball, throws.
 */
export function scoreFor(sport: SportId, rules: unknown, pick: unknown, actual: Result, opts: { final?: boolean } = {}): SportScored {
  const r = parseRulesFor(sport, rules);
  if (sport === "soccer") {
    const s = scorePrediction(r as RuleSet, pick as Score, actual, opts);
    return { ...s, perfect: s.breakdown.some((l) => l.rule === "exactScore") };
  }
  if (sport === "hockey") {
    const h = r as HockeyRuleSet;
    const p = pick as HockeyPick;
    noTie(p, "hockey pick");
    noTie(actual, "hockey result");
    const lines: BreakdownLine[] = [];
    const winnerRight = Math.sign(p.home - p.away) === Math.sign(actual.home - actual.away);
    const diffRight = winnerRight && p.home - p.away === actual.home - actual.away;
    const ot = !!actual.overtime;
    if (winnerRight) lines.push({ rule: "winner", points: h.winner });
    if (diffRight) lines.push({ rule: "goalDifference", points: h.goalDifference });
    if (ot && p.overtime) lines.push({ rule: "overtime", points: h.overtime });
    return { ...finish(lines, h.playoffMultiplier, opts.final), perfect: winnerRight && diffRight && p.overtime === ot };
  }
  const b = r as BasketballRuleSet;
  const p = pick as BasketballPick;
  noTie(actual, "basketball result");
  if (!Number.isInteger(p.band) || p.band < 0 || p.band > b.bands.length) throw new RangeError("basketball pick: the band is outside the rules");
  const winner = actual.home > actual.away ? "home" : "away";
  const lines: BreakdownLine[] = [];
  const winnerRight = p.winner === winner;
  const bandRight = winnerRight && p.band === bandOf(b.bands, Math.abs(actual.home - actual.away));
  if (winnerRight) lines.push({ rule: "winner", points: b.winner });
  if (bandRight) lines.push({ rule: "marginBand", points: b.marginBand });
  return { ...finish(lines, b.playoffMultiplier, opts.final), perfect: winnerRight && bandRight };
}

/** A band as the range of winning margins it covers: `{ from: 6, to: 10 }`; the last one is open (`to: null`, « 16+ »). */
export function bandRange(edges: readonly number[], band: number): { from: number; to: number | null } {
  return { from: band === 0 ? 1 : edges[band - 1]! + 1, to: band >= edges.length ? null : edges[band]! };
}

const goals = z.number().int().min(0).max(30);
const pickSchemas = {
  soccer: z.object({ home: goals, away: goals }).strict(),
  hockey: z
    .object({ home: goals, away: goals, overtime: z.boolean().default(false) })
    .strict()
    .refine((p) => p.home !== p.away, { message: "a hockey pick has a winner", path: ["away"] }),
  basketball: z.object({ winner: z.enum(["home", "away"]), band: z.number().int().min(0).max(10) }).strict(),
} as const;

/**
 * A pick as a member sends it, checked against its sport's shape: soccer a score, hockey a score without a tie and
 * « overtime or shootout », basketball a winner and a margin band (an index into the league's bands: `bandsCount`
 * is how many bands the sealed rules have, so a band outside them is refused).
 */
export function parsePick(sport: SportId, input: unknown, opts: { bandsCount?: number } = {}): Pick {
  const pick = pickSchemas[sport].parse(input) as Pick;
  if (sport === "basketball" && opts.bandsCount !== undefined && (pick as BasketballPick).band > opts.bandsCount) throw new RangeError("the band is outside the league's rules");
  return pick;
}

/** The competitions a league may follow, and the sport of each (the words are in the app's messages; the sources: docs/data-sources.md). */
export const COMPETITION_SPORT = { NHL: "hockey", "Premier League": "soccer", "Ligue 1": "soccer" } as const satisfies Record<string, SportId>;
export type CompetitionId = keyof typeof COMPETITION_SPORT;
export const COMPETITION_IDS = Object.keys(COMPETITION_SPORT) as CompetitionId[];
