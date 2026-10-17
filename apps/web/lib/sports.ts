import { DEFAULT_RULES, scorePrediction, sealOf, type Score } from "@kachizaka/core";

/**
 * The games a league follows — structure and example data, never words (the words are in messages/, keyed by the
 * same ids). Proper nouns (teams, competitions) are data: they read the same in both languages.
 * `ready` = a scorer runs today in @kachizaka/core; `soon` = the rules are being written (the next release).
 */
export const SPORTS = ["soccer", "hockey", "basketball"] as const;
export type SportId = (typeof SPORTS)[number];

export const SPORT_STATUS: Record<SportId, "ready" | "soon"> = { soccer: "ready", hockey: "soon", basketball: "soon" };

/** Québec and Canada first, then the competitions the world follows. */
export const COMPETITIONS: Record<SportId, readonly string[]> = {
  soccer: ["MLS", "Premier League", "Ligue 1", "Champions League"],
  hockey: ["NHL"],
  basketball: ["NBA"],
};

/** The rules each sport will be scored by: the ids of the lines the landing lists (the words: landing.league.rules). */
export const PLANNED_RULES: Record<Exclude<SportId, "soccer">, readonly string[]> = {
  hockey: ["winner", "overtime", "goalDifference"],
  basketball: ["winner", "marginBand"],
};

export interface ExampleMatch {
  home: string;
  away: string;
  /** The result, once played. */
  actual: Score;
  /** What each friend picked before kick-off. */
  picks: readonly { member: string; pick: Score }[];
}

/** Four friends — named personas of the example league, not users. */
export const FRIENDS = ["Éric", "Salma", "Marc-Antoine", "Jade"] as const;

export const EXAMPLES: Record<SportId, ExampleMatch> = {
  soccer: {
    home: "CF Montréal",
    away: "Toronto FC",
    actual: { home: 2, away: 1 },
    picks: [
      { member: "Éric", pick: { home: 2, away: 1 } },
      { member: "Salma", pick: { home: 3, away: 2 } },
      { member: "Marc-Antoine", pick: { home: 1, away: 1 } },
      { member: "Jade", pick: { home: 2, away: 0 } },
    ],
  },
  hockey: {
    home: "Canadiens",
    away: "Maple Leafs",
    actual: { home: 4, away: 3 },
    picks: [
      { member: "Éric", pick: { home: 4, away: 3 } },
      { member: "Salma", pick: { home: 3, away: 2 } },
      { member: "Marc-Antoine", pick: { home: 2, away: 3 } },
      { member: "Jade", pick: { home: 5, away: 2 } },
    ],
  },
  basketball: {
    home: "Raptors",
    away: "Celtics",
    actual: { home: 108, away: 101 },
    picks: [
      { member: "Éric", pick: { home: 110, away: 102 } },
      { member: "Salma", pick: { home: 99, away: 104 } },
      { member: "Marc-Antoine", pick: { home: 112, away: 100 } },
      { member: "Jade", pick: { home: 105, away: 98 } },
    ],
  },
};

export interface LeagueRow {
  member: string;
  pick: Score;
  /** Points from the real scorer — `null` while the sport's rules are still being written. */
  points: number | null;
  /** Which rule earned them, in order (the ids of console.league.rules.names). */
  rules: readonly string[];
}

export interface SportView {
  sport: SportId;
  status: "ready" | "soon";
  match: Pick<ExampleMatch, "home" | "away" | "actual">;
  /** Best first. */
  rows: readonly LeagueRow[];
  competitions: readonly string[];
  /** The seal of the rules that scored the rows (soccer only). */
  seal: string | null;
}

/** A sport's view of the example league: soccer is scored by the product's own scorer, the others are shown unscored. */
export function sportView(sport: SportId): SportView {
  const ex = EXAMPLES[sport];
  const ready = SPORT_STATUS[sport] === "ready";
  const rows: LeagueRow[] = ex.picks.map(({ member, pick }) => {
    if (!ready) return { member, pick, points: null, rules: [] };
    const scored = scorePrediction(DEFAULT_RULES, pick, ex.actual);
    return { member, pick, points: scored.points, rules: scored.breakdown.map((l) => l.rule) };
  });
  if (ready) rows.sort((a, b) => (b.points ?? 0) - (a.points ?? 0));
  return {
    sport,
    status: SPORT_STATUS[sport],
    match: { home: ex.home, away: ex.away, actual: ex.actual },
    rows,
    competitions: COMPETITIONS[sport],
    seal: ready ? sealOf(DEFAULT_RULES) : null,
  };
}
