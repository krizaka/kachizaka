import type { Scored } from "./scoring";

export interface MemberScore {
  memberId: string;
  displayName: string;
  scored: Scored[];
}

export interface StandingRow {
  memberId: string;
  displayName: string;
  rank: number;
  points: number;
  exact: number;
  predictions: number;
}

/**
 * The table: points, then exact scores, then fewer predictions (the same points with fewer guesses ranks higher), then
 * the name — a total order, so two recomputations never disagree. Equal on every count share a rank (1, 2, 2, 4).
 */
export function standings(members: readonly MemberScore[]): StandingRow[] {
  const rows = members.map((m) => ({
    memberId: m.memberId,
    displayName: m.displayName,
    points: m.scored.reduce((s, x) => s + x.points, 0),
    exact: m.scored.filter((x) => x.breakdown.some((l) => l.rule === "exactScore")).length,
    predictions: m.scored.length,
  }));
  rows.sort((a, b) => b.points - a.points || b.exact - a.exact || a.predictions - b.predictions || a.displayName.localeCompare(b.displayName, "en") || a.memberId.localeCompare(b.memberId));
  let rank = 0;
  return rows.map((r, i) => {
    const prev = rows[i - 1];
    if (!prev || prev.points !== r.points || prev.exact !== r.exact || prev.predictions !== r.predictions) rank = i + 1;
    return { ...r, rank };
  });
}
