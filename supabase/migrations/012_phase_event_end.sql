ALTER TABLE pricing_phases ALTER COLUMN ends_at DROP NOT NULL;
COMMENT ON COLUMN pricing_phases.ends_at IS 'NULL: follows event end, or remains open until sales are closed if event has no end.';
-- Treat event-linked phases as open-ended for overlap checks. This reserves the
-- remainder of the channel even if the event end is later extended.
CREATE OR REPLACE FUNCTION prevent_phase_overlap() RETURNS trigger LANGUAGE plpgsql SET search_path=public,pg_temp AS $$ BEGIN
 PERFORM 1 FROM ticket_types WHERE id=NEW.ticket_type_id FOR UPDATE;
 IF NEW.active AND EXISTS(SELECT 1 FROM pricing_phases WHERE ticket_type_id=NEW.ticket_type_id AND (channel=NEW.channel OR channel='both' OR NEW.channel='both') AND active AND id<>NEW.id AND starts_at<COALESCE(NEW.ends_at,'infinity'::timestamptz) AND COALESCE(ends_at,'infinity'::timestamptz)>NEW.starts_at) THEN RAISE EXCEPTION 'Fases superpuestas'; END IF;
 RETURN NEW;
END $$;
