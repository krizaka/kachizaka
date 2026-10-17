-- Several sports in one league. A league keeps one rule set per sport (versioned and sealed the same way); a match says
-- its sport and competition; a pick has the shape of its sport (soccer a score, hockey a score and « overtime », basketball
-- a winner and a margin band). The database refuses a pick of the wrong shape and a match started under another sport's rules.

ALTER TABLE "rule_sets" ADD COLUMN "sport" text DEFAULT 'soccer' NOT NULL;--> statement-breakpoint
ALTER TABLE "rule_sets" ADD CONSTRAINT "rule_sets_sport" CHECK ("sport" IN ('soccer','hockey','basketball'));--> statement-breakpoint
DROP INDEX "rule_sets_version";--> statement-breakpoint
CREATE UNIQUE INDEX "rule_sets_version" ON "rule_sets" USING btree ("league_id","sport","version");--> statement-breakpoint

-- Each league-season keeps its own rows for a game (its own picks, rules and seal): the provider's id is unique per season.
DROP INDEX "matches_provider";--> statement-breakpoint
CREATE UNIQUE INDEX "matches_provider" ON "matches" USING btree ("season_id","provider","provider_match_id");--> statement-breakpoint
-- The competitions a season follows (« NHL », « Premier League »…).
ALTER TABLE "seasons" ADD COLUMN "competitions" text[] DEFAULT '{}' NOT NULL;--> statement-breakpoint

ALTER TABLE "matches" ADD COLUMN "sport" text DEFAULT 'soccer' NOT NULL;--> statement-breakpoint
ALTER TABLE "matches" ADD COLUMN "competition" text;--> statement-breakpoint
ALTER TABLE "matches" ADD COLUMN "overtime" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_sport" CHECK ("sport" IN ('soccer','hockey','basketball'));--> statement-breakpoint

ALTER TABLE "predictions" ALTER COLUMN "home" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "predictions" ALTER COLUMN "away" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "predictions" ADD COLUMN "winner" text;--> statement-breakpoint
ALTER TABLE "predictions" ADD COLUMN "band" integer;--> statement-breakpoint
ALTER TABLE "predictions" ADD COLUMN "overtime" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "predictions" DROP CONSTRAINT "predictions_scores";--> statement-breakpoint
ALTER TABLE "predictions" ADD CONSTRAINT "predictions_scores" CHECK (("home" IS NULL AND "away" IS NULL) OR ("home" BETWEEN 0 AND 300 AND "away" BETWEEN 0 AND 300));--> statement-breakpoint
ALTER TABLE "predictions" ADD CONSTRAINT "predictions_winner" CHECK ("winner" IS NULL OR "winner" IN ('home','away'));--> statement-breakpoint
ALTER TABLE "predictions" ADD CONSTRAINT "predictions_band" CHECK ("band" IS NULL OR "band" BETWEEN 0 AND 10);--> statement-breakpoint

ALTER TABLE "prediction_scores" ADD COLUMN "perfect" boolean DEFAULT false NOT NULL;--> statement-breakpoint
UPDATE "prediction_scores" SET "perfect" = true WHERE "breakdown" @> '[{"rule":"exactScore"}]'::jsonb;--> statement-breakpoint

-- A match starts only under a sealed rule set of its own league AND its own sport (replaces 0001's function).
CREATE OR REPLACE FUNCTION kz_matches_rules() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  rs record;
  league uuid;
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.status <> 'scheduled'
     AND (NEW.rule_set_id IS DISTINCT FROM OLD.rule_set_id OR NEW.rule_set_seal IS DISTINCT FROM OLD.rule_set_seal) THEN
    RAISE EXCEPTION 'KZ_MATCH_RULES_FIXED: match % kicked off with rule set %; its rules never change', OLD.id, OLD.rule_set_id;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.status <> 'scheduled' AND NEW.sport IS DISTINCT FROM OLD.sport THEN
    RAISE EXCEPTION 'KZ_MATCH_RULES_FIXED: match % kicked off as %; its sport never changes', OLD.id, OLD.sport;
  END IF;
  IF TG_OP = 'UPDATE' AND ((OLD.status = 'final' AND NEW.status <> 'final') OR (OLD.status = 'live' AND NEW.status = 'scheduled')) THEN
    RAISE EXCEPTION 'KZ_MATCH_STATUS_BACKWARDS: match % cannot go from % to %', OLD.id, OLD.status, NEW.status;
  END IF;
  IF NEW.status <> 'scheduled' THEN
    SELECT r.league_id, r.seal, r.sealed_at, r.sport INTO rs FROM rule_sets r WHERE r.id = NEW.rule_set_id;
    SELECT s.league_id INTO league FROM seasons s WHERE s.id = NEW.season_id;
    IF rs IS NULL OR rs.sealed_at IS NULL OR rs.seal IS DISTINCT FROM NEW.rule_set_seal OR rs.league_id <> league THEN
      RAISE EXCEPTION 'KZ_MATCH_NOT_SEALED: match % cannot start without a sealed rule set of its league', NEW.id;
    END IF;
    IF rs.sport <> NEW.sport THEN
      RAISE EXCEPTION 'KZ_MATCH_WRONG_SPORT: match % is % but its rule set is %', NEW.id, NEW.sport, rs.sport;
    END IF;
  END IF;
  RETURN NEW;
END $$;
--> statement-breakpoint

-- A pick has the shape of its match's sport.
CREATE FUNCTION kz_predictions_shape() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  s text;
BEGIN
  SELECT sport INTO s FROM matches WHERE id = NEW.match_id;
  IF s = 'soccer' AND (NEW.home IS NULL OR NEW.away IS NULL OR NEW.winner IS NOT NULL OR NEW.band IS NOT NULL OR NEW.overtime) THEN
    RAISE EXCEPTION 'KZ_PICK_SHAPE: a soccer pick is a score (home, away)';
  END IF;
  IF s = 'hockey' AND (NEW.home IS NULL OR NEW.away IS NULL OR NEW.home = NEW.away OR NEW.winner IS NOT NULL OR NEW.band IS NOT NULL) THEN
    RAISE EXCEPTION 'KZ_PICK_SHAPE: a hockey pick is a score without a tie, and overtime or not';
  END IF;
  IF s = 'basketball' AND (NEW.winner IS NULL OR NEW.band IS NULL OR NEW.home IS NOT NULL OR NEW.away IS NOT NULL OR NEW.overtime) THEN
    RAISE EXCEPTION 'KZ_PICK_SHAPE: a basketball pick is a winner and a margin band';
  END IF;
  RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER predictions_shape BEFORE INSERT OR UPDATE ON predictions FOR EACH ROW EXECUTE FUNCTION kz_predictions_shape();
