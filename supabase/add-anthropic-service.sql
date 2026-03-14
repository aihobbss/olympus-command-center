-- Add 'anthropic' and 'nanobanana' to the oauth_tokens service check constraint
-- Run this in Supabase Dashboard → SQL Editor

ALTER TABLE oauth_tokens DROP CONSTRAINT IF EXISTS oauth_tokens_service_check;
ALTER TABLE oauth_tokens ADD CONSTRAINT oauth_tokens_service_check
  CHECK (service IN ('facebook', 'google', 'shopify', 'anthropic', 'nanobanana'));
