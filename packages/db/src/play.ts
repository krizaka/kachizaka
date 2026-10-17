import { createHash, randomBytes } from "node:crypto";

import { type BasketballPick, type HockeyPick, parsePick, type Pick, type Score, type SportId } from "@kachizaka/core";
import { and, desc, eq, isNull } from "drizzle-orm";

import type { Db } from "./client";
import { createLeague } from "./leagues";
import { leagueInvites, leagues, matches, members, predictions, ruleSets, seasons } from "./schema";

/** What a refused action says: a stable code the app translates (never a database message). */
export class PlayError extends Error {
  constructor(
    readonly code: "INVITE_INVALID" | "NOT_A_MEMBER" | "MATCH_UNKNOWN" | "PICK_INVALID" | "PICK_LOCKED" | "COMPETITION_UNKNOWN",
    message: string,
  ) {
    super(message);
    this.name = "PlayError";
  }
}

/** The season a date falls in: July to June, « 2026–27 ». */
export function seasonOf(now: Date): { label: string; startsOn: string; endsOn: string } {
  const month = now.getUTCMonth() + 1;
  const start = month >= 7 ? now.getUTCFullYear() : now.getUTCFullYear() - 1;
  return { label: `${start}–${String(start + 1).slice(2)}`, startsOn: `${start}-07-01`, endsOn: `${start + 1}-06-30` };
}

/**
 * A new league: its owner, one sealed-at-kick-off rule set per sport, and the open season following the chosen
 * competitions (their fixtures arrive with the next sync). `now` is given — the clock is never read here.
 */
export async function createLeagueWithSeason(db: Db, input: { name: string; ownerId: string; ownerName: string; competitions: readonly string[]; now: Date }) {
  const created = await createLeague(db, { name: input.name, ownerId: input.ownerId, ownerName: input.ownerName });
  const season = seasonOf(input.now);
  const [row] = await db
    .insert(seasons)
    .values({ leagueId: created.league.id, label: season.label, competition: input.competitions.join(" · ") || "—", competitions: [...input.competitions], startsOn: season.startsOn, endsOn: season.endsOn })
    .returning();
  return { ...created, season: row! };
}

const hashOf = (token: string) => createHash("sha256").update(token).digest("hex");
const INVITE_DAYS = 7; // @fixed: how long an invite link lives — a product choice written down here until the settings page owns it

/** A new invite link for a league: the token is returned once, only its hash is kept. */
export async function createInvite(db: Db, input: { leagueId: string; memberId: string; now: Date }): Promise<{ token: string; expiresAt: Date }> {
  const [m] = await db.select().from(members).where(and(eq(members.id, input.memberId), eq(members.leagueId, input.leagueId)));
  if (!m) throw new PlayError("NOT_A_MEMBER", "Only a member invites");
  const token = `kzi_${randomBytes(24).toString("base64url")}`;
  const expiresAt = new Date(input.now);
  expiresAt.setUTCDate(expiresAt.getUTCDate() + INVITE_DAYS);
  await db.insert(leagueInvites).values({ leagueId: input.leagueId, tokenHash: hashOf(token), createdBy: input.memberId, expiresAt });
  return { token, expiresAt };
}

/** What an invite says before it is used: the league's name (so the page can ask « join X? »), or refused. */
export async function inviteLeague(db: Db, token: string, now: Date): Promise<{ leagueId: string; name: string } | null> {
  const [row] = await db.select({ leagueId: leagueInvites.leagueId, expiresAt: leagueInvites.expiresAt, revokedAt: leagueInvites.revokedAt }).from(leagueInvites).where(eq(leagueInvites.tokenHash, hashOf(token)));
  if (!row || row.revokedAt || row.expiresAt <= now) return null;
  const [league] = await db.select({ name: leagues.name }).from(leagues).where(eq(leagues.id, row.leagueId));
  return league ? { leagueId: row.leagueId, name: league.name } : null;
}

/** An account joins a league through an invite: once (a second time is the same member), under its name or the next free one. */
export async function joinWithInvite(db: Db, input: { token: string; accountId: string; displayName: string; now: Date }): Promise<{ leagueId: string; memberId: string; joined: boolean }> {
  const invite = await inviteLeague(db, input.token, input.now);
  if (!invite) throw new PlayError("INVITE_INVALID", "This invite is not valid any more");
  return db.transaction(async (tx) => {
    const [already] = await tx.select().from(members).where(and(eq(members.leagueId, invite.leagueId), eq(members.accountId, input.accountId)));
    if (already) return { leagueId: invite.leagueId, memberId: already.id, joined: false };
    const names = new Set((await tx.select({ n: members.displayName }).from(members).where(eq(members.leagueId, invite.leagueId))).map((r) => r.n));
    let name = input.displayName;
    for (let i = 2; names.has(name); i++) name = `${input.displayName} ${i}`;
    const [row] = await tx.insert(members).values({ leagueId: invite.leagueId, accountId: input.accountId, displayName: name }).returning();
    return { leagueId: invite.leagueId, memberId: row!.id, joined: true };
  });
}

/** The columns a pick occupies, by sport (the database refuses a shape that does not fit its sport). */
function columns(sport: SportId, pick: Pick) {
  if (sport === "basketball") return { home: null, away: null, winner: (pick as BasketballPick).winner, band: (pick as BasketballPick).band, overtime: false };
  const p = pick as Score & Partial<HockeyPick>;
  return { home: p.home, away: p.away, winner: null, band: null, overtime: sport === "hockey" ? !!p.overtime : false };
}

/**
 * A member's pick for a match of their league, in the shape of the match's sport. Written again (the last one counts)
 * until kick-off — by the clock and by the facts, as the database itself enforces.
 */
export async function savePick(db: Db, input: { leagueId: string; memberId: string; matchId: string; pick: unknown }): Promise<void> {
  const [member] = await db.select().from(members).where(and(eq(members.id, input.memberId), eq(members.leagueId, input.leagueId)));
  if (!member) throw new PlayError("NOT_A_MEMBER", "Not a member of this league");
  const [match] = await db.select({ m: matches, leagueId: seasons.leagueId }).from(matches).innerJoin(seasons, eq(seasons.id, matches.seasonId)).where(eq(matches.id, input.matchId));
  if (!match || match.leagueId !== input.leagueId) throw new PlayError("MATCH_UNKNOWN", "This match is not in this league");
  let bandsCount: number | undefined;
  if (match.m.sport === "basketball") {
    const [rs] = await db.select().from(ruleSets).where(and(eq(ruleSets.leagueId, input.leagueId), eq(ruleSets.sport, "basketball"))).orderBy(desc(ruleSets.version)).limit(1);
    const bands = (rs?.rules as { bands?: number[] } | undefined)?.bands;
    bandsCount = bands?.length;
  }
  let pick: Pick;
  try {
    pick = parsePick(match.m.sport, input.pick, { bandsCount });
  } catch {
    throw new PlayError("PICK_INVALID", "This pick does not fit the sport");
  }
  const values = columns(match.m.sport, pick);
  try {
    await db.insert(predictions).values({ matchId: match.m.id, memberId: member.id, ...values }).onConflictDoUpdate({ target: [predictions.matchId, predictions.memberId], set: values });
  } catch (error) {
    const text = `${(error as Error).message} ${(error as { cause?: Error }).cause?.message ?? ""}`;
    if (text.includes("KZ_PREDICTION_LOCKED")) throw new PlayError("PICK_LOCKED", "The match kicked off");
    throw error;
  }
}

/** Revokes every live invite of a league (the owner changes their mind). */
export async function revokeInvites(db: Db, leagueId: string, now: Date): Promise<void> {
  await db.update(leagueInvites).set({ revokedAt: now }).where(and(eq(leagueInvites.leagueId, leagueId), isNull(leagueInvites.revokedAt)));
}
