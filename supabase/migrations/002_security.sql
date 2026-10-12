-- In Supabase these roles and auth.uid() already exist. Local PostgreSQL fallback supports RLS tests.
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon NOLOGIN; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_namespace WHERE nspname='auth') THEN
  CREATE SCHEMA auth;
  EXECUTE 'CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $f$ SELECT nullif(current_setting(''request.jwt.claim.sub'',true),'''')::uuid $f$';
 END IF;
 IF to_regclass('auth.users') IS NOT NULL THEN ALTER TABLE profiles ADD CONSTRAINT profiles_auth_user FOREIGN KEY(id) REFERENCES auth.users(id); END IF;
END $$;
CREATE SCHEMA IF NOT EXISTS app_private;
CREATE FUNCTION app_private.is_admin() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$ SELECT EXISTS(SELECT 1 FROM platform_admins WHERE user_id=auth.uid()) $$;
CREATE FUNCTION app_private.manages_org(org uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$ SELECT app_private.is_admin() OR EXISTS(SELECT 1 FROM organization_members WHERE organization_id=org AND user_id=auth.uid()) $$;
CREATE FUNCTION app_private.can_event(eid uuid, permission text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$ SELECT EXISTS(SELECT 1 FROM events e WHERE e.id=eid AND (app_private.manages_org(e.organization_id) OR (permission IN ('view','sell','access') AND EXISTS(SELECT 1 FROM event_staff s WHERE s.event_id=e.id AND s.user_id=auth.uid() AND s.active AND (permission='view' OR (permission='sell' AND s.role='box_office') OR (permission='access' AND s.role='access_staff')))))) $$;
CREATE FUNCTION app_private.owns_order(oid uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$ SELECT EXISTS(SELECT 1 FROM orders WHERE id=oid AND buyer_user_id=auth.uid()) $$;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA app_private FROM PUBLIC;
GRANT USAGE ON SCHEMA app_private,auth TO anon,authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA app_private TO anon,authenticated;
REVOKE EXECUTE ON FUNCTION prevent_phase_overlap() FROM PUBLIC,anon,authenticated;
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['organizations','profiles','platform_admins','organization_members','events','event_staff','ticket_types','pricing_phases','orders','order_items','payments','tickets','check_in_attempts','cash_sessions','cash_movements','refunds','delivery_jobs','print_jobs','audit_logs','payment_webhook_events','rate_limits'] LOOP
 EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',t);
 EXECUTE format('REVOKE ALL ON %I FROM anon,authenticated',t);
 END LOOP;
END $$;
GRANT SELECT ON events,ticket_types,pricing_phases TO anon,authenticated;
GRANT SELECT ON organizations,profiles,platform_admins,organization_members,event_staff,order_items,payments,check_in_attempts,cash_sessions,cash_movements,refunds,delivery_jobs,print_jobs,audit_logs TO authenticated;
GRANT SELECT(id,event_id,buyer_user_id,buyer_name,buyer_email,buyer_phone,buyer_category,channel,status,reservation_expires_at,subtotal_cop,fees_cop,total_cop,created_by,created_at) ON orders TO authenticated;
GRANT SELECT(id,event_id,ticket_type_id,order_item_id,owner_user_id,event_sequence,visible_number,security_serial,credential_version,status,issued_at,used_at,refund_id) ON tickets TO authenticated;
CREATE POLICY event_read ON events FOR SELECT USING(status='published' OR app_private.can_event(id,'view'));
CREATE POLICY type_read ON ticket_types FOR SELECT USING(EXISTS(SELECT 1 FROM events WHERE id=event_id));
CREATE POLICY phase_read ON pricing_phases FOR SELECT USING(EXISTS(SELECT 1 FROM ticket_types WHERE id=ticket_type_id));
CREATE POLICY org_read ON organizations FOR SELECT TO authenticated USING(app_private.manages_org(id));
CREATE POLICY profile_read ON profiles FOR SELECT TO authenticated USING(id=auth.uid() OR app_private.is_admin());
CREATE POLICY admin_read ON platform_admins FOR SELECT TO authenticated USING(user_id=auth.uid());
CREATE POLICY member_read ON organization_members FOR SELECT TO authenticated USING(user_id=auth.uid() OR app_private.manages_org(organization_id));
CREATE POLICY staff_read ON event_staff FOR SELECT TO authenticated USING(user_id=auth.uid() OR app_private.can_event(event_id,'manage'));
CREATE POLICY order_read ON orders FOR SELECT TO authenticated USING(buyer_user_id=auth.uid() OR app_private.can_event(event_id,'sell'));
CREATE POLICY item_read ON order_items FOR SELECT TO authenticated USING(app_private.owns_order(order_id) OR app_private.can_event(event_id,'sell'));
CREATE POLICY ticket_read ON tickets FOR SELECT TO authenticated USING(owner_user_id=auth.uid() OR app_private.can_event(event_id,'view'));
CREATE POLICY payment_read ON payments FOR SELECT TO authenticated USING(EXISTS(SELECT 1 FROM orders WHERE id=order_id));
CREATE POLICY access_read ON check_in_attempts FOR SELECT TO authenticated USING(app_private.can_event(event_id,'view'));
CREATE POLICY session_read ON cash_sessions FOR SELECT TO authenticated USING(operator_id=auth.uid() OR app_private.can_event(event_id,'manage'));
CREATE POLICY movement_read ON cash_movements FOR SELECT TO authenticated USING(EXISTS(SELECT 1 FROM cash_sessions WHERE id=cash_session_id));
CREATE POLICY refund_read ON refunds FOR SELECT TO authenticated USING(EXISTS(SELECT 1 FROM orders WHERE id=order_id AND app_private.can_event(event_id,'manage')));
CREATE POLICY delivery_read ON delivery_jobs FOR SELECT TO authenticated USING(EXISTS(SELECT 1 FROM orders WHERE id=order_id));
CREATE POLICY print_read ON print_jobs FOR SELECT TO authenticated USING(operator_id=auth.uid() OR app_private.is_admin());
CREATE POLICY audit_read ON audit_logs FOR SELECT TO authenticated USING(actor_id=auth.uid() OR app_private.is_admin());
-- Intentionally no browser INSERT/UPDATE/DELETE policies. All writes use the authorized server transaction service.
-- App never exposes its privileged DATABASE_URL. No public bootstrap or role assignment endpoint.
DO $$ BEGIN
 IF to_regclass('storage.buckets') IS NOT NULL THEN
 INSERT INTO storage.buckets(id,name,public) VALUES('tickets','tickets',false) ON CONFLICT(id) DO UPDATE SET public=false;
 END IF;
END $$;

CREATE TABLE IF NOT EXISTS schema_migrations(name text primary key, applied_at timestamptz default now());
INSERT INTO schema_migrations(name) VALUES('002_security.sql') ON CONFLICT DO NOTHING;

ALTER TABLE schema_migrations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON schema_migrations FROM anon,authenticated;
