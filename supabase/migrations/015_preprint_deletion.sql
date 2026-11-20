-- Retain print history after removing an unsold paper credential.
ALTER TABLE preprint_print_jobs ADD COLUMN visible_number text;
UPDATE preprint_print_jobs j SET visible_number=p.visible_number FROM preprinted_tickets p WHERE p.id=j.preprinted_ticket_id;
ALTER TABLE preprint_print_jobs ALTER COLUMN preprinted_ticket_id DROP NOT NULL;
ALTER TABLE preprint_print_jobs DROP CONSTRAINT preprint_print_jobs_preprinted_ticket_id_fkey;
ALTER TABLE preprint_print_jobs ADD FOREIGN KEY(preprinted_ticket_id) REFERENCES preprinted_tickets(id) ON DELETE SET NULL;

-- A delayed retry must not recreate a deleted lot using its old request key.
CREATE TABLE preprint_batch_deletions (
 batch_id uuid PRIMARY KEY, request_key uuid NOT NULL UNIQUE,
 event_id uuid NOT NULL REFERENCES events(id),
 created_by uuid NOT NULL REFERENCES profiles(id),
 deleted_by uuid NOT NULL REFERENCES profiles(id),
 deleted_at timestamptz NOT NULL DEFAULT now(),
 reason text NOT NULL CHECK(length(reason)>0)
);
ALTER TABLE preprint_batch_deletions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON preprint_batch_deletions FROM anon,authenticated;
