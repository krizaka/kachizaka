import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createInvite, createLeagueWithSeason, inviteLeague, joinWithInvite, PlayError, revokeInvites, savePick, seasonOf } from "./play";
import { accounts, leagueInvites, matches, members, predictions, seasons } from "./schema";
import { freshDatabase } from "./test/db";

let t: Awaited<ReturnType<typeof freshDatabase>>;
beforeAll(async () => {
  t = await freshDatabase();
});
afterAll(async () => t.drop());

const NOW = new Date("2026-10-17T15:00:00Z");
const account = async (email: string) => (await t.db.insert(accounts).values({ email }).returning())[0]!;
const code = async (p: Promise<unknown>) => {
  try {
    await p;
  } catch (e) {
    return e instanceof PlayError ? e.code : String(e);
  }
  return "none";
};

describe("the season of a date", () => {
  it("runs July to June", () => {
    expect(seasonOf(new Date("2026-10-17T00:00:00Z"))).toEqual({ label: "2026–27", startsOn: "2026-07-01", endsOn: "2027-06-30" });
    expect(seasonOf(new Date("2027-03-01T00:00:00Z")).label).toBe("2026–27");
  });
});

describe("creating a league, inviting, joining and picking (real PostgreSQL 16)", () => {
  it("creates a league with its owner, three rule sets and the season following the chosen competitions", async () => {
    const owner = await account("eric@example.com");
    const { league, season, ruleSets: sets } = await createLeagueWithSeason(t.db, { name: "La gang du vendredi", ownerId: owner.id, ownerName: "Éric", competitions: ["NHL", "Premier League"], now: NOW });
    expect(sets).toHaveLength(3);
    expect(season).toMatchObject({ label: "2026–27", competitions: ["NHL", "Premier League"], competition: "NHL · Premier League" });
    expect((await t.db.select().from(members).where(eq(members.leagueId, league.id)))[0]).toMatchObject({ displayName: "Éric", role: "owner" });
  });

  it("keeps only the hash of an invite token, and lets several friends join once each, under a free name", async () => {
    const owner = await account("o@example.com");
    const { league, owner: me } = await createLeagueWithSeason(t.db, { name: "L", ownerId: owner.id, ownerName: "Éric", competitions: ["NHL"], now: NOW });
    const { token } = await createInvite(t.db, { leagueId: league.id, memberId: me.id, now: NOW });
    const stored = await t.db.select().from(leagueInvites).where(eq(leagueInvites.leagueId, league.id));
    expect(JSON.stringify(stored)).not.toContain(token);
    expect(await inviteLeague(t.db, token, NOW)).toMatchObject({ name: "L" });
    const a = await account("salma@example.com");
    const b = await account("other@example.com");
    expect(await joinWithInvite(t.db, { token, accountId: a.id, displayName: "Éric", now: NOW })).toMatchObject({ joined: true });
    const again = await joinWithInvite(t.db, { token, accountId: a.id, displayName: "Éric", now: NOW });
    expect(again.joined).toBe(false);
    await joinWithInvite(t.db, { token, accountId: b.id, displayName: "Éric", now: NOW });
    const names = (await t.db.select({ n: members.displayName }).from(members).where(eq(members.leagueId, league.id))).map((r) => r.n).sort();
    expect(names).toEqual(["Éric", "Éric 2", "Éric 3"]);
  });

  it("refuses an expired, a revoked and an unknown invite", async () => {
    const owner = await account("o2@example.com");
    const { league, owner: me } = await createLeagueWithSeason(t.db, { name: "L2", ownerId: owner.id, ownerName: "Éric", competitions: ["NHL"], now: NOW });
    const { token } = await createInvite(t.db, { leagueId: league.id, memberId: me.id, now: NOW });
    const joiner = await account("j@example.com");
    expect(await code(joinWithInvite(t.db, { token, accountId: joiner.id, displayName: "J", now: new Date("2026-11-30T00:00:00Z") }))).toBe("INVITE_INVALID");
    await revokeInvites(t.db, league.id, NOW);
    expect(await code(joinWithInvite(t.db, { token, accountId: joiner.id, displayName: "J", now: NOW }))).toBe("INVITE_INVALID");
    expect(await code(joinWithInvite(t.db, { token: "kzi_nope", accountId: joiner.id, displayName: "J", now: NOW }))).toBe("INVITE_INVALID");
  });

  it("saves a pick in its sport's shape, replaces it, and refuses a stranger, a foreign match, a wrong shape and a locked match", async () => {
    const owner = await account("o3@example.com");
    const { league, owner: me, season } = await createLeagueWithSeason(t.db, { name: "L3", ownerId: owner.id, ownerName: "Éric", competitions: ["NHL"], now: NOW });
    const mk = async (sport: "hockey" | "basketball", kickoffAt: Date) => (await t.db.insert(matches).values({ seasonId: season.id, sport, provider: "x", providerMatchId: crypto.randomUUID(), homeTeam: "A", awayTeam: "B", kickoffAt }).returning())[0]!;
    const future = new Date("2099-01-01T00:00:00Z");
    const hockey = await mk("hockey", future);
    const basket = await mk("basketball", future);
    await savePick(t.db, { leagueId: league.id, memberId: me.id, matchId: hockey.id, pick: { home: 3, away: 2, overtime: true } });
    await savePick(t.db, { leagueId: league.id, memberId: me.id, matchId: hockey.id, pick: { home: 4, away: 1 } });
    const [p] = await t.db.select().from(predictions).where(eq(predictions.matchId, hockey.id));
    expect(p).toMatchObject({ home: 4, away: 1, overtime: false });
    await savePick(t.db, { leagueId: league.id, memberId: me.id, matchId: basket.id, pick: { winner: "away", band: 2 } });
    expect(await code(savePick(t.db, { leagueId: league.id, memberId: me.id, matchId: basket.id, pick: { winner: "away", band: 9 } }))).toBe("PICK_INVALID");
    expect(await code(savePick(t.db, { leagueId: league.id, memberId: me.id, matchId: hockey.id, pick: { home: 2, away: 2 } }))).toBe("PICK_INVALID");
    const stranger = await account("s@example.com");
    const other = await createLeagueWithSeason(t.db, { name: "X", ownerId: stranger.id, ownerName: "S", competitions: ["NHL"], now: NOW });
    expect(await code(savePick(t.db, { leagueId: league.id, memberId: other.owner.id, matchId: hockey.id, pick: { home: 1, away: 0 } }))).toBe("NOT_A_MEMBER");
    expect(await code(savePick(t.db, { leagueId: other.league.id, memberId: other.owner.id, matchId: hockey.id, pick: { home: 1, away: 0 } }))).toBe("MATCH_UNKNOWN");
    const gone = await mk("hockey", new Date("2020-01-01T00:00:00Z"));
    expect(await code(savePick(t.db, { leagueId: league.id, memberId: me.id, matchId: gone.id, pick: { home: 1, away: 0 } }))).toBe("PICK_LOCKED");
    expect((await t.db.select().from(seasons).where(eq(seasons.id, season.id)))[0]).toBeTruthy();
  });
});
