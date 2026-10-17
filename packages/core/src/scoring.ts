import type { RuleSet } from "./rules";

export interface Score {
  home: number;
  away: number;
}

/** One line of a breakdown: which rule earned what — the transparency promise (every point says where it comes from). */
export interface BreakdownLine {
  rule: "exactScore" | "outcome" | "goalDifference" | "teamGoals" | "finalMultiplier" | "winner" | "overtime" | "marginBand" | "playoffMultiplier";
  points: number;
}

export interface Scored {
  points: number;
  breakdown: BreakdownLine[];
  /** Every available rule earned (set by `scoreFor`; soccer's scorer leaves it out: an exact score is the proof). */
  perfect?: boolean;
}

const outcomeOf = (s: Score) => Math.sign(s.home - s.away);

function validateScore(s: Score, label: string) {
  if (!s || !Number.isInteger(s.home) || s.home < 0 || !Number.isInteger(s.away) || s.away < 0) {
    throw new RangeError(`${label} scores must be non-negative integers`);
  }
}

/**
 * The points of one prediction against one result, with the breakdown that adds up to them. Deterministic and pure:
 * the same rules, prediction and result always give the same lines, in the same order. Rules, evaluated in order:
 * an exact score earns `exactScore` (and nothing partial on top); otherwise the right outcome earns `outcome`, plus
 * `goalDifference` when the difference is right too; each team's goals guessed right earn `teamGoals`. A final
 * multiplies the total (its own line says by how much).
 */
export function scorePrediction(rules: RuleSet, predicted: Score, actual: Score, opts: { final?: boolean } = {}): Scored {
  validateScore(predicted, "predicted");
  validateScore(actual, "actual");
  const lines: BreakdownLine[] = [];
  if (predicted.home === actual.home && predicted.away === actual.away) {
    lines.push({ rule: "exactScore", points: rules.exactScore });
  } else {
    if (outcomeOf(predicted) === outcomeOf(actual)) {
      lines.push({ rule: "outcome", points: rules.outcome });
      if (predicted.home - predicted.away === actual.home - actual.away) lines.push({ rule: "goalDifference", points: rules.goalDifference });
    }
    const teams = (predicted.home === actual.home ? 1 : 0) + (predicted.away === actual.away ? 1 : 0);
    if (teams && rules.teamGoals) lines.push({ rule: "teamGoals", points: teams * rules.teamGoals });
  }
  const base = lines.reduce((sum, l) => sum + l.points, 0);
  if (opts.final && rules.finalMultiplier > 1 && base > 0) {
    lines.push({ rule: "finalMultiplier", points: Math.round(base * (rules.finalMultiplier - 1)) });
  }
  const points = lines.reduce((sum, l) => sum + l.points, 0);
  return { points, breakdown: lines.filter((l) => l.points !== 0) };
}
