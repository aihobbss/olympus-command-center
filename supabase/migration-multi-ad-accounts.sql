-- Migration: Multi-Ad-Account Support
-- Allows users to connect multiple Meta ad accounts and track campaigns per account.
-- Run this in Supabase SQL Editor.

-- ============================================
-- 1. NEW TABLE: user_ad_accounts
-- ============================================
-- Stores all discovered Meta ad accounts for each user.
-- Users toggle which accounts are "active" for syncing/metrics.

CREATE TABLE IF NOT EXISTS user_ad_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  store_id TEXT NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  ad_account_id TEXT NOT NULL,       -- Meta format: "act_123456789"
  account_name TEXT DEFAULT '',      -- Human-readable name from Meta
  account_status INTEGER DEFAULT 1,  -- Meta account_status (1=ACTIVE, 2=DISABLED, etc.)
  active BOOLEAN DEFAULT true,       -- User toggle: include in syncs/metrics
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, ad_account_id)
);

CREATE INDEX idx_user_ad_accounts_user ON user_ad_accounts(user_id);
CREATE INDEX idx_user_ad_accounts_store ON user_ad_accounts(store_id);

-- Apply updated_at trigger
DROP TRIGGER IF EXISTS set_updated_at ON user_ad_accounts;
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON user_ad_accounts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- RLS: users can only access their own ad accounts
ALTER TABLE user_ad_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own ad accounts"
  ON user_ad_accounts FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own ad accounts"
  ON user_ad_accounts FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own ad accounts"
  ON user_ad_accounts FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete own ad accounts"
  ON user_ad_accounts FOR DELETE
  USING (user_id = auth.uid());

-- ============================================
-- 2. ADD ad_account_id TO ad_campaigns
-- ============================================
-- Track which ad account each campaign belongs to.

ALTER TABLE ad_campaigns
  ADD COLUMN IF NOT EXISTS ad_account_id TEXT;

CREATE INDEX IF NOT EXISTS idx_ad_campaigns_ad_account ON ad_campaigns(ad_account_id);

-- ============================================
-- 3. ADD ad_account_id TO ad_creator_campaigns
-- ============================================
-- Track which ad account was selected when pushing a campaign.

ALTER TABLE ad_creator_campaigns
  ADD COLUMN IF NOT EXISTS ad_account_id TEXT;
