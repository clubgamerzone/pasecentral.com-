-- Small normalized monochrome print asset, never an original poster or QR.
CREATE TABLE event_ticket_art(
 event_id uuid PRIMARY KEY REFERENCES events(id) ON DELETE CASCADE,
 image_png bytea NOT NULL CHECK(octet_length(image_png)<=350000),
 caption text NOT NULL DEFAULT 'VIVE EL MOMENTO' CHECK(length(caption) BETWEEN 1 AND 40),
 updated_by uuid REFERENCES profiles(id),
 updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE event_ticket_art ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON event_ticket_art FROM anon,authenticated;
