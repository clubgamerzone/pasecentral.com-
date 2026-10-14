ALTER TABLE profiles ADD COLUMN gender text CHECK(gender IN ('female','male','other','prefer_not_to_say'));
ALTER TABLE profiles ADD COLUMN age_band text CHECK(age_band IN ('0_5','6_12','13_17','18_24','25_34','35_44','45_54','55_64','65_plus'));
ALTER TABLE profiles ADD COLUMN terms_accepted_at timestamptz;
ALTER TABLE profiles ADD COLUMN terms_version text;
ALTER TABLE profiles ADD COLUMN deleted_at timestamptz;
-- Keep an anonymized financial actor after Auth deletion, without an FK preventing user deletion.
ALTER TABLE profiles ADD COLUMN auth_user_id uuid UNIQUE;
UPDATE profiles SET auth_user_id=id;
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_auth_user;
DO $$ BEGIN IF to_regclass('auth.users') IS NOT NULL THEN
 ALTER TABLE profiles ADD CONSTRAINT profiles_auth_identity FOREIGN KEY(auth_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;
END IF; END $$;
REVOKE SELECT ON profiles FROM authenticated;
GRANT SELECT(id,name,phone,email,created_at,bio,avatar_path,updated_at) ON profiles TO authenticated;
ALTER TABLE events ADD COLUMN minimum_age integer NOT NULL DEFAULT 18 CHECK(minimum_age BETWEEN 0 AND 100);
ALTER TABLE pricing_phases DROP CONSTRAINT pricing_phases_channel_check;
ALTER TABLE pricing_phases ADD CHECK(channel IN ('web','box_office','both'));
CREATE OR REPLACE FUNCTION prevent_phase_overlap() RETURNS trigger LANGUAGE plpgsql SET search_path=public,pg_temp AS $$ BEGIN
 PERFORM 1 FROM ticket_types WHERE id=NEW.ticket_type_id FOR UPDATE;
 IF NEW.active AND EXISTS(SELECT 1 FROM pricing_phases WHERE ticket_type_id=NEW.ticket_type_id AND (channel=NEW.channel OR channel='both' OR NEW.channel='both') AND active AND id<>NEW.id AND starts_at<NEW.ends_at AND ends_at>NEW.starts_at) THEN RAISE EXCEPTION 'Fases superpuestas'; END IF;
 RETURN NEW;
END $$;
ALTER TABLE orders ADD COLUMN gift_email text;
ALTER TABLE check_in_attempts DROP CONSTRAINT check_in_attempts_result_check;
ALTER TABLE check_in_attempts ADD CHECK(result IN ('accepted','already_used','cancelled','wrong_event','outside_admission_window','unknown_ticket','unauthorized','pending_transfer'));
ALTER TABLE delivery_jobs ADD COLUMN recipient_user_id uuid REFERENCES profiles(id);
ALTER TABLE delivery_jobs ADD COLUMN recipient_email text;
CREATE TABLE ticket_transfers(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),from_user_id uuid NOT NULL REFERENCES profiles(id),to_user_id uuid REFERENCES profiles(id),
 recipient_email text NOT NULL,kind text NOT NULL CHECK(kind IN ('gift','transfer')),
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','accepted','declined','expired','cancelled')),
 created_at timestamptz NOT NULL DEFAULT now(),expires_at timestamptz NOT NULL DEFAULT now()+interval '7 days',resolved_at timestamptz
);
CREATE TABLE ticket_transfer_items(transfer_id uuid NOT NULL REFERENCES ticket_transfers(id),ticket_id uuid NOT NULL REFERENCES tickets(id),previous_gender text,previous_age_band text,previous_consent boolean NOT NULL DEFAULT false,PRIMARY KEY(transfer_id,ticket_id));
CREATE INDEX transfer_pending ON ticket_transfers(status,expires_at);
CREATE INDEX transfer_recipient ON ticket_transfers(lower(recipient_email),status);
CREATE INDEX transfer_items_ticket ON ticket_transfer_items(ticket_id);
CREATE TABLE account_notifications(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),recipient_email text NOT NULL,subject text NOT NULL,message text NOT NULL,status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','processing','sent','failed')),attempts integer NOT NULL DEFAULT 0,next_attempt_at timestamptz NOT NULL DEFAULT now(),locked_at timestamptz,last_error text,created_at timestamptz NOT NULL DEFAULT now());
DO $$ DECLARE t text; BEGIN FOREACH t IN ARRAY ARRAY['ticket_transfers','ticket_transfer_items','account_notifications'] LOOP
 EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',t); EXECUTE format('REVOKE ALL ON %I FROM PUBLIC,anon,authenticated',t);
END LOOP; END $$;
CREATE FUNCTION app_private.active_user() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$ SELECT EXISTS(SELECT 1 FROM profiles WHERE id=auth.uid() AND deleted_at IS NULL) $$;
REVOKE ALL ON FUNCTION app_private.active_user() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_private.active_user() TO anon,authenticated;
CREATE OR REPLACE FUNCTION app_private.is_admin() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$ SELECT app_private.active_user() AND EXISTS(SELECT 1 FROM platform_admins WHERE user_id=auth.uid()) $$;
CREATE OR REPLACE FUNCTION app_private.manages_org(org uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$ SELECT app_private.active_user() AND (app_private.is_admin() OR EXISTS(SELECT 1 FROM organization_members WHERE organization_id=org AND user_id=auth.uid())) $$;
CREATE OR REPLACE FUNCTION app_private.owns_order(oid uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$ SELECT app_private.active_user() AND EXISTS(SELECT 1 FROM orders WHERE id=oid AND buyer_user_id=auth.uid()) $$;
CREATE OR REPLACE FUNCTION app_private.can_event(eid uuid, permission text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$ SELECT app_private.active_user() AND EXISTS(SELECT 1 FROM events e WHERE e.id=eid AND (app_private.manages_org(e.organization_id) OR EXISTS(SELECT 1 FROM event_staff s WHERE s.event_id=e.id AND s.user_id=auth.uid() AND s.active AND (s.role='organizer' OR (permission='view' AND s.role IN ('box_office','access_staff')) OR (permission='sell' AND s.role='box_office') OR (permission='access' AND s.role='access_staff'))))) $$;
-- JWTs may remain cryptographically valid until expiry; revoked profiles cannot keep private RLS access.
DO $$ DECLARE t text; BEGIN FOREACH t IN ARRAY ARRAY['organizations','profiles','platform_admins','organization_members','event_staff','orders','order_items','payments','tickets','check_in_attempts','cash_sessions','cash_movements','refunds','delivery_jobs','print_jobs','audit_logs','team_invitations'] LOOP
 EXECUTE format('CREATE POLICY active_account ON %I AS RESTRICTIVE FOR ALL TO authenticated USING(app_private.active_user()) WITH CHECK(app_private.active_user())',t);
END LOOP;
IF to_regclass('storage.objects') IS NOT NULL THEN
 EXECUTE 'CREATE POLICY active_account_storage ON storage.objects AS RESTRICTIVE FOR ALL TO authenticated USING(app_private.active_user()) WITH CHECK(app_private.active_user())';
END IF; END $$;
