-- The rules the database keeps itself, whatever the code above it does. Each refusal names itself (KZ_…), so the app
-- and the tests can tell which rule spoke.

-- 1. A sealed rule set is frozen: no update, no delete. A change is a new version (a new row).
CREATE FUNCTION kz_rule_sets_frozen() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.sealed_at IS NOT NULL THEN
    RAISE EXCEPTION 'KZ_RULESET_SEALED: rule set % (version %) was sealed at %; a change is a new version', OLD.id, OLD.version, OLD.sealed_at;
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END $$;
--> statement-breakpoint
CREATE TRIGGER rule_sets_frozen BEFORE UPDATE OR DELETE ON rule_sets FOR EACH ROW EXECUTE FUNCTION kz_rule_sets_frozen();
--> statement-breakpoint

-- 2. A match kicks off with a sealed rule set of its own league, the seal copied as it was; from then on its rules are
--    fixed, and its status only moves forward (scheduled → live → final).
CREATE FUNCTION kz_matches_rules() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  rs record;
  league uuid;
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.status <> 'scheduled'
     AND (NEW.rule_set_id IS DISTINCT FROM OLD.rule_set_id OR NEW.rule_set_seal IS DISTINCT FROM OLD.rule_set_seal) THEN
    RAISE EXCEPTION 'KZ_MATCH_RULES_FIXED: match % kicked off with rule set %; its rules never change', OLD.id, OLD.rule_set_id;
  END IF;
  IF TG_OP = 'UPDATE' AND ((OLD.status = 'final' AND NEW.status <> 'final') OR (OLD.status = 'live' AND NEW.status = 'scheduled')) THEN
    RAISE EXCEPTION 'KZ_MATCH_STATUS_BACKWARDS: match % cannot go from % to %', OLD.id, OLD.status, NEW.status;
  END IF;
  IF NEW.status <> 'scheduled' THEN
    SELECT r.league_id, r.seal, r.sealed_at INTO rs FROM rule_sets r WHERE r.id = NEW.rule_set_id;
    SELECT s.league_id INTO league FROM seasons s WHERE s.id = NEW.season_id;
    IF rs IS NULL OR rs.sealed_at IS NULL OR rs.seal IS DISTINCT FROM NEW.rule_set_seal OR rs.league_id <> league THEN
      RAISE EXCEPTION 'KZ_MATCH_NOT_SEALED: match % cannot start without a sealed rule set of its league', NEW.id;
    END IF;
  END IF;
  RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER matches_rules BEFORE INSERT OR UPDATE ON matches FOR EACH ROW EXECUTE FUNCTION kz_matches_rules();
--> statement-breakpoint

-- 3. A prediction is written (or withdrawn) only before its match kicks off — by the clock and by the facts.
CREATE FUNCTION kz_predictions_locked() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  m record;
BEGIN
  SELECT status, kickoff_at INTO m FROM matches WHERE id = CASE WHEN TG_OP = 'DELETE' THEN OLD.match_id ELSE NEW.match_id END;
  IF m.status <> 'scheduled' OR m.kickoff_at <= now() THEN
    RAISE EXCEPTION 'KZ_PREDICTION_LOCKED: the match kicked off at %; predictions are locked', m.kickoff_at;
  END IF;
  IF TG_OP = 'UPDATE' THEN
    NEW.updated_at := now();
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END $$;
--> statement-breakpoint
CREATE TRIGGER predictions_locked BEFORE INSERT OR UPDATE OR DELETE ON predictions FOR EACH ROW EXECUTE FUNCTION kz_predictions_locked();
--> statement-breakpoint

-- 4. A match fact is written once: only its applied_at may be set, once.
CREATE FUNCTION kz_match_events_once() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.applied_at IS NOT NULL OR NEW.match_id <> OLD.match_id OR NEW.provider_event_id <> OLD.provider_event_id
     OR NEW.seq <> OLD.seq OR NEW.kind <> OLD.kind OR NEW.payload <> OLD.payload THEN
    RAISE EXCEPTION 'KZ_EVENT_IMMUTABLE: fact % of match % is written once', OLD.seq, OLD.match_id;
  END IF;
  RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER match_events_once BEFORE UPDATE ON match_events FOR EACH ROW EXECUTE FUNCTION kz_match_events_once();
