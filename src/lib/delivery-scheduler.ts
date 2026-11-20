// Shared by scheduler configuration and SQL regression tests. Includes every
// persistent queue processed by deliver(), including gift/account notices.
export const pendingDeliverySql = `EXISTS (
  SELECT 1 FROM public.delivery_jobs
  WHERE (status IN ('pending','failed') AND next_attempt_at<=now() AND attempts<6)
     OR (status='processing' AND locked_at<now()-interval '10 minutes')
) OR EXISTS (
  SELECT 1 FROM public.team_invitations
  WHERE status='pending' AND expires_at>now() AND (
    (email_status IN ('pending','failed') AND next_attempt_at<=now() AND email_attempts<6)
    OR (email_status='processing' AND locked_at<now()-interval '10 minutes')
  )
) OR EXISTS (
  SELECT 1 FROM public.account_notifications
  WHERE (status IN ('pending','failed') AND next_attempt_at<=now() AND attempts<6)
     OR (status='processing' AND locked_at<now()-interval '10 minutes')
)`;
