CREATE TABLE "accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"role" text DEFAULT 'USER' NOT NULL,
	"status" text DEFAULT 'ACTIVE' NOT NULL,
	"locale" text DEFAULT 'en' NOT NULL,
	"password_hash" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone,
	CONSTRAINT "accounts_email_unique" UNIQUE("email"),
	CONSTRAINT "accounts_email_lower" CHECK ("accounts"."email" = lower("accounts"."email")),
	CONSTRAINT "accounts_role" CHECK ("accounts"."role" IN ('USER','ADMIN')),
	CONSTRAINT "accounts_status" CHECK ("accounts"."status" IN ('ACTIVE','SUSPENDED')),
	CONSTRAINT "accounts_locale" CHECK ("accounts"."locale" IN ('en','fr'))
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL,
	"actor_id" uuid,
	"actor_label" text NOT NULL,
	"action" text NOT NULL,
	"target_id" text,
	"detail" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"ip" text
);
--> statement-breakpoint
CREATE TABLE "honours" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"league_id" uuid NOT NULL,
	"member_id" uuid NOT NULL,
	"season_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"detail" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"awarded_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "honours_kind" CHECK ("honours"."kind" IN ('champion','runnerUp','third','streak','nemesis'))
);
--> statement-breakpoint
CREATE TABLE "leagues" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"owner_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "match_events" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"match_id" uuid NOT NULL,
	"provider_event_id" text NOT NULL,
	"seq" integer NOT NULL,
	"kind" text NOT NULL,
	"payload" jsonb NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"applied_at" timestamp with time zone,
	CONSTRAINT "match_events_seq_positive" CHECK ("match_events"."seq" >= 1),
	CONSTRAINT "match_events_kind" CHECK ("match_events"."kind" IN ('kickoff','goal','correction','final'))
);
--> statement-breakpoint
CREATE TABLE "matches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"season_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"provider_match_id" text NOT NULL,
	"home_team" text NOT NULL,
	"away_team" text NOT NULL,
	"kickoff_at" timestamp with time zone NOT NULL,
	"is_final" boolean DEFAULT false NOT NULL,
	"status" text DEFAULT 'scheduled' NOT NULL,
	"home_score" integer DEFAULT 0 NOT NULL,
	"away_score" integer DEFAULT 0 NOT NULL,
	"applied_seq" integer DEFAULT 0 NOT NULL,
	"rule_set_id" uuid,
	"rule_set_seal" text,
	CONSTRAINT "matches_status" CHECK ("matches"."status" IN ('scheduled','live','final')),
	CONSTRAINT "matches_scores" CHECK ("matches"."home_score" >= 0 AND "matches"."away_score" >= 0 AND "matches"."applied_seq" >= 0),
	CONSTRAINT "matches_sealed_when_started" CHECK ("matches"."status" = 'scheduled' OR ("matches"."rule_set_id" IS NOT NULL AND "matches"."rule_set_seal" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "league_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"league_id" uuid NOT NULL,
	"account_id" uuid,
	"display_name" text NOT NULL,
	"role" text DEFAULT 'member' NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "league_members_role" CHECK ("league_members"."role" IN ('owner','member'))
);
--> statement-breakpoint
CREATE TABLE "prediction_scores" (
	"prediction_id" uuid PRIMARY KEY NOT NULL,
	"match_id" uuid NOT NULL,
	"member_id" uuid NOT NULL,
	"points" integer NOT NULL,
	"breakdown" jsonb NOT NULL,
	"rule_set_seal" text NOT NULL,
	"provisional" boolean NOT NULL,
	"scored_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "predictions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"match_id" uuid NOT NULL,
	"member_id" uuid NOT NULL,
	"home" integer NOT NULL,
	"away" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "predictions_scores" CHECK ("predictions"."home" BETWEEN 0 AND 30 AND "predictions"."away" BETWEEN 0 AND 30)
);
--> statement-breakpoint
CREATE TABLE "rule_sets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"league_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"rules" jsonb NOT NULL,
	"seal" text NOT NULL,
	"sealed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "rule_sets_seal" CHECK ("rule_sets"."seal" ~ '^sha256:[0-9a-f]{64}$'),
	CONSTRAINT "rule_sets_version_positive" CHECK ("rule_sets"."version" >= 1)
);
--> statement-breakpoint
CREATE TABLE "seasons" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"league_id" uuid NOT NULL,
	"label" text NOT NULL,
	"competition" text NOT NULL,
	"starts_on" date NOT NULL,
	"ends_on" date NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	CONSTRAINT "seasons_dates" CHECK ("seasons"."ends_on" >= "seasons"."starts_on"),
	CONSTRAINT "seasons_status" CHECK ("seasons"."status" IN ('open','closed'))
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"ip" text,
	"user_agent" text,
	CONSTRAINT "sessions_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "standings" (
	"season_id" uuid NOT NULL,
	"member_id" uuid NOT NULL,
	"rank" integer NOT NULL,
	"points" integer NOT NULL,
	"exact" integer NOT NULL,
	"predictions" integer NOT NULL,
	"version" integer NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "standings_season_id_member_id_pk" PRIMARY KEY("season_id","member_id")
);
--> statement-breakpoint
ALTER TABLE "honours" ADD CONSTRAINT "honours_league_id_leagues_id_fk" FOREIGN KEY ("league_id") REFERENCES "public"."leagues"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "honours" ADD CONSTRAINT "honours_member_id_league_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."league_members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "honours" ADD CONSTRAINT "honours_season_id_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."seasons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leagues" ADD CONSTRAINT "leagues_owner_id_accounts_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_events" ADD CONSTRAINT "match_events_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_season_id_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."seasons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_rule_set_id_rule_sets_id_fk" FOREIGN KEY ("rule_set_id") REFERENCES "public"."rule_sets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "league_members" ADD CONSTRAINT "league_members_league_id_leagues_id_fk" FOREIGN KEY ("league_id") REFERENCES "public"."leagues"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "league_members" ADD CONSTRAINT "league_members_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prediction_scores" ADD CONSTRAINT "prediction_scores_prediction_id_predictions_id_fk" FOREIGN KEY ("prediction_id") REFERENCES "public"."predictions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prediction_scores" ADD CONSTRAINT "prediction_scores_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prediction_scores" ADD CONSTRAINT "prediction_scores_member_id_league_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."league_members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "predictions" ADD CONSTRAINT "predictions_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "predictions" ADD CONSTRAINT "predictions_member_id_league_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."league_members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rule_sets" ADD CONSTRAINT "rule_sets_league_id_leagues_id_fk" FOREIGN KEY ("league_id") REFERENCES "public"."leagues"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seasons" ADD CONSTRAINT "seasons_league_id_leagues_id_fk" FOREIGN KEY ("league_id") REFERENCES "public"."leagues"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "standings" ADD CONSTRAINT "standings_season_id_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."seasons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "standings" ADD CONSTRAINT "standings_member_id_league_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."league_members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_log_at" ON "audit_log" USING btree ("at");--> statement-breakpoint
CREATE UNIQUE INDEX "honours_once" ON "honours" USING btree ("season_id","member_id","kind");--> statement-breakpoint
CREATE UNIQUE INDEX "match_events_provider" ON "match_events" USING btree ("match_id","provider_event_id");--> statement-breakpoint
CREATE UNIQUE INDEX "match_events_seq" ON "match_events" USING btree ("match_id","seq");--> statement-breakpoint
CREATE UNIQUE INDEX "matches_provider" ON "matches" USING btree ("provider","provider_match_id");--> statement-breakpoint
CREATE INDEX "matches_season" ON "matches" USING btree ("season_id","kickoff_at");--> statement-breakpoint
CREATE UNIQUE INDEX "league_members_account" ON "league_members" USING btree ("league_id","account_id");--> statement-breakpoint
CREATE UNIQUE INDEX "league_members_name" ON "league_members" USING btree ("league_id","display_name");--> statement-breakpoint
CREATE UNIQUE INDEX "predictions_once" ON "predictions" USING btree ("match_id","member_id");--> statement-breakpoint
CREATE UNIQUE INDEX "rule_sets_version" ON "rule_sets" USING btree ("league_id","version");--> statement-breakpoint
CREATE UNIQUE INDEX "seasons_label" ON "seasons" USING btree ("league_id","label");--> statement-breakpoint
CREATE INDEX "sessions_account" ON "sessions" USING btree ("account_id");