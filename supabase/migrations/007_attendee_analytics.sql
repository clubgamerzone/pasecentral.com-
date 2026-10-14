ALTER TABLE orders ADD COLUMN confirmed_at timestamptz;
UPDATE orders o SET confirmed_at=coalesce((SELECT min(issued_at) FROM tickets t JOIN order_items i ON i.id=t.order_item_id WHERE i.order_id=o.id),o.created_at)
 WHERE o.status='confirmed' OR EXISTS(SELECT 1 FROM tickets t JOIN order_items i ON i.id=t.order_item_id WHERE i.order_id=o.id);
CREATE INDEX orders_event_confirmed ON orders(event_id,confirmed_at);
CREATE FUNCTION order_confirmation_timestamp() RETURNS trigger LANGUAGE plpgsql SET search_path=public,pg_temp AS $$ BEGIN
 IF NEW.status='confirmed' AND NEW.confirmed_at IS NULL THEN NEW.confirmed_at=now(); END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION order_confirmation_timestamp() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER order_confirmation_timestamp BEFORE INSERT OR UPDATE OF status ON orders FOR EACH ROW EXECUTE FUNCTION order_confirmation_timestamp();
ALTER TABLE refunds ADD COLUMN recorded_at timestamptz;
UPDATE refunds SET recorded_at=completed_at WHERE completed_at IS NOT NULL;
ALTER TABLE refunds ALTER COLUMN recorded_at SET DEFAULT now();
CREATE TABLE order_attendees(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), order_item_id uuid NOT NULL REFERENCES order_items(id),
 ordinal integer NOT NULL CHECK(ordinal BETWEEN 1 AND 20),
 gender text CHECK(gender IN ('female','male','other','prefer_not_to_say')),
 age_band text CHECK(age_band IN ('0_5','6_12','13_17','18_24','25_34','35_44','45_54','55_64','65_plus')),
 demographics_consent boolean NOT NULL DEFAULT false,created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(order_item_id,ordinal),UNIQUE(id,order_item_id),
 CHECK(demographics_consent OR (gender IS NULL AND age_band IS NULL))
);
ALTER TABLE order_attendees ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON order_attendees FROM PUBLIC,anon,authenticated;
-- Individual demographic rows are server-only. Managers receive aggregates through the authorized analytics endpoint.
ALTER TABLE tickets ADD COLUMN attendee_id uuid UNIQUE;
ALTER TABLE tickets ADD CONSTRAINT ticket_attendee_item FOREIGN KEY(attendee_id,order_item_id) REFERENCES order_attendees(id,order_item_id);
