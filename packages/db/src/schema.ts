import { sql } from "drizzle-orm";
import { bigserial, boolean, check, date, index, integer, jsonb, pgTable, primaryKey, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

/**
 * Kachizaka's schema. Points only: there is no amount, wallet, stake or odds column anywhere — and a test keeps it so.
 * What the database itself guarantees (drizzle/0001_rules.sql): a sealed rule set never changes; a match keeps the rule
 * set and seal it kicked off with; a prediction cannot be written once its match has kicked off; a match fact is stored
 * once.
 */

const id = () => uuid("id").primaryKey().default(sql`gen_random_uuid()`);
const created = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();

export const accounts = pgTable(
  "accounts",
  {
    id: id(),
    email: text("email").notNull().unique(),
    role: text("role", { enum: ["USER", "ADMIN"] }).notNull().default("USER"),
    status: text("status", { enum: ["ACTIVE", "SUSPENDED"] }).notNull().default("ACTIVE"),
    locale: text("locale", { enum: ["en", "fr"] }).notNull().default("en"),
    passwordHash: text("password_hash"),
    createdAt: created(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
  },
  (t) => [check("accounts_email_lower", sql`${t.email} = lower(${t.email})`), check("accounts_role", sql`${t.role} IN ('USER','ADMIN')`), check("accounts_status", sql`${t.status} IN ('ACTIVE','SUSPENDED')`), check("accounts_locale", sql`${t.locale} IN ('en','fr')`)],
);

export const sessions = pgTable(
  "sessions",
  {
    id: id(),
    accountId: uuid("account_id").notNull().references(() => accounts.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull().unique(),
    createdAt: created(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    ip: text("ip"),
    userAgent: text("user_agent"),
  },
  (t) => [index("sessions_account").on(t.accountId)],
);

export const auditLog = pgTable(
  "audit_log",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
    actorId: uuid("actor_id"),
    actorLabel: text("actor_label").notNull(),
    action: text("action").notNull(),
    targetId: text("target_id"),
    detail: jsonb("detail").notNull().default({}),
    ip: text("ip"),
  },
  (t) => [index("audit_log_at").on(t.at)],
);

/** A league of friends. */
export const leagues = pgTable("leagues", {
  id: id(),
  name: text("name").notNull(),
  ownerId: uuid("owner_id").references(() => accounts.id, { onDelete: "set null" }),
  createdAt: created(),
});

/** A member: an account in a league, under the name the league sees. */
export const members = pgTable(
  "league_members",
  {
    id: id(),
    leagueId: uuid("league_id").notNull().references(() => leagues.id, { onDelete: "cascade" }),
    accountId: uuid("account_id").references(() => accounts.id, { onDelete: "set null" }),
    displayName: text("display_name").notNull(),
    role: text("role", { enum: ["owner", "member"] }).notNull().default("member"),
    joinedAt: timestamp("joined_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("league_members_account").on(t.leagueId, t.accountId), uniqueIndex("league_members_name").on(t.leagueId, t.displayName), check("league_members_role", sql`${t.role} IN ('owner','member')`)],
);

export const seasons = pgTable(
  "seasons",
  {
    id: id(),
    leagueId: uuid("league_id").notNull().references(() => leagues.id, { onDelete: "cascade" }),
    label: text("label").notNull(),
    competition: text("competition").notNull(),
    startsOn: date("starts_on").notNull(),
    endsOn: date("ends_on").notNull(),
    status: text("status", { enum: ["open", "closed"] }).notNull().default("open"),
  },
  (t) => [uniqueIndex("seasons_label").on(t.leagueId, t.label), check("seasons_dates", sql`${t.endsOn} >= ${t.startsOn}`), check("seasons_status", sql`${t.status} IN ('open','closed')`)],
);

/**
 * The scoring rules, versioned per league. `seal` is `sha256:` + the hash of their canonical JSON (@kachizaka/core
 * `sealOf`); `sealed_at` is set at the first kick-off they apply to — after it, the row is frozen (trigger).
 */
export const ruleSets = pgTable(
  "rule_sets",
  {
    id: id(),
    leagueId: uuid("league_id").notNull().references(() => leagues.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    rules: jsonb("rules").notNull(),
    seal: text("seal").notNull(),
    sealedAt: timestamp("sealed_at", { withTimezone: true }),
    createdAt: created(),
  },
  (t) => [uniqueIndex("rule_sets_version").on(t.leagueId, t.version), check("rule_sets_seal", sql`${t.seal} ~ '^sha256:[0-9a-f]{64}$'`), check("rule_sets_version_positive", sql`${t.version} >= 1`)],
);

export const matches = pgTable(
  "matches",
  {
    id: id(),
    seasonId: uuid("season_id").notNull().references(() => seasons.id, { onDelete: "cascade" }),
    provider: text("provider").notNull(),
    providerMatchId: text("provider_match_id").notNull(),
    homeTeam: text("home_team").notNull(),
    awayTeam: text("away_team").notNull(),
    kickoffAt: timestamp("kickoff_at", { withTimezone: true }).notNull(),
    isFinal: boolean("is_final").notNull().default(false),
    status: text("status", { enum: ["scheduled", "live", "final"] }).notNull().default("scheduled"),
    homeScore: integer("home_score").notNull().default(0),
    awayScore: integer("away_score").notNull().default(0),
    appliedSeq: integer("applied_seq").notNull().default(0),
    /** The rule set and its seal, fixed at kick-off. */
    ruleSetId: uuid("rule_set_id").references(() => ruleSets.id),
    ruleSetSeal: text("rule_set_seal"),
  },
  (t) => [
    uniqueIndex("matches_provider").on(t.provider, t.providerMatchId),
    index("matches_season").on(t.seasonId, t.kickoffAt),
    check("matches_status", sql`${t.status} IN ('scheduled','live','final')`),
    check("matches_scores", sql`${t.homeScore} >= 0 AND ${t.awayScore} >= 0 AND ${t.appliedSeq} >= 0`),
    check("matches_sealed_when_started", sql`${t.status} = 'scheduled' OR (${t.ruleSetId} IS NOT NULL AND ${t.ruleSetSeal} IS NOT NULL)`),
  ],
);

export const predictions = pgTable(
  "predictions",
  {
    id: id(),
    matchId: uuid("match_id").notNull().references(() => matches.id, { onDelete: "cascade" }),
    memberId: uuid("member_id").notNull().references(() => members.id, { onDelete: "cascade" }),
    home: integer("home").notNull(),
    away: integer("away").notNull(),
    createdAt: created(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("predictions_once").on(t.matchId, t.memberId), check("predictions_scores", sql`${t.home} BETWEEN 0 AND 30 AND ${t.away} BETWEEN 0 AND 30`)],
);

/** A match fact as received: stored once (provider id), applied in `seq` order (`applied_at` set when applied). */
export const matchEvents = pgTable(
  "match_events",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    matchId: uuid("match_id").notNull().references(() => matches.id, { onDelete: "cascade" }),
    providerEventId: text("provider_event_id").notNull(),
    seq: integer("seq").notNull(),
    kind: text("kind", { enum: ["kickoff", "goal", "correction", "final"] }).notNull(),
    payload: jsonb("payload").notNull(),
    receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),
    appliedAt: timestamp("applied_at", { withTimezone: true }),
  },
  (t) => [uniqueIndex("match_events_provider").on(t.matchId, t.providerEventId), uniqueIndex("match_events_seq").on(t.matchId, t.seq), check("match_events_seq_positive", sql`${t.seq} >= 1`), check("match_events_kind", sql`${t.kind} IN ('kickoff','goal','correction','final')`)],
);

/** A prediction's points and the lines that add up to them, with the seal of the rules that produced them. */
export const predictionScores = pgTable("prediction_scores", {
  predictionId: uuid("prediction_id").primaryKey().references(() => predictions.id, { onDelete: "cascade" }),
  matchId: uuid("match_id").notNull().references(() => matches.id, { onDelete: "cascade" }),
  memberId: uuid("member_id").notNull().references(() => members.id, { onDelete: "cascade" }),
  points: integer("points").notNull(),
  breakdown: jsonb("breakdown").notNull(),
  ruleSetSeal: text("rule_set_seal").notNull(),
  provisional: boolean("provisional").notNull(),
  scoredAt: timestamp("scored_at", { withTimezone: true }).notNull().defaultNow(),
});

/** The season's table, recomputed whole after each applied fact (`version` grows: listeners re-read when it moves). */
export const standings = pgTable(
  "standings",
  {
    seasonId: uuid("season_id").notNull().references(() => seasons.id, { onDelete: "cascade" }),
    memberId: uuid("member_id").notNull().references(() => members.id, { onDelete: "cascade" }),
    rank: integer("rank").notNull(),
    points: integer("points").notNull(),
    exact: integer("exact").notNull(),
    predictions: integer("predictions").notNull(),
    version: integer("version").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.seasonId, t.memberId] })],
);

/** The avatar's history: championships, podiums, streaks, nemeses — across seasons. */
export const honours = pgTable(
  "honours",
  {
    id: id(),
    leagueId: uuid("league_id").notNull().references(() => leagues.id, { onDelete: "cascade" }),
    memberId: uuid("member_id").notNull().references(() => members.id, { onDelete: "cascade" }),
    seasonId: uuid("season_id").notNull().references(() => seasons.id, { onDelete: "cascade" }),
    kind: text("kind", { enum: ["champion", "runnerUp", "third", "streak", "nemesis"] }).notNull(),
    detail: jsonb("detail").notNull().default({}),
    awardedAt: timestamp("awarded_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("honours_once").on(t.seasonId, t.memberId, t.kind), check("honours_kind", sql`${t.kind} IN ('champion','runnerUp','third','streak','nemesis')`)],
);
