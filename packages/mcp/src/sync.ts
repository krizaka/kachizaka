import { type LeagueEvent, MATCH_STATUS, type MatchEvent } from "@kachizaka/core";

import type { Fixture, SportsFeed } from "./contract";
import { resultEvents } from "./providers/results";

/**
 * One pass of the live loop for one match: ask the feed for the facts after the last applied one, hand them to the
 * pipeline (`@kachizaka/db` `ingest`, which stores them once and applies them in order), then broadcast what changed
 * (`@krizaka/realtime`, after the commit). Pure wiring: the three steps are given, so this is tested with fakes.
 */
export async function syncMatch(deps: {
  feed: SportsFeed;
  match: { id: string; providerMatchId: string; appliedSeq: number };
  ingest: (matchId: string, events: MatchEvent[]) => Promise<{ applied: number; events: LeagueEvent[] }>;
  publish: (event: LeagueEvent) => Promise<void> | void;
}): Promise<{ received: number; applied: number }> {
  const { events } = await deps.feed.events({ providerMatchId: deps.match.providerMatchId, afterSeq: deps.match.appliedSeq });
  if (!events.length) return { received: 0, applied: 0 };
  const result = await deps.ingest(deps.match.id, events);
  for (const e of result.events) await deps.publish(e);
  return { received: events.length, applied: result.applied };
}

/**
 * One pass over the competitions a season follows: ask the feed for their fixtures, store them (`upsert` returns each
 * game's id and status), and for every game the feed says is over but we have not closed, hand its result to the pipeline
 * (`ingest`: facts stored once, applied in order, the table recomputed). Pure wiring, tested with fakes. A competition
 * the feed cannot answer is reported, never allowed to stop the others.
 */
export async function syncFixtures(deps: {
  feed: SportsFeed;
  competitions: readonly string[];
  from: string;
  to: string;
  upsert: (fixtures: Fixture[]) => Promise<{ id: string; providerMatchId: string; status: "scheduled" | "live" | "final" }[]>;
  ingest: (matchId: string, events: MatchEvent[]) => Promise<{ applied: number; events: LeagueEvent[] }>;
  publish?: (event: LeagueEvent) => Promise<void> | void;
}): Promise<{ fixtures: number; closed: number; failed: { competition: string; reason: string }[] }> {
  let fixtures = 0;
  let closed = 0;
  const failed: { competition: string; reason: string }[] = [];
  for (const competition of deps.competitions) {
    try {
      const { fixtures: list } = await deps.feed.fixtures({ competition, from: deps.from, to: deps.to });
      fixtures += list.length;
      const rows = await deps.upsert(list);
      for (const f of list) {
        const row = rows.find((r) => r.providerMatchId === f.providerMatchId);
        if (!f.result || !row || row.status === MATCH_STATUS.final) continue;
        const result = await deps.ingest(row.id, resultEvents(f));
        for (const e of result.events) await deps.publish?.(e);
        if (result.applied) closed++;
      }
    } catch (error) {
      failed.push({ competition, reason: error instanceof Error ? error.message : String(error) });
    }
  }
  return { fixtures, closed, failed };
}
