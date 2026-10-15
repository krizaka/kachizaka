import { applyInOrder, type LeagueEvent, type MatchEvent, matchEventSchema, type MatchState, type RuleSet, ruleSetSchema, scorePrediction, sealHolds, standings as rank } from "@kachizaka/core";
import { and, asc, eq, gt, inArray, isNull, sql } from "drizzle-orm";

import type { Db, Tx } from "./client";
import { sealForKickoff } from "./leagues";
import { matches, matchEvents, members, predictions, predictionScores, ruleSets, seasons, standings } from "./schema";

/**
 * The live pipeline: match facts (from Orazaka's MCP sports-feed connector) → stored once → applied in order → the
 * match's predictions rescored → the season's standings recomputed — one transaction per delivery, the match row
 * locked, so two deliveries of the same facts never apply them twice. Returns what to broadcast; the caller publishes
 * it on @krizaka/realtime **after** the commit (the bus is best-effort, the database is the truth).
 */
export async function ingest(db: Db, matchId: string, received: readonly MatchEvent[]): Promise<{ applied: number; events: LeagueEvent[] }> {
  const facts = received.map((e) => matchEventSchema.parse(e));
  return db.transaction(async (tx) => {
    // Stored once: the same provider fact (or the same seq) twice is ignored.
    if (facts.length) {
      await tx
        .insert(matchEvents)
        .values(facts.map((e) => ({ matchId, providerEventId: e.providerEventId, seq: e.seq, kind: e.kind, payload: e })))
        .onConflictDoNothing();
    }
    const [m] = await tx.select().from(matches).where(eq(matches.id, matchId)).for("update");
    if (!m) throw new Error(`KZ_MATCH_UNKNOWN: ${matchId}`);
    const pending = await tx.select().from(matchEvents).where(and(eq(matchEvents.matchId, matchId), gt(matchEvents.seq, m.appliedSeq), isNull(matchEvents.appliedAt))).orderBy(asc(matchEvents.seq));
    const before: MatchState = { status: m.status, home: m.homeScore, away: m.awayScore, appliedSeq: m.appliedSeq };
    const { state, applied } = applyInOrder(before, pending.map((p) => matchEventSchema.parse(p.payload)));
    if (!applied.length) return { applied: 0, events: [] };

    const seal = before.status === "scheduled" && state.status !== "scheduled" ? await sealForKickoff(tx, matchId) : { ruleSetId: m.ruleSetId, seal: m.ruleSetSeal };
    await tx
      .update(matches)
      .set({ status: state.status, homeScore: state.home, awayScore: state.away, appliedSeq: state.appliedSeq, ruleSetId: seal.ruleSetId, ruleSetSeal: seal.seal })
      .where(eq(matches.id, matchId));
    await tx.update(matchEvents).set({ appliedAt: new Date() }).where(and(eq(matchEvents.matchId, matchId), inArray(matchEvents.seq, applied.map((e) => e.seq))));

    const events: LeagueEvent[] = [{ type: "match", matchId, status: state.status === "final" ? "final" : "live", home: state.home, away: state.away, seq: state.appliedSeq }];
    if (state.status !== "scheduled") {
      await rescoreMatch(tx, matchId);
      const version = await recomputeStandings(tx, m.seasonId);
      const [season] = await tx.select({ leagueId: seasons.leagueId }).from(seasons).where(eq(seasons.id, m.seasonId));
      events.push({ type: "standings", leagueId: season!.leagueId, seasonId: m.seasonId, version });
    }
    return { applied: applied.length, events };
  });
}

/** The rules a match is scored with — read with their seal, and refused if they no longer match it (never used tampered). */
async function sealedRules(tx: Tx, ruleSetId: string, seal: string): Promise<RuleSet> {
  const [rs] = await tx.select().from(ruleSets).where(eq(ruleSets.id, ruleSetId));
  const rules = ruleSetSchema.parse(rs?.rules);
  if (!rs || rs.seal !== seal || !sealHolds(rules, seal)) throw new Error(`KZ_SEAL_BROKEN: rule set ${ruleSetId} no longer matches its seal`);
  return rules;
}

/** Scores every prediction of a match against its current score (provisional until the final whistle). */
export async function rescoreMatch(tx: Tx, matchId: string): Promise<void> {
  const [m] = await tx.select().from(matches).where(eq(matches.id, matchId));
  if (!m?.ruleSetId || !m.ruleSetSeal) return;
  const rules = await sealedRules(tx, m.ruleSetId, m.ruleSetSeal);
  const rows = await tx.select().from(predictions).where(eq(predictions.matchId, matchId));
  for (const p of rows) {
    const scored = scorePrediction(rules, { home: p.home, away: p.away }, { home: m.homeScore, away: m.awayScore }, { final: m.isFinal });
    const values = { matchId, memberId: p.memberId, points: scored.points, breakdown: scored.breakdown, ruleSetSeal: m.ruleSetSeal, provisional: m.status !== "final", scoredAt: new Date() };
    await tx.insert(predictionScores).values({ predictionId: p.id, ...values }).onConflictDoUpdate({ target: predictionScores.predictionId, set: values });
  }
}

/** Recomputes the whole table of a season from the scores (never incrementally: a recomputation cannot drift). */
export async function recomputeStandings(tx: Tx, seasonId: string): Promise<number> {
  const [season] = await tx.select().from(seasons).where(eq(seasons.id, seasonId));
  const roster = await tx.select().from(members).where(eq(members.leagueId, season!.leagueId));
  const scores = await tx
    .select({ memberId: predictionScores.memberId, points: predictionScores.points, breakdown: predictionScores.breakdown })
    .from(predictionScores)
    .innerJoin(matches, eq(matches.id, predictionScores.matchId))
    .where(eq(matches.seasonId, seasonId));
  const table = rank(
    roster.map((r) => ({
      memberId: r.id,
      displayName: r.displayName,
      scored: scores.filter((s) => s.memberId === r.id).map((s) => ({ points: s.points, breakdown: s.breakdown as ReturnType<typeof scorePrediction>["breakdown"] })),
    })),
  );
  const [{ v } = { v: 0 }] = await tx.select({ v: sql<number>`coalesce(max(${standings.version}), 0)::int` }).from(standings).where(eq(standings.seasonId, seasonId));
  const version = v + 1;
  await tx.delete(standings).where(eq(standings.seasonId, seasonId));
  if (table.length) await tx.insert(standings).values(table.map((r) => ({ seasonId, memberId: r.memberId, rank: r.rank, points: r.points, exact: r.exact, predictions: r.predictions, version })));
  return version;
}
