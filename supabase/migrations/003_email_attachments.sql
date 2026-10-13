-- Freeze the encrypted email payload so retries keep the exact provider idempotency payload.
ALTER TABLE delivery_jobs ADD COLUMN IF NOT EXISTS email_payload_encrypted text;
REVOKE SELECT ON delivery_jobs FROM authenticated;
GRANT SELECT(id,order_id,channel,status,attempts,next_attempt_at,last_error,created_at,locked_at)
  ON delivery_jobs TO authenticated;
