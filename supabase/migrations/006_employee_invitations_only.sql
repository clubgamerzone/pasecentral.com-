-- Keep historical records; revoke former buyer invitations without touching buyer accounts/orders.
WITH revoked AS (
 UPDATE team_invitations SET status='revoked' WHERE role='customer' AND status='pending' RETURNING id
)
INSERT INTO audit_logs(action,entity_type,entity_id,safe_metadata)
SELECT 'buyer_invitation_retired','invitation',id,'{"reason":"employee_invitations_only"}'::jsonb FROM revoked;
-- NOT VALID preserves legacy buyer invitation rows while enforcing every new insert/update.
ALTER TABLE team_invitations ADD CONSTRAINT employee_invitation_role_check
 CHECK(role IN ('platform_admin','organizer','box_office','access_staff')) NOT VALID;
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM team_invitations WHERE role='customer') THEN
  ALTER TABLE team_invitations VALIDATE CONSTRAINT employee_invitation_role_check;
 END IF;
END $$;
