import type { ShowcaseLeague, ShowcaseResult, ShowcaseRow } from "@kachizaka/db";

import { format, getDictionary, type Locale } from "./i18n";
import { COMPETITIONS, EXAMPLES, SPORT_STATUS, type SportId, SPORTS, sportView } from "./sports";

/** The league of the demonstration league's name on dev (a persona-owned league, packages/db `showcaseLeague`). */
export const SHOWCASE_LEAGUE = "La gang du vendredi";

/** One sport of the hero's league, already worded: the client component only draws it. */
export interface LeagueSportView {
  sport: SportId;
  /** A scorer and a results source run for this sport; false = in preparation. */
  ready: boolean;
  competitions: string[];
  /** The sport's table, best first; `pts` is null while the sport is in preparation. */
  table: { member: string; pts: string | null }[];
  results: { title: string; home: string; away: string; score: { home: number; away: number } | null; meta: string; overtime: boolean; picks: { member: string; pick: string; pts: string | null }[] }[];
  seal: string | null;
}

export interface LeagueData {
  /** `league`: read from the database; `example`: the built-in example (the database could not be read). */
  source: "league" | "example";
  name: string;
  sports: LeagueSportView[];
  /** « Table updated 19 Oct, 10:07 PM » — null for the example. */
  updated: string | null;
  friends: number;
  sportsLive: number;
  picksScored: number;
}

const ZONE = "America/Toronto";

export function when(iso: string, locale: Locale, withTime = true): string {
  return new Intl.DateTimeFormat(locale, { timeZone: ZONE, day: "numeric", month: "short", ...(withTime ? { hour: "numeric", minute: "2-digit" } : {}) }).format(new Date(iso));
}

const score = (home: number | null, away: number | null) => `${home ?? "?"}–${away ?? "?"}`;

function fromResult(r: ShowcaseResult, locale: Locale, sport: SportId): LeagueSportView["results"][number] {
  const t = getDictionary(locale).landing.league;
  return {
    title: `${r.home} ${r.homeScore} – ${r.awayScore} ${r.away}`,
    home: r.home,
    away: r.away,
    score: { home: r.homeScore, away: r.awayScore },
    meta: [r.competition, when(r.kickoffAt, locale, false)].filter(Boolean).join(" · "),
    overtime: r.overtime,
    picks: r.picks.map((p) => ({
      member: p.member,
      pick: `${score(p.home, p.away)}${sport === "hockey" && p.overtime ? ` · ${t.overtime}` : ""}`,
      pts: p.points === null ? null : format(t.pts, { points: p.points }),
    })),
  };
}

const rowsOf = (rows: readonly ShowcaseRow[], locale: Locale): LeagueSportView["table"] => {
  const t = getDictionary(locale).landing.league;
  return rows.map((r) => ({ member: r.member, pts: format(t.pts, { points: r.points }) }));
};

/**
 * What the hero's league shows: the live demonstration league when the database answered (its real table per sport, its
 * last results with every friend's pick and points), else the built-in example, said so. Basketball is always « in
 * preparation » — no table, no result, no points — until a results source we are allowed to use exists.
 */
export function buildLeagueData(live: ShowcaseLeague | null, locale: Locale): LeagueData {
  const t = getDictionary(locale).landing.league;
  if (!live) {
    const sports = SPORTS.map((sport): LeagueSportView => {
      const v = sportView(sport);
      const ex = EXAMPLES[sport];
      return {
        sport,
        ready: SPORT_STATUS[sport] === "ready",
        competitions: [...v.competitions],
        table: v.rows.map((r) => ({ member: r.member, pts: r.points === null ? null : format(t.pts, { points: r.points }) })),
        results:
          SPORT_STATUS[sport] === "ready"
            ? [{ title: `${ex.home} ${ex.actual.home} – ${ex.actual.away} ${ex.away}`, home: ex.home, away: ex.away, score: { home: ex.actual.home, away: ex.actual.away }, meta: "", overtime: false, picks: v.rows.map((r) => ({ member: r.member, pick: score(r.pick.home, r.pick.away), pts: r.points === null ? null : format(t.pts, { points: r.points }) })) }]
            : [],
        seal: v.seal,
      };
    });
    return { source: "example", name: SHOWCASE_LEAGUE, sports, updated: null, friends: EXAMPLES.soccer.picks.length, sportsLive: sports.filter((s) => s.ready).length, picksScored: 0 };
  }
  const sports = SPORTS.map((sport): LeagueSportView => {
    const ready = SPORT_STATUS[sport] === "ready";
    const data = live.sports[sport];
    return {
      sport,
      ready,
      competitions: [...COMPETITIONS[sport]],
      table: ready ? rowsOf(data.table, locale) : live.table.map((r) => ({ member: r.member, pts: null })),
      results: ready ? data.results.map((r) => fromResult(r, locale, sport)) : [],
      seal: sportView(sport).seal,
    };
  });
  return {
    source: "league",
    name: live.name,
    sports,
    updated: live.updatedAt ? format(t.updated, { when: when(live.updatedAt, locale) }) : null,
    friends: live.table.length,
    sportsLive: sports.filter((s) => s.ready).length,
    picksScored: live.table.reduce((n, r) => n + r.predictions, 0),
  };
}
