ALTER TABLE team_invitations ADD COLUMN include_access boolean NOT NULL DEFAULT false;
ALTER TABLE team_invitations ADD CONSTRAINT invitation_extra_access CHECK(NOT include_access OR role='box_office');
GRANT SELECT(include_access) ON team_invitations TO authenticated;
-- Server-only worker/acceptance check; arbitrary user IDs must never be client-callable.
CREATE FUNCTION app_private.inviter_authorized(uid uuid, event_ids uuid[], assigned_role text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT EXISTS(SELECT 1 FROM profiles WHERE id=uid AND deleted_at IS NULL)
 AND (EXISTS(SELECT 1 FROM platform_admins WHERE user_id=uid)
 OR (assigned_role IN ('organizer','box_office','access_staff') AND cardinality(event_ids)>0
 AND NOT EXISTS(SELECT 1 FROM unnest(event_ids) eid WHERE NOT EXISTS(
 SELECT 1 FROM events e WHERE e.id=eid AND (EXISTS(SELECT 1 FROM organization_members m WHERE m.organization_id=e.organization_id AND m.user_id=uid)
 OR EXISTS(SELECT 1 FROM event_staff s WHERE s.event_id=e.id AND s.user_id=uid AND s.active AND s.role='organizer'))))))
$$;
REVOKE ALL ON FUNCTION app_private.inviter_authorized(uuid,uuid[],text) FROM PUBLIC,anon,authenticated;
CREATE POLICY invitation_event_manager_read ON team_invitations FOR SELECT TO authenticated USING(
 cardinality(event_ids)>0 AND role<>'platform_admin' AND NOT EXISTS(
 SELECT 1 FROM unnest(event_ids) eid WHERE NOT app_private.can_event(eid,'manage')));
