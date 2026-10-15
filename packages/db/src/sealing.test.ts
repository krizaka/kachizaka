import { DEFAULT_RULES, sealOf } from "@kachizaka/core";
import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { changeRules, currentRuleSet } from "./leagues";
import { ingest, rescoreMatch } from "./pipeline";
import { matches, predictions, ruleSets } from "./schema";
import { freshDatabase, refusal } from "./test/db";
import { GAME, leagueWithMatch } from "./test/fixtures";

let t: Awaited<ReturnType<typeof freshDatabase>>;
beforeAll(async () => {
  t = await freshDatabase();
});
afterAll(async () => t.drop());

describe("sealed rules (real PostgreSQL 16)", () => {
  it("can change before the first kick-off, in place — nothing is sealed yet", async () => {
    const { league, ruleSet } = await leagueWithMatch(t.db);
    const changed = await changeRules(t.db, league.id, { ...DEFAULT_RULES, exactScore: 6 });
    expect(changed.id).toBe(ruleSet.id);
    expect(changed.version).toBe(1);
    expect(changed.sealedAt).toBeNull();
    expect(changed.seal).toBe(sealOf({ ...DEFAULT_RULES, exactScore: 6 }));
  });

  it("are sealed at kick-off: hash stored with the rules and with the match", async () => {
    const { league, match, ruleSet } = await leagueWithMatch(t.db);
    await ingest(t.db, match.id, GAME.slice(0, 1));
    const [rs] = await t.db.select().from(ruleSets).where(eq(ruleSets.id, ruleSet.id));
    const [m] = await t.db.select().from(matches).where(eq(matches.id, match.id));
    expect(rs!.sealedAt).not.toBeNull();
    expect(rs!.seal).toBe(sealOf(DEFAULT_RULES));
    expect(m).toMatchObject({ status: "live", ruleSetId: ruleSet.id, ruleSetSeal: sealOf(DEFAULT_RULES) });
    expect((await currentRuleSet(t.db, league.id))!.id).toBe(ruleSet.id);
  });

  it("refuses any change of a sealed rule set — by the database itself", async () => {
    const { match, ruleSet } = await leagueWithMatch(t.db);
    await ingest(t.db, match.id, GAME.slice(0, 1));
    expect(await refusal(t.db.update(ruleSets).set({ rules: { ...DEFAULT_RULES, exactScore: 50 } }).where(eq(ruleSets.id, ruleSet.id)))).toMatch(/KZ_RULESET_SEALED/);
    expect(await refusal(t.db.delete(ruleSets).where(eq(ruleSets.id, ruleSet.id)))).toMatch(/KZ_RULESET_SEALED/);
  });

  it("makes a change after kick-off a new version, which the running match never sees", async () => {
    const { league, match, ruleSet } = await leagueWithMatch(t.db);
    await ingest(t.db, match.id, GAME.slice(0, 1));
    const v2 = await changeRules(t.db, league.id, { ...DEFAULT_RULES, exactScore: 10 });
    expect(v2.version).toBe(2);
    expect(v2.id).not.toBe(ruleSet.id);
    await ingest(t.db, match.id, GAME.slice(1));
    const [m] = await t.db.select().from(matches).where(eq(matches.id, match.id));
    expect(m!.ruleSetId).toBe(ruleSet.id);
    // And the database refuses to move a running match onto the new version.
    expect(await refusal(t.db.update(matches).set({ ruleSetId: v2.id, ruleSetSeal: v2.seal }).where(eq(matches.id, match.id)))).toMatch(/KZ_MATCH_RULES_FIXED/);
  });

  it("refuses a match that starts without a sealed rule set of its league", async () => {
    const { match, ruleSet } = await leagueWithMatch(t.db);
    expect(await refusal(t.db.update(matches).set({ status: "live", ruleSetId: ruleSet.id, ruleSetSeal: ruleSet.seal }).where(eq(matches.id, match.id)))).toMatch(/KZ_MATCH_NOT_SEALED/);
    expect(await refusal(t.db.update(matches).set({ status: "live" }).where(eq(matches.id, match.id)))).toMatch(/matches_sealed_when_started|KZ_MATCH_NOT_SEALED/);
  });

  it("locks predictions at kick-off: no new one, no change, no withdrawal", async () => {
    const { match, members } = await leagueWithMatch(t.db);
    await ingest(t.db, match.id, GAME.slice(0, 1));
    expect(await refusal(t.db.update(predictions).set({ home: 2, away: 1 }).where(eq(predictions.memberId, members.chloe.id)))).toMatch(/KZ_PREDICTION_LOCKED/);
    expect(await refusal(t.db.delete(predictions).where(eq(predictions.memberId, members.bruno.id)))).toMatch(/KZ_PREDICTION_LOCKED/);
  });

  it("locks predictions by the clock too, before any fact arrives", async () => {
    const { match, members } = await leagueWithMatch(t.db);
    await t.db.update(matches).set({ kickoffAt: new Date(Date.now() - 1000) }).where(eq(matches.id, match.id));
    expect(await refusal(t.db.update(predictions).set({ home: 4, away: 4 }).where(eq(predictions.memberId, members.amina.id)))).toMatch(/KZ_PREDICTION_LOCKED/);
  });

  it("never scores with rules that no longer match their seal (a tampered row is noticed)", async () => {
    const { match, ruleSet } = await leagueWithMatch(t.db);
    await ingest(t.db, match.id, GAME.slice(0, 1));
    // Only a superuser bypassing the trigger could do this; the scorer still refuses the result.
    await t.pool.query("ALTER TABLE rule_sets DISABLE TRIGGER rule_sets_frozen");
    await t.db.update(ruleSets).set({ rules: { ...DEFAULT_RULES, exactScore: 99 } }).where(eq(ruleSets.id, ruleSet.id));
    await t.pool.query("ALTER TABLE rule_sets ENABLE TRIGGER rule_sets_frozen");
    expect(await refusal(t.db.transaction((tx) => rescoreMatch(tx, match.id)))).toMatch(/KZ_SEAL_BROKEN/);
  });

  it("has no money anywhere: no amount, stake, wallet, odds or bet column", async () => {
    const { rows } = await t.pool.query<{ column_name: string }>("SELECT column_name FROM information_schema.columns WHERE table_schema = 'public'");
    expect(rows.length).toBeGreaterThan(40);
    for (const { column_name } of rows) expect(column_name).not.toMatch(/amount|stake|wallet|odds|money|bet|payout|price|currency/);
    expect((await t.db.execute(sql`SELECT 1 AS ok`)).rows[0]).toEqual({ ok: 1 });
  });
});
