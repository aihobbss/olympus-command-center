-- ============================================
-- 005: OAuth CSRF tokens
-- ============================================
-- Stores short-lived CSRF tokens for OAuth flows (Meta, Shopify).
-- Each token is one-time-use and expires after 10 minutes.

CREATE TABLE IF NOT EXISTS oauth_csrf_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  csrf_token TEXT NOT NULL UNIQUE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  store_id TEXT NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  service TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ DEFAULT (now() + interval '10 minutes')
);

-- Index for fast lookup by csrf_token
CREATE INDEX IF NOT EXISTS idx_oauth_csrf_token ON oauth_csrf_tokens(csrf_token);

-- Auto-cleanup: delete expired tokens (can be called periodically or rely on query-time filtering)
-- No cron needed — we filter by expires_at in queries and tokens are deleted after use.
