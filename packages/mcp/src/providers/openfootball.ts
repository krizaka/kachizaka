import { z } from "zod";

import type { Fixture } from "../contract";

/**
 * openfootball (github.com/openfootball/football.json): public-domain (CC0 1.0) fixtures and results as JSON. Our
 * competitions: the Premier League and Ligue 1. A match has no provider id, so ours is the competition, the date and the
 * two teams. Times are the competition's local time (no zone in the file).
 */
export const COMPETITIONS = {
  "Premier League": { file: "en.1.json", zone: "Europe/London" },
  "Ligue 1": { file: "fr.1.json", zone: "Europe/Paris" },
} as const;
export type OpenFootballCompetition = keyof typeof COMPETITIONS;

const score = z.union([z.tuple([z.number().int(), z.number().int()]), z.object({ ft: z.tuple([z.number().int(), z.number().int()]) }).passthrough()]);
const match = z.object({ date: z.string(), time: z.string().optional(), team1: z.string(), team2: z.string(), score: score.optional() });

function zoneOffsetMs(at: number, zone: string): number {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-GB", { timeZone: zone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" }).formatToParts(new Date(at)).map((x) => [x.type, x.value]));
  return Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day), Number(p.hour), Number(p.minute), Number(p.second)) - at;
}

/** A local date and time in a zone, as the UTC instant (two passes: the offset can differ across a clock change). */
export function zonedToUtc(date: string, time: string, zone: string): Date {
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  const [hh, mm] = time.split(":").map(Number) as [number, number];
  const naive = Date.UTC(y, m - 1, d, hh, mm);
  const first = naive - zoneOffsetMs(naive, zone);
  return new Date(naive - zoneOffsetMs(first, zone));
}

const slug = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export function parseOpenFootball(json: unknown, competition: OpenFootballCompetition): Fixture[] {
  const { zone } = COMPETITIONS[competition];
  const matches = z.object({ matches: z.array(z.unknown()) }).parse(json).matches;
  const out: Fixture[] = [];
  for (const raw of matches) {
    const m = match.safeParse(raw);
    if (!m.success) continue;
    const time = /^(\d{1,2}):(\d{2})/.exec(m.data.time ?? "")?.slice(1, 3).map((x) => x.padStart(2, "0")).join(":") ?? "12:00";
    const ft = m.data.score ? (Array.isArray(m.data.score) ? m.data.score : m.data.score.ft) : undefined;
    out.push({
      sport: "soccer",
      competition,
      providerMatchId: `of:${slug(competition)}:${m.data.date}:${slug(m.data.team1)}-${slug(m.data.team2)}`,
      homeTeam: m.data.team1.replace(/ (FC|AFC)$/, ""),
      awayTeam: m.data.team2.replace(/ (FC|AFC)$/, ""),
      kickoffAt: zonedToUtc(m.data.date, time, zone).toISOString().replace("Z", "+00:00"),
      isFinal: false,
      ...(ft ? { result: { home: ft[0], away: ft[1], overtime: false } } : {}),
    });
  }
  return out;
}

/** The season directory of a date: August to July (« 2026-27 »). */
export function seasonDir(date: string): string {
  const y = Number(date.slice(0, 4));
  const start = Number(date.slice(5, 7)) >= 7 ? y : y - 1;
  return `${start}-${String(start + 1).slice(2)}`;
}

export async function fetchOpenFootball(competition: OpenFootballCompetition, input: { from: string; to: string }, doFetch: typeof fetch = fetch, base = "https://raw.githubusercontent.com/openfootball/football.json/master"): Promise<Fixture[]> {
  const dirs = [...new Set([seasonDir(input.from), seasonDir(input.to)])];
  const all: Fixture[] = [];
  for (const dir of dirs) {
    const res = await doFetch(`${base}/${dir}/${COMPETITIONS[competition].file}`, { signal: AbortSignal.timeout(20_000) });
    if (res.status === 404) continue;
    if (!res.ok) throw new Error(`openfootball answered ${res.status} for ${competition} ${dir}`);
    all.push(...parseOpenFootball(await res.json(), competition));
  }
  return all.filter((f) => f.kickoffAt.slice(0, 10) >= input.from && f.kickoffAt.slice(0, 10) <= input.to);
}
