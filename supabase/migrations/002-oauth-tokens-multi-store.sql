-- Migration: Update oauth_tokens for multi-store, per-user credentials
-- Run in Supabase SQL Editor

-- Add new columns for client credentials flow (Shopify 2026+)
ALTER TABLE oauth_tokens ADD COLUMN IF NOT EXISTS client_id TEXT;
ALTER TABLE oauth_tokens ADD COLUMN IF NOT EXISTS client_secret TEXT;
ALTER TABLE oauth_tokens ADD COLUMN IF NOT EXISTS scopes TEXT;
ALTER TABLE oauth_tokens ADD COLUMN IF NOT EXISTS meta JSONB DEFAULT '{}';

-- Make access_token nullable (populated on first token exchange, not at credential save time)
ALTER TABLE oauth_tokens ALTER COLUMN access_token DROP NOT NULL;

-- Add unique constraint: one credential set per store per service
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'oauth_tokens_store_id_service_key'
  ) THEN
    ALTER TABLE oauth_tokens ADD CONSTRAINT oauth_tokens_store_id_service_key UNIQUE (store_id, service);
  END IF;
END $$;
