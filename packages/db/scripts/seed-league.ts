// `DATABASE_URL=… DATABASE_CA_CERT=… PERSONA_PASSWORD=… pnpm --filter @kachizaka/db seed:league`
//
// The demo league of the dev environment: four named friends (personas — Éric, Salma, Marc-Antoine, Jade; never real
// people), « La gang du vendredi », following the NHL, the Premier League and Ligue 1 with REAL fixtures from the results
// feed. Everything goes through the product's own paths: the league is created by `createLeagueWithSeason`, the friends
// join through a real invite link, the picks are saved by `savePick` (closed at kick-off by the database), results are
// ingested by the pipeline. Nothing is backdated: a pick exists only for a game that had not started.
//
// Idempotent: the league, the members and the picks are found again, never duplicated. Éric's picks for the next
// `--keep 4` games are left empty, for the recorded journey to make them. The personas' sign-in password comes from
// PERSONA_PASSWORD (never printed); `--lock` removes it again, so nobody can sign in as a persona.
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import { syncFixtures } from "@kachizaka/mcp";
import { and, asc, eq, gt, sql } from "drizzle-orm";

import { createDb, pg, poolConfig } from "../src/client";
import { devFeed } from "../src/feed";
import { upsertFixtures } from "../src/fixtures";
import { createInvite, createLeagueWithSeason, joinWithInvite, savePick } from "../src/play";
import { migrate } from "../src/migrate";
import { ingest } from "../src/pipeline";
import { accounts, leagues, matches, members, seasons } from "../src/schema";

const scrypt = promisify(crypto.scrypt);
/** The same scheme as the app (lib/password.ts): scrypt N=2^15 r=8 p=1, 16-byte salt. */
async function hashPassword(password: string) {
  const salt = crypto.randomBytes(16);
  const hash = (await scrypt(password, salt, 32, { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 })) as Buffer;
  return `scrypt$32768$8$1$${salt.toString("base64url")}$${hash.toString("base64url")}`;
}

const arg = (name: string, fallback?: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : fallback;
};
const PERSONAS = [
  { name: "Éric", email: "eric@personas.kachizaka.test" },
  { name: "Salma", email: "salma@personas.kachizaka.test" },
  { name: "Marc-Antoine", email: "marc-antoine@personas.kachizaka.test" },
  { name: "Jade", email: "jade@personas.kachizaka.test" },
] as const;
const LEAGUE = "La gang du vendredi";
const COMPETITIONS = ["NHL", "Premier League", "Ligue 1"];

/** A small deterministic number from a text: the same persona picks the same way every run. */
const roll = (text: string, modulo: number) => crypto.createHash("sha256").update(text).digest().readUInt32BE(0) % modulo;

function pickFor(sport: "soccer" | "hockey" | "basketball", seed: string) {
  if (sport === "hockey") {
    const home = 1 + roll(`${seed}h`, 5);
    let away = 1 + roll(`${seed}a`, 5);
    if (away === home) away = home === 5 ? 4 : home + 1;
    return { home, away, overtime: roll(`${seed}o`, 5) === 0 };
  }
  if (sport === "basketball") return { winner: roll(`${seed}w`, 2) ? "home" : "away", band: roll(`${seed}b`, 4) };
  return { home: roll(`${seed}h`, 4), away: roll(`${seed}a`, 3) };
}

const pool = new pg.Pool(poolConfig(process.env.DATABASE_URL ?? "", process.env.DATABASE_CA_CERT, 3));
await migrate(pool, fileURLToPath(new URL("../drizzle", import.meta.url)));
const db = createDb(pool);

if (process.argv.includes("--lock")) {
  await db.update(accounts).set({ passwordHash: null }).where(sql`${accounts.email} LIKE '%@personas.kachizaka.test'`);
  console.log("kachizaka: the personas can no longer sign in");
  await pool.end();
  process.exit(0);
}

const password = process.env.PERSONA_PASSWORD;
if (!password || password.length < 12) throw new Error("PERSONA_PASSWORD (12+ characters) is required");
const now = new Date();

// 1. The four accounts (sign-up is closed: these exist only because this script made them).
const people = [];
for (const p of PERSONAS) {
  const [row] = await db
    .insert(accounts)
    .values({ email: p.email, locale: "fr", passwordHash: await hashPassword(password) })
    .onConflictDoUpdate({ target: accounts.email, set: { passwordHash: await hashPassword(password), locale: "fr", status: "ACTIVE" } })
    .returning();
  people.push({ ...p, id: row!.id });
}
const eric = people[0]!;

// 2. The league, owned by Éric, and its three friends joining by invite link.
let [league] = await db.select().from(leagues).where(and(eq(leagues.ownerId, eric.id), eq(leagues.name, LEAGUE)));
if (!league) {
  const made = await createLeagueWithSeason(db, { name: LEAGUE, ownerId: eric.id, ownerName: eric.name, competitions: COMPETITIONS, now });
  league = made.league;
}
const [ericMember] = await db.select().from(members).where(and(eq(members.leagueId, league.id), eq(members.accountId, eric.id)));
const invite = await createInvite(db, { leagueId: league.id, memberId: ericMember!.id, now });
for (const p of people.slice(1)) await joinWithInvite(db, { token: invite.token, accountId: p.id, displayName: p.name, now });
const memberOf = new Map((await db.select().from(members).where(eq(members.leagueId, league.id))).map((m) => [m.accountId, m.id]));

// 3. The fixtures and the results the feed already knows (past games close; games to come are stored).
const [season] = await db.select().from(seasons).where(eq(seasons.leagueId, league.id));
const day = (offset: number) => new Date(now.getTime() + offset * 86_400_000).toISOString().slice(0, 10);
const sync = await syncFixtures({
  feed: devFeed({ unlicensed: true }),
  competitions: season!.competitions,
  from: day(Number(arg("back", "0"))),
  to: day(Number(arg("ahead", "7"))),
  upsert: (fixtures) => upsertFixtures(db, season!.id, "results", fixtures),
  ingest: (matchId, events) => ingest(db, matchId, events),
});

// 4. The picks, through the real path, for the games that have not started; Éric keeps the next few for the journey.
const upcoming = await db.select().from(matches).where(and(eq(matches.seasonId, season!.id), gt(matches.kickoffAt, now), eq(matches.status, "scheduled"))).orderBy(asc(matches.kickoffAt));
const keep = Number(arg("keep", "4"));
let picks = 0;
for (const [i, m] of upcoming.entries()) {
  for (const p of people) {
    if (p.id === eric.id && i < keep) continue;
    await savePick(db, { leagueId: league.id, memberId: memberOf.get(p.id)!, matchId: m.id, pick: pickFor(m.sport, `${p.email}:${m.id}`) });
    picks++;
  }
}
console.log(`kachizaka: league ${league.id} · ${sync.fixtures} fixtures, ${sync.closed} results closed${sync.failed.length ? `, failed: ${sync.failed.map((f) => f.competition).join(", ")}` : ""} · ${picks} picks saved, ${keep} games left for Éric`);
await pool.end();
