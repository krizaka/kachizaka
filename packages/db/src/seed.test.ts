import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { accounts, matches, ruleSets, standings } from "./schema";
import { seedDemoLeague } from "./seed";
import { freshDatabase } from "./test/db";

let t: Awaited<ReturnType<typeof freshDatabase>>;
beforeAll(async () => {
  t = await freshDatabase();
});
afterAll(async () => t.drop());

describe("the demo league (real PostgreSQL 16)", () => {
  it("seeds a league whose rules were sealed by the real pipeline, once per account", async () => {
    await t.db.insert(accounts).values({ email: "qa@example.test" });
    const first = await seedDemoLeague(t.db, "QA@example.test");
    expect(first.created).toBe(true);
    const games = await t.db.select().from(matches);
    expect(games.map((g) => g.status).sort()).toEqual(["final", "live", "scheduled"]);
    const [rs] = await t.db.select().from(ruleSets).where(eq(ruleSets.leagueId, first.leagueId));
    expect(rs!.sealedAt).not.toBeNull();
    expect((await t.db.select().from(standings)).length).toBe(4);
    expect(await seedDemoLeague(t.db, "qa@example.test")).toEqual({ leagueId: first.leagueId, created: false });
  });
});
