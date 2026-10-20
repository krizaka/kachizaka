import type { LeagueEvent } from "@kachizaka/core";
import type { SportsFeed } from "@kachizaka/mcp";
import { syncFixtures } from "@kachizaka/mcp";
import { eq } from "drizzle-orm";

import type { Db } from "./client";
import { devFeed } from "./feed";
import { upsertFixtures } from "./fixtures";
import { ingest } from "./pipeline";
import { seasons } from "./schema";

export interface SyncOptions {
  /** Where fixtures and results come from; the one adapter module (`feed.ts`) by default. */
  feed?: SportsFeed;
  now: Date;
  /** Days back (results of games played since) and ahead (fixtures to pick), from `now`. */
  back?: number;
  ahead?: number;
  /** Narrows every open season to these competitions. */
  competitions?: readonly string[];
  /** Told about every change the pipeline made (the app broadcasts them after the commit). */
  publish?: (event: LeagueEvent) => Promise<void> | void;
}

/**
 * One pass of the results sync over every open season: store the fixtures of the competitions it follows, close the games
 * the feed says are over (facts applied once and in order, the table recomputed, the picks scored by the sealed rules).
 * Idempotent — a second pass over the same results changes nothing. Run by the dev runner (`scripts/sync.ts`) and by the
 * scheduled call of the app (`POST /api/internal/sync`).
 */
export async function runSync(db: Db, options: SyncOptions) {
  const feed = options.feed ?? devFeed();
  const day = (offset: number) => {
    const d = new Date(options.now);
    d.setUTCDate(d.getUTCDate() + offset);
    return d.toISOString().slice(0, 10);
  };
  const total = { seasons: 0, fixtures: 0, closed: 0, failed: [] as { competition: string; reason: string }[] };
  for (const season of await db.select().from(seasons).where(eq(seasons.status, "open"))) {
    const only = options.competitions;
    const competitions = only?.length ? season.competitions.filter((c) => only.includes(c)) : season.competitions;
    if (!competitions.length) continue;
    const out = await syncFixtures({
      feed,
      competitions,
      from: day(-(options.back ?? 3)),
      to: day(options.ahead ?? 14),
      upsert: (fixtures) => upsertFixtures(db, season.id, "results", fixtures),
      ingest: (matchId, events) => ingest(db, matchId, events),
      ...(options.publish ? { publish: options.publish } : {}),
    });
    total.seasons++;
    total.fixtures += out.fixtures;
    total.closed += out.closed;
    total.failed.push(...out.failed);
  }
  return total;
}
