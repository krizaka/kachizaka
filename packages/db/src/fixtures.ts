import { MATCH_STATUS } from "@kachizaka/core";
import { and, eq, inArray } from "drizzle-orm";

import type { Db } from "./client";
import { matches } from "./schema";

/** A fixture as the connector delivers it (@kachizaka/mcp's `Fixture`), the fields the matches table keeps. */
export interface FixtureRow {
  sport: "soccer" | "hockey" | "basketball";
  competition?: string;
  providerMatchId: string;
  homeTeam: string;
  awayTeam: string;
  kickoffAt: string;
  isFinal: boolean;
}

/**
 * Stores the fixtures of a season: a new game is inserted; a game still scheduled follows its provider's kick-off time and
 * names; a game that has started is never touched (its rules and facts are fixed). Idempotent: the same fixtures twice
 * change nothing. Returns each game's id and status so the caller can close the ones that are over.
 */
export async function upsertFixtures(db: Db, seasonId: string, provider: string, fixtures: readonly FixtureRow[]): Promise<{ id: string; providerMatchId: string; status: "scheduled" | "live" | "final" }[]> {
  if (!fixtures.length) return [];
  return db.transaction(async (tx) => {
    const ids = fixtures.map((f) => f.providerMatchId);
    const existing = await tx.select().from(matches).where(and(eq(matches.seasonId, seasonId), eq(matches.provider, provider), inArray(matches.providerMatchId, ids)));
    const byId = new Map(existing.map((m) => [m.providerMatchId, m]));
    const fresh = fixtures.filter((f) => !byId.has(f.providerMatchId));
    if (fresh.length) {
      await tx
        .insert(matches)
        .values(fresh.map((f) => ({ seasonId, provider, providerMatchId: f.providerMatchId, sport: f.sport, competition: f.competition ?? null, homeTeam: f.homeTeam, awayTeam: f.awayTeam, kickoffAt: new Date(f.kickoffAt), isFinal: f.isFinal })))
        .onConflictDoNothing();
    }
    for (const f of fixtures) {
      const m = byId.get(f.providerMatchId);
      if (!m || m.status !== MATCH_STATUS.scheduled) continue;
      const kickoffAt = new Date(f.kickoffAt);
      if (m.kickoffAt.getTime() !== kickoffAt.getTime() || m.homeTeam !== f.homeTeam || m.awayTeam !== f.awayTeam || m.isFinal !== f.isFinal) {
        await tx.update(matches).set({ kickoffAt, homeTeam: f.homeTeam, awayTeam: f.awayTeam, isFinal: f.isFinal }).where(eq(matches.id, m.id));
      }
    }
    const rows = await tx.select({ id: matches.id, providerMatchId: matches.providerMatchId, status: matches.status }).from(matches).where(and(eq(matches.seasonId, seasonId), eq(matches.provider, provider), inArray(matches.providerMatchId, ids)));
    return rows;
  });
}
