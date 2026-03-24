-- Migration 008: Fix RLS policy on ad_campaign_daily_insights
-- The original policy (migration 007) used an inline subquery on user_stores,
-- but user_stores has its own RLS, so the anon-key caller couldn't read it.
-- All other tables use get_user_store_ids() which is SECURITY DEFINER and bypasses RLS.

DROP POLICY IF EXISTS "Users can read own store daily insights" ON ad_campaign_daily_insights;

CREATE POLICY "Users can read own store daily insights"
  ON ad_campaign_daily_insights FOR SELECT
  USING (store_id = ANY(get_user_store_ids()));
