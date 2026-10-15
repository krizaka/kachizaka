import type { StandingRow } from "./standings";

/**
 * The league's memory across seasons — what a member's avatar wears: a star per championship, trophies for the
 * podium, the longest streak of scoring predictions, and the "nemesis" (bête noire): the member who most often
 * finished above them in head-to-head matchdays.
 */
export type HonourKind = "champion" | "runnerUp" | "third" | "streak" | "nemesis";

export interface Honour {
  memberId: string;
  kind: HonourKind;
  /** The season it was earned in. */
  seasonId: string;
  /** For a streak: its length; for a nemesis: the other member and the count. */
  detail: Record<string, string | number>;
}

/** The podium of a finished season (shared ranks share the honour). */
export function podium(seasonId: string, table: readonly StandingRow[]): Honour[] {
  const kinds: Record<number, HonourKind> = { 1: "champion", 2: "runnerUp", 3: "third" };
  return table.filter((r) => r.rank <= 3).map((r) => ({ memberId: r.memberId, kind: kinds[r.rank]!, seasonId, detail: { points: r.points } }));
}

/** The longest run of consecutive scoring predictions (points > 0), in match order. */
export function longestStreak(pointsInOrder: readonly number[]): number {
  let best = 0;
  let run = 0;
  for (const p of pointsInOrder) {
    run = p > 0 ? run + 1 : 0;
    best = Math.max(best, run);
  }
  return best;
}

/**
 * The nemesis of each member: across matchdays (each a map member → points that day), the other member who scored
 * strictly more most often — at least `min` times. Ties are broken by member id, so the answer is stable.
 */
export function nemeses(seasonId: string, matchdays: readonly Record<string, number>[], min = 3): Honour[] {
  const beaten = new Map<string, Map<string, number>>();
  for (const day of matchdays) {
    const members = Object.keys(day);
    for (const a of members) for (const b of members) if (a !== b && day[b]! > day[a]!) {
      const row = beaten.get(a) ?? new Map<string, number>();
      row.set(b, (row.get(b) ?? 0) + 1);
      beaten.set(a, row);
    }
  }
  const out: Honour[] = [];
  for (const [memberId, row] of [...beaten.entries()].sort(([x], [y]) => x.localeCompare(y))) {
    const [other, count] = [...row.entries()].sort(([x, n], [y, m]) => m - n || x.localeCompare(y))[0]!;
    if (count >= min) out.push({ memberId, kind: "nemesis", seasonId, detail: { other, count } });
  }
  return out;
}
