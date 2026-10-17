import { type AnyRuleSet, defaultRulesFor, parseRulesFor, type RuleSet, sealOfFor, SPORT_IDS, type SportId } from "@kachizaka/core";
import { and, desc, eq } from "drizzle-orm";

import type { Db, Tx } from "./client";
import { leagues, matches, members, ruleSets, seasons } from "./schema";

/**
 * Creates a league with its owner as first member and its first rule sets: one per sport (version 1, not sealed yet),
 * each from the sport's default unless given. `rules` is soccer's, kept for the callers that predate several sports.
 */
export async function createLeague(db: Db, input: { name: string; ownerId: string | null; ownerName: string; rules?: RuleSet; rulesBySport?: Partial<Record<SportId, AnyRuleSet>> }) {
  return db.transaction(async (tx) => {
    const [league] = await tx.insert(leagues).values({ name: input.name, ownerId: input.ownerId }).returning();
    const [owner] = await tx.insert(members).values({ leagueId: league!.id, accountId: input.ownerId, displayName: input.ownerName, role: "owner" }).returning();
    const sets: (typeof ruleSets.$inferSelect)[] = [];
    for (const sport of SPORT_IDS) {
      const rules = parseRulesFor(sport, input.rulesBySport?.[sport] ?? (sport === "soccer" ? input.rules : undefined) ?? defaultRulesFor(sport));
      const [row] = await tx.insert(ruleSets).values({ leagueId: league!.id, sport, version: 1, rules, seal: sealOfFor(sport, rules) }).returning();
      sets.push(row!);
    }
    return { league: league!, owner: owner!, ruleSet: sets.find((r) => r.sport === "soccer")!, ruleSets: sets };
  });
}

/** The rule set in force for the next kick-off of a sport: the league's latest version of it. */
export async function currentRuleSet(db: Db | Tx, leagueId: string, sport: SportId = "soccer") {
  const [row] = await db.select().from(ruleSets).where(and(eq(ruleSets.leagueId, leagueId), eq(ruleSets.sport, sport))).orderBy(desc(ruleSets.version)).limit(1);
  return row ?? null;
}

/**
 * Changes a league's rules. Before the first kick-off, the current version is edited in place (it is not sealed yet);
 * after it, a new version is created — it applies to matches not yet kicked off, never to a match already running
 * or finished (they keep the seal they started with). The database refuses any edit of a sealed version anyway.
 */
export async function changeRules(db: Db, leagueId: string, rules: AnyRuleSet, sport: SportId = "soccer") {
  const valid = parseRulesFor(sport, rules);
  const seal = sealOfFor(sport, valid);
  return db.transaction(async (tx) => {
    const current = await currentRuleSet(tx, leagueId, sport);
    if (current && !current.sealedAt) {
      const [row] = await tx.update(ruleSets).set({ rules: valid, seal }).where(eq(ruleSets.id, current.id)).returning();
      return row!;
    }
    const [row] = await tx.insert(ruleSets).values({ leagueId, sport, version: (current?.version ?? 0) + 1, rules: valid, seal }).returning();
    return row!;
  });
}

/**
 * The kick-off seal: in the match's transaction, the league's current rule set is sealed (if it was not already) and
 * the match takes its id and seal. Called by the pipeline when the first fact of a match arrives.
 */
export async function sealForKickoff(tx: Tx, matchId: string): Promise<{ ruleSetId: string; seal: string }> {
  const [m] = await tx.select({ seasonId: matches.seasonId, sport: matches.sport, ruleSetId: matches.ruleSetId, ruleSetSeal: matches.ruleSetSeal }).from(matches).where(eq(matches.id, matchId));
  if (!m) throw new Error(`KZ_MATCH_UNKNOWN: ${matchId}`);
  if (m.ruleSetId && m.ruleSetSeal) return { ruleSetId: m.ruleSetId, seal: m.ruleSetSeal };
  const [season] = await tx.select({ leagueId: seasons.leagueId }).from(seasons).where(eq(seasons.id, m.seasonId));
  const rs = await currentRuleSet(tx, season!.leagueId, m.sport);
  if (!rs) throw new Error(`KZ_NO_RULES: league ${season!.leagueId} has no ${m.sport} rules`);
  if (!rs.sealedAt) await tx.update(ruleSets).set({ sealedAt: new Date() }).where(and(eq(ruleSets.id, rs.id)));
  return { ruleSetId: rs.id, seal: rs.seal };
}
