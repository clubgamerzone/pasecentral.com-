ALTER TABLE profiles ADD COLUMN IF NOT EXISTS bio text NOT NULL DEFAULT '' CHECK(length(bio)<=1000);
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS avatar_path text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE event_staff DROP CONSTRAINT event_staff_role_check;
ALTER TABLE event_staff ADD CONSTRAINT event_staff_role_check CHECK(role IN ('organizer','box_office','access_staff'));
CREATE OR REPLACE FUNCTION app_private.can_event(eid uuid, permission text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT EXISTS(SELECT 1 FROM events e WHERE e.id=eid AND (app_private.manages_org(e.organization_id) OR EXISTS(SELECT 1 FROM event_staff s WHERE s.event_id=e.id AND s.user_id=auth.uid() AND s.active AND (s.role='organizer' OR (permission='view' AND s.role IN ('box_office','access_staff')) OR (permission='sell' AND s.role='box_office') OR (permission='access' AND s.role='access_staff')))))
$$;
CREATE TABLE team_invitations(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), email text NOT NULL, name text NOT NULL,
 role text NOT NULL CHECK(role IN ('platform_admin','organizer','box_office','access_staff','customer')),
 event_ids uuid[] NOT NULL DEFAULT '{}', token_hash text NOT NULL UNIQUE, token_encrypted text NOT NULL,
 created_by uuid NOT NULL REFERENCES profiles(id), created_at timestamptz NOT NULL DEFAULT now(),
 expires_at timestamptz NOT NULL DEFAULT now()+interval '7 days',
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','accepted','revoked','expired')),
 accepted_by uuid REFERENCES profiles(id), accepted_at timestamptz,
 email_status text NOT NULL DEFAULT 'pending' CHECK(email_status IN ('pending','processing','sent','failed')),
 email_attempts integer NOT NULL DEFAULT 0, email_generation integer NOT NULL DEFAULT 1,
 next_attempt_at timestamptz NOT NULL DEFAULT now(), locked_at timestamptz, last_error text,
 email_payload_encrypted text NOT NULL,
 CHECK((role IN ('platform_admin','customer') AND cardinality(event_ids)=0) OR (role IN ('organizer','box_office','access_staff') AND cardinality(event_ids)>0))
);
CREATE UNIQUE INDEX invitation_pending_email ON team_invitations(lower(email)) WHERE status='pending';
CREATE INDEX invitation_delivery ON team_invitations(status,email_status,next_attempt_at);
ALTER TABLE team_invitations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON team_invitations FROM PUBLIC,anon,authenticated;
GRANT SELECT(id,email,name,role,event_ids,created_by,created_at,expires_at,status,accepted_by,accepted_at,email_status,email_attempts,last_error) ON team_invitations TO authenticated;
CREATE POLICY invitation_admin_read ON team_invitations FOR SELECT TO authenticated USING(app_private.is_admin());
DO $$ BEGIN
 IF to_regclass('storage.buckets') IS NOT NULL THEN
  INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types) VALUES('avatars','avatars',false,2097152,ARRAY['image/png']) ON CONFLICT(id) DO UPDATE SET public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
  EXECUTE 'CREATE POLICY avatar_read ON storage.objects FOR SELECT TO authenticated USING(bucket_id=''avatars'' AND ((storage.foldername(name))[1]=auth.uid()::text OR app_private.is_admin()))';
  EXECUTE 'CREATE POLICY avatar_upload ON storage.objects FOR INSERT TO authenticated WITH CHECK(bucket_id=''avatars'' AND (storage.foldername(name))[1]=auth.uid()::text)';
  EXECUTE 'CREATE POLICY avatar_delete ON storage.objects FOR DELETE TO authenticated USING(bucket_id=''avatars'' AND (storage.foldername(name))[1]=auth.uid()::text)';
 END IF;
END $$;
