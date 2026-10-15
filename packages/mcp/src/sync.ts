import type { LeagueEvent, MatchEvent } from "@kachizaka/core";

import type { SportsFeed } from "./contract";

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
