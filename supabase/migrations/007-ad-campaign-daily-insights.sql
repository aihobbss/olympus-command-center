-- Migration 007: Add daily insights table for time-series campaign analytics
-- Enables period filtering (7d, 30d, etc.) for ad spend and all campaign metrics.
-- The ad_campaigns table retains campaign metadata (status, budget, name);
-- all time-series metrics now live here, one row per campaign per day.

-- ── 1. Create the daily insights table ──────────────────────────

CREATE TABLE IF NOT EXISTS ad_campaign_daily_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id TEXT NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  meta_campaign_id TEXT NOT NULL,
  ad_account_id TEXT NOT NULL,
  date DATE NOT NULL,
  spend NUMERIC DEFAULT 0,
  impressions INTEGER DEFAULT 0,
  clicks INTEGER DEFAULT 0,
  cpc NUMERIC DEFAULT 0,
  ctr NUMERIC DEFAULT 0,
  atc INTEGER DEFAULT 0,
  purchases INTEGER DEFAULT 0,
  purchase_value NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(store_id, meta_campaign_id, date)
);

CREATE INDEX idx_daily_insights_store_date ON ad_campaign_daily_insights(store_id, date);
CREATE INDEX idx_daily_insights_account ON ad_campaign_daily_insights(ad_account_id);
CREATE INDEX idx_daily_insights_campaign ON ad_campaign_daily_insights(meta_campaign_id);

-- ── 2. RLS policies ─────────────────────────────────────────────

ALTER TABLE ad_campaign_daily_insights ENABLE ROW LEVEL SECURITY;

-- Users can read insights for stores they belong to
-- Uses get_user_store_ids() (SECURITY DEFINER) to bypass user_stores RLS
CREATE POLICY "Users can read own store daily insights"
  ON ad_campaign_daily_insights FOR SELECT
  USING (store_id = ANY(get_user_store_ids()));

-- Service role handles all writes (via API routes)
-- No INSERT/UPDATE/DELETE policies needed for anon — writes go through supabaseAdmin
