import type { Fixture, FixturesInput, FixturesOutput, SportsFeed } from "../contract";
import { fetchNhl } from "./nhl";
import { ESPN_LEAGUES, withEspnResults } from "./espn";
import { COMPETITIONS, fetchOpenFootball, type OpenFootballCompetition } from "./openfootball";
import { resultEvents } from "./results";

export { fetchNhl, nhlWeeks, parseNhlSchedule } from "./nhl";
export { COMPETITIONS, fetchOpenFootball, parseOpenFootball, seasonDir, zonedToUtc } from "./openfootball";
export { resultEvents } from "./results";
export { ESPN_LEAGUES, espnResultsFor, parseEspnScoreboard, sameTeam, withEspnResults } from "./espn";

/** What a competition is, which sport, and where its data comes from and under which licence — shown on the page that uses it. */
export const COMPETITION_SOURCES = {
  NHL: { sport: "hockey", provider: "NHL web API", licence: "undocumented public endpoint, no published licence" },
  "Premier League": { sport: "soccer", provider: "openfootball", licence: "CC0 1.0" },
  "Ligue 1": { sport: "soccer", provider: "openfootball", licence: "CC0 1.0" },
} as const;
export type CompetitionId = keyof typeof COMPETITION_SOURCES;

/** A small read-through cache with a time to live: one ask of a provider serves everyone for a while. */
export class TtlCache<T> {
  private readonly items = new Map<string, { at: number; value: T }>();
  constructor(
    private readonly ttlMs: number,
    private readonly now: () => number = Date.now,
  ) {}
  async get(key: string, load: () => Promise<T>): Promise<T> {
    const hit = this.items.get(key);
    if (hit && this.now() - hit.at < this.ttlMs) return hit.value;
    const value = await load();
    this.items.set(key, { at: this.now(), value });
    return value;
  }
}

/**
 * `unlicensed: true` (local runners only — the deployed app asks `unlicensedSourcesAllowed`, `apps/web/lib/sync-auth.ts`, and never shares such a result with www) lets the feed use the sources whose
 * terms do not allow a public product (ESPN's scoreboard for soccer results); without it the game stays « to play ».
 *
 * The results feed of the competitions above, behind the connector contract: `fixtures` asks the competition's provider
 * (cached), `events` turns a played game's result into facts. Soccer and hockey today; MLS, the Champions League and
 * basketball wait for a source whose licence allows the use (see the research doc).
 */
export function resultsFeed(options: { fetch?: typeof fetch; cache?: TtlCache<Fixture[]>; now?: () => number; unlicensed?: boolean } = {}): SportsFeed & { provider: string } {
  const doFetch = options.fetch ?? fetch;
  const now = options.now ?? Date.now;
  const cache = options.cache ?? new TtlCache<Fixture[]>(10 * 60_000);
  const known = new Map<string, Fixture>();
  return {
    provider: "results",
    async fixtures(input: FixturesInput): Promise<FixturesOutput> {
      const key = `${input.competition}|${input.from}|${input.to}`;
      const fixtures = await cache.get(key, async () => {
        if (input.competition === "NHL") return fetchNhl(input, doFetch);
        if (input.competition in COMPETITIONS) {
          const planned = await fetchOpenFootball(input.competition as OpenFootballCompetition, input, doFetch);
          // openfootball's scores stopped on 2026-09-20: the games already played take their result from the second source.
          if (!options.unlicensed) return planned; // ESPN: non-licensed, dev only — a licensed source is required before any public launch
          return withEspnResults(input.competition as keyof typeof ESPN_LEAGUES, planned, now(), doFetch).catch(() => planned);
        }
        throw new Error(`KZ_COMPETITION_UNKNOWN: ${input.competition}`);
      });
      for (const f of fixtures) known.set(f.providerMatchId, f);
      return { provider: "results", fixtures };
    },
    async events(input) {
      const f = known.get(input.providerMatchId);
      return { provider: "results", providerMatchId: input.providerMatchId, events: f ? resultEvents(f).filter((e) => e.seq > input.afterSeq) : [] };
    },
  };
}
