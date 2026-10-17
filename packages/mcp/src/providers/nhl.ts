import { z } from "zod";

import type { Fixture } from "../contract";

/**
 * The NHL's public web API (`api-web.nhle.com`): the schedule and the scores of each game. It is an undocumented public
 * endpoint with no published licence (docs/research/market-2026-10.md §5): used server-side only, cached, at a low rate,
 * behind this adapter so it can be swapped; Orazaka's connector is meant to own it (AGENTS §2).
 */
const team = z.object({ commonName: z.object({ default: z.string() }), placeName: z.object({ default: z.string() }), abbrev: z.string(), score: z.number().int().optional() });
const game = z.object({
  id: z.number().int(),
  gameType: z.number().int(),
  startTimeUTC: z.string(),
  gameState: z.string(),
  homeTeam: team,
  awayTeam: team,
  gameOutcome: z.object({ lastPeriodType: z.string() }).optional(),
});
export const nhlScheduleSchema = z.object({ gameWeek: z.array(z.object({ date: z.string(), games: z.array(z.unknown()) })) });

const name = (t: z.infer<typeof team>) => `${t.placeName.default} ${t.commonName.default}`;
const PLAYED = new Set(["FINAL", "OFF"]);

/** The fixtures (and results) of a schedule answer; a game of another shape is skipped, never guessed. */
export function parseNhlSchedule(json: unknown, competition = "NHL"): Fixture[] {
  const week = nhlScheduleSchema.parse(json);
  const out: Fixture[] = [];
  for (const day of week.gameWeek) {
    for (const raw of day.games) {
      const g = game.safeParse(raw);
      if (!g.success) continue;
      const { homeTeam, awayTeam } = g.data;
      const played = PLAYED.has(g.data.gameState) && homeTeam.score !== undefined && awayTeam.score !== undefined && homeTeam.score !== awayTeam.score;
      out.push({
        sport: "hockey",
        competition,
        providerMatchId: `nhl:${g.data.id}`,
        homeTeam: name(homeTeam),
        awayTeam: name(awayTeam),
        kickoffAt: g.data.startTimeUTC.replace("Z", "+00:00"),
        isFinal: g.data.gameType === 3,
        ...(played ? { result: { home: homeTeam.score!, away: awayTeam.score!, overtime: g.data.gameOutcome?.lastPeriodType !== undefined && g.data.gameOutcome.lastPeriodType !== "REG" } } : {}),
      });
    }
  }
  return out;
}

const day = (d: Date) => d.toISOString().slice(0, 10);

/** The dates to ask for: the API answers a whole week from the date given. */
export function nhlWeeks(from: string, to: string): string[] {
  const out: string[] = [];
  for (const d = new Date(`${from}T00:00:00Z`); day(d) <= to; d.setUTCDate(d.getUTCDate() + 7)) out.push(day(d));
  return out;
}

export async function fetchNhl(input: { from: string; to: string }, doFetch: typeof fetch = fetch, base = "https://api-web.nhle.com"): Promise<Fixture[]> {
  const seen = new Map<string, Fixture>();
  for (const date of nhlWeeks(input.from, input.to)) {
    const res = await doFetch(`${base}/v1/schedule/${date}`, { headers: { accept: "application/json" }, signal: AbortSignal.timeout(15_000) });
    if (!res.ok) throw new Error(`NHL schedule answered ${res.status} for ${date}`);
    for (const f of parseNhlSchedule(await res.json())) seen.set(f.providerMatchId, f);
  }
  return [...seen.values()].filter((f) => f.kickoffAt.slice(0, 10) >= input.from && f.kickoffAt.slice(0, 10) <= input.to);
}
