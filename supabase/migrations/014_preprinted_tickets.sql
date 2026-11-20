CREATE TABLE preprint_batches (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 event_id uuid NOT NULL REFERENCES events(id),
 ticket_type_id uuid NOT NULL,
 name text NOT NULL CHECK(length(name) BETWEEN 1 AND 100),
 type_name text NOT NULL, phase_name text NOT NULL,
 pricing_phase_id uuid REFERENCES pricing_phases(id),
 unit_price_cop integer NOT NULL CHECK(unit_price_cop>=0),
 quantity integer NOT NULL CHECK(quantity BETWEEN 1 AND 100),
 assigned_to uuid REFERENCES profiles(id),
 created_by uuid NOT NULL REFERENCES profiles(id), created_at timestamptz NOT NULL DEFAULT now(),
 request_key uuid NOT NULL UNIQUE,
 FOREIGN KEY(ticket_type_id,event_id) REFERENCES ticket_types(id,event_id),
 UNIQUE(id,event_id,ticket_type_id)
);
ALTER TABLE tickets ADD CONSTRAINT tickets_id_event_type_unique UNIQUE(id,event_id,ticket_type_id);
CREATE TABLE preprinted_tickets (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), batch_id uuid NOT NULL,
 event_id uuid NOT NULL, ticket_type_id uuid NOT NULL,
 event_sequence integer NOT NULL CHECK(event_sequence>0), visible_number text NOT NULL,
 security_serial text NOT NULL UNIQUE, credential_hash text NOT NULL UNIQUE, credential_encrypted text NOT NULL,
 status text NOT NULL DEFAULT 'stock' CHECK(status IN ('stock','activated','blocked')),
 activated_ticket_id uuid UNIQUE, activated_by uuid REFERENCES profiles(id), activated_at timestamptz,
 blocked_by uuid REFERENCES profiles(id), blocked_at timestamptz, block_reason text,
 FOREIGN KEY(batch_id,event_id,ticket_type_id) REFERENCES preprint_batches(id,event_id,ticket_type_id),
 FOREIGN KEY(activated_ticket_id,event_id,ticket_type_id) REFERENCES tickets(id,event_id,ticket_type_id),
 UNIQUE(event_id,event_sequence), UNIQUE(event_id,visible_number),
 CHECK((status='activated')=(activated_ticket_id IS NOT NULL)),
 CHECK(status<>'activated' OR (activated_by IS NOT NULL AND activated_at IS NOT NULL)),
 CHECK(status<>'blocked' OR (blocked_by IS NOT NULL AND blocked_at IS NOT NULL AND length(block_reason)>0))
);
CREATE INDEX preprints_stock ON preprinted_tickets(event_id,ticket_type_id) WHERE status='stock';
CREATE INDEX preprints_batch ON preprinted_tickets(batch_id,event_sequence);
CREATE TABLE preprint_print_jobs (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 preprinted_ticket_id uuid NOT NULL REFERENCES preprinted_tickets(id),
 operator_id uuid NOT NULL REFERENCES profiles(id),
 status text NOT NULL CHECK(status IN ('requested','submitted','confirmed','failed')),
 is_reprint boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX preprint_jobs_ticket ON preprint_print_jobs(preprinted_ticket_id);
ALTER TABLE preprint_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE preprinted_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE preprint_print_jobs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON preprint_batches,preprinted_tickets,preprint_print_jobs FROM anon,authenticated;
ALTER TABLE check_in_attempts DROP CONSTRAINT check_in_attempts_result_check;
ALTER TABLE check_in_attempts ADD CONSTRAINT check_in_attempts_result_check CHECK(result IN ('accepted','already_used','cancelled','wrong_event','outside_admission_window','unknown_ticket','unauthorized','pending_transfer','not_activated'));

-- Keep paper reservations safe even if an older app instance is still running.
CREATE FUNCTION app_private.guard_preprinted_capacity() RETURNS trigger LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
DECLARE cap integer; ignored_order uuid; ignored_item uuid; extra jsonb; used_total bigint:=0; held_total bigint; r record;
 excluded uuid:=nullif(current_setting('app.preprint_activation',true),'')::uuid;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM preprinted_tickets WHERE event_id=NEW.event_id AND status='stock') THEN RETURN NEW; END IF;
 SELECT capacity INTO cap FROM events WHERE id=NEW.event_id FOR UPDATE;
 IF TG_TABLE_NAME='orders' THEN
  IF NOT (NEW.status IN ('confirmed','partially_refunded','refunded') OR (NEW.status='pending_payment' AND NEW.reservation_expires_at>now())) THEN RETURN NEW; END IF;
  ignored_order:=NEW.id;
  SELECT coalesce(jsonb_agg(jsonb_build_object('ticket_type_id',ticket_type_id,'quantity',quantity)),'[]') INTO extra FROM order_items WHERE order_id=NEW.id;
 ELSE
  IF NOT EXISTS(SELECT 1 FROM orders WHERE id=NEW.order_id AND (status IN ('confirmed','partially_refunded','refunded') OR (status='pending_payment' AND reservation_expires_at>now()))) THEN RETURN NEW; END IF;
  ignored_item:=NEW.id;
  extra:=jsonb_build_array(jsonb_build_object('ticket_type_id',NEW.ticket_type_id,'quantity',NEW.quantity));
 END IF;
 FOR r IN
  SELECT t.id,t.capacity,coalesce(x.n,0) AS used,
    (SELECT count(*) FROM preprinted_tickets p WHERE p.event_id=NEW.event_id AND p.ticket_type_id=t.id AND p.status='stock' AND (excluded IS NULL OR p.id<>excluded)) AS held
  FROM ticket_types t LEFT JOIN (
    SELECT ticket_type_id,sum(quantity) AS n FROM (
      SELECT i.ticket_type_id,i.quantity FROM order_items i JOIN orders o ON o.id=i.order_id
      WHERE o.event_id=NEW.event_id AND (ignored_order IS NULL OR o.id<>ignored_order) AND (ignored_item IS NULL OR i.id<>ignored_item)
        AND (o.status IN ('confirmed','partially_refunded','refunded') OR (o.status='pending_payment' AND o.reservation_expires_at>now()))
      UNION ALL SELECT v.ticket_type_id,v.quantity FROM jsonb_to_recordset(extra) AS v(ticket_type_id uuid,quantity integer)
    ) q GROUP BY ticket_type_id
  ) x ON x.ticket_type_id=t.id WHERE t.event_id=NEW.event_id
 LOOP
  IF r.capacity IS NOT NULL AND r.used+r.held>r.capacity THEN RAISE EXCEPTION 'Cupo reservado para boletas preimpresas de la localidad'; END IF;
  used_total:=used_total+r.used;
 END LOOP;
 SELECT count(*) INTO held_total FROM preprinted_tickets p WHERE p.event_id=NEW.event_id AND p.status='stock' AND (excluded IS NULL OR p.id<>excluded);
 IF cap IS NOT NULL AND used_total+held_total>cap THEN RAISE EXCEPTION 'Cupo reservado para boletas preimpresas del evento'; END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION app_private.guard_preprinted_capacity() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER preprinted_items_capacity BEFORE INSERT OR UPDATE ON order_items FOR EACH ROW EXECUTE FUNCTION app_private.guard_preprinted_capacity();
CREATE TRIGGER preprinted_orders_capacity BEFORE UPDATE OF status,reservation_expires_at ON orders FOR EACH ROW EXECUTE FUNCTION app_private.guard_preprinted_capacity();
