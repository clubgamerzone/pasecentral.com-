ALTER TABLE ticket_types DROP CONSTRAINT ticket_types_capacity_check;
ALTER TABLE ticket_types ADD CONSTRAINT ticket_types_capacity_check CHECK(capacity>=0);
CREATE TABLE event_images(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), event_id uuid NOT NULL REFERENCES events(id),
 path text NOT NULL UNIQUE, created_by uuid NOT NULL REFERENCES profiles(id), created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX event_images_event ON event_images(event_id,created_at,id);
ALTER TABLE event_images ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON event_images FROM PUBLIC,anon,authenticated;
GRANT SELECT ON event_images TO anon,authenticated;
CREATE POLICY event_images_read ON event_images FOR SELECT USING(
 EXISTS(SELECT 1 FROM events e WHERE e.id=event_id AND e.status='published') OR app_private.can_event(event_id,'view')
);
DO $$ BEGIN
 IF to_regclass('storage.buckets') IS NOT NULL THEN
  INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
  VALUES('event-images','event-images',false,5242880,ARRAY['image/webp'])
  ON CONFLICT(id) DO UPDATE SET public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
  EXECUTE 'CREATE POLICY event_image_read ON storage.objects FOR SELECT TO anon,authenticated USING(bucket_id=''event-images'' AND EXISTS(SELECT 1 FROM events e WHERE e.id::text=(storage.foldername(name))[1] AND (e.status=''published'' OR app_private.can_event(e.id,''view''))))';
  EXECUTE 'CREATE POLICY event_image_upload ON storage.objects FOR INSERT TO authenticated WITH CHECK(bucket_id=''event-images'' AND EXISTS(SELECT 1 FROM events e WHERE e.id::text=(storage.foldername(name))[1] AND app_private.can_event(e.id,''manage'')))';
  EXECUTE 'CREATE POLICY event_image_delete ON storage.objects FOR DELETE TO authenticated USING(bucket_id=''event-images'' AND EXISTS(SELECT 1 FROM events e WHERE e.id::text=(storage.foldername(name))[1] AND app_private.can_event(e.id,''manage'')))';
 END IF;
END $$;
