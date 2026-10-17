-- An invite link: a random token kept only as its hash, valid for a while, usable by several friends until it expires or
-- the owner revokes it. Joining through it adds the account to the league's members (once: the member index refuses a second).
CREATE TABLE "league_invites" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "league_id" uuid NOT NULL REFERENCES "leagues"("id") ON DELETE CASCADE,
  "token_hash" text NOT NULL UNIQUE,
  "created_by" uuid REFERENCES "league_members"("id") ON DELETE SET NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "expires_at" timestamp with time zone NOT NULL,
  "revoked_at" timestamp with time zone
);
--> statement-breakpoint
CREATE INDEX "league_invites_league" ON "league_invites" ("league_id");
