import { DEFAULT_RULES, type RuleSet, ruleSetSchema, sealOf } from "@kachizaka/core";
import { and, desc, eq } from "drizzle-orm";

import type { Db, Tx } from "./client";
import { leagues, matches, members, ruleSets, seasons } from "./schema";

/** Creates a league with its owner as first member and its first rule set (version 1, not sealed yet). */
export async function createLeague(db: Db, input: { name: string; ownerId: string | null; ownerName: string; rules?: RuleSet }) {
  return db.transaction(async (tx) => {
    const [league] = await tx.insert(leagues).values({ name: input.name, ownerId: input.ownerId }).returning();
    const [owner] = await tx.insert(members).values({ leagueId: league!.id, accountId: input.ownerId, displayName: input.ownerName, role: "owner" }).returning();
    const rules = ruleSetSchema.parse(input.rules ?? DEFAULT_RULES);
    const [ruleSet] = await tx.insert(ruleSets).values({ leagueId: league!.id, version: 1, rules, seal: sealOf(rules) }).returning();
    return { league: league!, owner: owner!, ruleSet: ruleSet! };
  });
}

/** The rule set in force for the next kick-off: the league's latest version. */
export async function currentRuleSet(db: Db | Tx, leagueId: string) {
  const [row] = await db.select().from(ruleSets).where(eq(ruleSets.leagueId, leagueId)).orderBy(desc(ruleSets.version)).limit(1);
  return row ?? null;
}

/**
 * Changes a league's rules. Before the first kick-off, the current version is edited in place (it is not sealed yet);
 * after it, a new version is created — it applies to matches not yet kicked off, never to a match already running
 * or finished (they keep the seal they started with). The database refuses any edit of a sealed version anyway.
 */
export async function changeRules(db: Db, leagueId: string, rules: RuleSet) {
  const valid = ruleSetSchema.parse(rules);
  return db.transaction(async (tx) => {
    const current = await currentRuleSet(tx, leagueId);
    if (current && !current.sealedAt) {
      const [row] = await tx.update(ruleSets).set({ rules: valid, seal: sealOf(valid) }).where(eq(ruleSets.id, current.id)).returning();
      return row!;
    }
    const [row] = await tx.insert(ruleSets).values({ leagueId, version: (current?.version ?? 0) + 1, rules: valid, seal: sealOf(valid) }).returning();
    return row!;
  });
}

/**
 * The kick-off seal: in the match's transaction, the league's current rule set is sealed (if it was not already) and
 * the match takes its id and seal. Called by the pipeline when the first fact of a match arrives.
 */
export async function sealForKickoff(tx: Tx, matchId: string): Promise<{ ruleSetId: string; seal: string }> {
  const [m] = await tx.select({ seasonId: matches.seasonId, ruleSetId: matches.ruleSetId, ruleSetSeal: matches.ruleSetSeal }).from(matches).where(eq(matches.id, matchId));
  if (!m) throw new Error(`KZ_MATCH_UNKNOWN: ${matchId}`);
  if (m.ruleSetId && m.ruleSetSeal) return { ruleSetId: m.ruleSetId, seal: m.ruleSetSeal };
  const [season] = await tx.select({ leagueId: seasons.leagueId }).from(seasons).where(eq(seasons.id, m.seasonId));
  const rs = await currentRuleSet(tx, season!.leagueId);
  if (!rs) throw new Error(`KZ_NO_RULES: league ${season!.leagueId}`);
  if (!rs.sealedAt) await tx.update(ruleSets).set({ sealedAt: new Date() }).where(and(eq(ruleSets.id, rs.id)));
  return { ruleSetId: rs.id, seal: rs.seal };
}
