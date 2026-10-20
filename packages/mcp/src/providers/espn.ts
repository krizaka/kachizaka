import { z } from "zod";

import type { Fixture } from "../contract";

/**
 * A second source for the results of the soccer competitions. openfootball (CC0) publishes the fixtures but its
 * volunteers stopped updating the scores on 2026-09-20, so a game played since stays « to play » for ever. ESPN's public
 * scoreboard (`site.api.espn.com`) answers the results of a day. Like the NHL's, it is an undocumented public endpoint
 * with no published licence for this use: server-side only, cached, one request per day of games, used for the RESULT only
 * (the fixture stays openfootball's), and swappable here — it is one of the two files to drop when Orazaka's connector
 * (krizaka/kachizaka#59) brings a licensed source (docs/data-sources.md).
 */
export const ESPN_LEAGUES = { "Premier League": "eng.1", "Ligue 1": "fra.1" } as const;

export interface EspnGame {
  at: string;
  home: string;
  away: string;
  homeScore: number;
  awayScore: number;
}

const competitor = z.object({ homeAway: z.string(), score: z.string().optional(), team: z.object({ displayName: z.string() }) });
const event = z.object({ date: z.string(), status: z.object({ type: z.object({ name: z.string() }) }), competitions: z.array(z.object({ competitors: z.array(competitor) })).min(1) });

/** The games of a scoreboard that are over (full time), with their score; anything else is skipped, never guessed. */
export function parseEspnScoreboard(json: unknown): EspnGame[] {
  const events = z.object({ events: z.array(z.unknown()).default([]) }).parse(json).events;
  const out: EspnGame[] = [];
  for (const raw of events) {
    const e = event.safeParse(raw);
    if (!e.success || e.data.status.type.name !== "STATUS_FULL_TIME") continue;
    const cs = e.data.competitions[0]!.competitors;
    const home = cs.find((c) => c.homeAway === "home");
    const away = cs.find((c) => c.homeAway === "away");
    const hs = Number(home?.score);
    const as = Number(away?.score);
    if (!home || !away || !Number.isInteger(hs) || !Number.isInteger(as)) continue;
    const at = new Date(e.data.date);
    if (Number.isNaN(at.getTime())) continue;
    out.push({ at: at.toISOString().replace("Z", "+00:00"), home: home.team.displayName, away: away.team.displayName, homeScore: hs, awayScore: as });
  }
  return out;
}

const NOISE = new Set(["fc", "afc", "ac", "sc", "sco", "osc", "rc", "as", "de", "du", "le", "la", "olympique", "club", "racing", "stade"]);
const words = (name: string) =>
  name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);

/** Whether two spellings (« RC Strasbourg Alsace », « Strasbourg ») name one team: the shorter one's words all appear in the other. */
export function sameTeam(a: string, b: string): boolean {
  const wa = words(a);
  const wb = words(b);
  const [short, long] = wa.length <= wb.length ? [wa, wb] : [wb, wa];
  const core = short.filter((w) => !NOISE.has(w));
  const key = core.length ? core : short;
  if (!key.length || !key.every((w) => long.includes(w) || long.some((l) => l.startsWith(w) && w.length >= 4))) return false;
  // « Paris FC » is not « Paris Saint-Germain »: a distinguishing tag the longer name lacks, next to words the shorter lacks.
  const tag = short.some((w) => NOISE.has(w) && !long.includes(w));
  const more = long.some((w) => !NOISE.has(w) && !short.includes(w));
  return !(tag && more);
}

const WINDOW_MS = 2 * 3_600_000;

/** The fixtures with the result of the games that have none, found by kick-off and teams; two equal fits, or none, leave the game as it was. */
export function espnResultsFor(fixtures: Fixture[], games: EspnGame[]): Fixture[] {
  return fixtures.map((f) => {
    if (f.result) return f;
    const at = Date.parse(f.kickoffAt);
    const fits = games
      .map((g) => ({ g, fit: Number(sameTeam(f.homeTeam, g.home)) + Number(sameTeam(f.awayTeam, g.away)), near: Math.abs(Date.parse(g.at) - at) <= WINDOW_MS }))
      .filter((c) => c.near && c.fit > 0)
      .sort((x, y) => y.fit - x.fit);
    const best = fits[0];
    if (!best || (fits[1] && fits[1].fit === best.fit)) return f;
    return { ...f, result: { home: best.g.homeScore, away: best.g.awayScore, overtime: false } };
  });
}

const compact = (d: string) => d.replaceAll("-", "");
const nextDay = (d: string) => new Date(Date.parse(`${d}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10);

/** Fills the results of the played games that lack one: one scoreboard request per day those games fall on (and the next, for a late kick-off). */
export async function withEspnResults(competition: keyof typeof ESPN_LEAGUES, fixtures: Fixture[], now: number, doFetch: typeof fetch = fetch, base = "https://site.api.espn.com"): Promise<Fixture[]> {
  const pending = fixtures.filter((f) => !f.result && Date.parse(f.kickoffAt) + 3 * 3_600_000 < now);
  if (!pending.length) return fixtures;
  const days = [...new Set(pending.flatMap((f) => [f.kickoffAt.slice(0, 10), nextDay(f.kickoffAt.slice(0, 10))]))].sort();
  const games = new Map<string, EspnGame>();
  for (const day of days) {
    const res = await doFetch(`${base}/apis/site/v2/sports/soccer/${ESPN_LEAGUES[competition]}/scoreboard?dates=${compact(day)}`, { signal: AbortSignal.timeout(15_000) });
    if (!res.ok) throw new Error(`ESPN answered ${res.status} for ${competition} ${day}`);
    for (const g of parseEspnScoreboard(await res.json())) games.set(`${g.at}|${g.home}|${g.away}`, g);
  }
  return espnResultsFor(fixtures, [...games.values()]);
}
