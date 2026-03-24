-- Vantage Command Center — RLS Policies
-- Run after schema.sql

-- ============================================
-- HELPER: Get user's store IDs
-- ============================================
CREATE OR REPLACE FUNCTION get_user_store_ids()
RETURNS TEXT[] AS $$
  SELECT COALESCE(
    array_agg(store_id),
    ARRAY[]::TEXT[]
  )
  FROM user_stores
  WHERE user_id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Helper: Check if user is admin
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Helper: Check if user is approved
CREATE OR REPLACE FUNCTION is_approved()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND approved = true
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ============================================
-- PROFILES
-- ============================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own profile"
  ON profiles FOR SELECT
  USING (id = auth.uid());

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

CREATE POLICY "Admins can read all profiles"
  ON profiles FOR SELECT
  USING (is_admin());

CREATE POLICY "Admins can update all profiles"
  ON profiles FOR UPDATE
  USING (is_admin());

-- ============================================
-- STORES
-- ============================================
ALTER TABLE stores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read their stores"
  ON stores FOR SELECT
  USING (id = ANY(get_user_store_ids()) OR is_admin());

CREATE POLICY "Users can insert stores they own"
  ON stores FOR INSERT
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Owners can update their stores"
  ON stores FOR UPDATE
  USING (owner_id = auth.uid() OR is_admin());

-- ============================================
-- USER_STORES
-- ============================================
ALTER TABLE user_stores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own memberships"
  ON user_stores FOR SELECT
  USING (user_id = auth.uid() OR is_admin());

CREATE POLICY "Store owners can manage memberships"
  ON user_stores FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM stores
      WHERE stores.id = user_stores.store_id
      AND stores.owner_id = auth.uid()
    )
    OR is_admin()
  );

-- ============================================
-- OAUTH_TOKENS (sensitive — strict access)
-- ============================================
ALTER TABLE oauth_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own tokens"
  ON oauth_tokens FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can manage own tokens"
  ON oauth_tokens FOR ALL
  USING (user_id = auth.uid());

-- ============================================
-- RESEARCH_PRODUCTS
-- ============================================
ALTER TABLE research_products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read research products for their stores"
  ON research_products FOR SELECT
  USING (store_id = ANY(get_user_store_ids()));

CREATE POLICY "Users can insert research products for their stores"
  ON research_products FOR INSERT
  WITH CHECK (store_id = ANY(get_user_store_ids()));

CREATE POLICY "Users can update research products for their stores"
  ON research_products FOR UPDATE
  USING (store_id = ANY(get_user_store_ids()));

CREATE POLICY "Users can delete research products for their stores"
  ON research_products FOR DELETE
  USING (store_id = ANY(get_user_store_ids()));

-- ============================================
-- PRODUCT_COPIES
-- ============================================
ALTER TABLE product_copies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read product copies for their stores"
  ON product_copies FOR SELECT
  USING (store_id = ANY(get_user_store_ids()));

CREATE POLICY "Users can insert product copies for their stores"
  ON product_copies FOR INSERT
  WITH CHECK (store_id = ANY(get_user_store_ids()));

CREATE POLICY "Users can update product copies for their stores"
  ON product_copies FOR UPDATE
  USING (store_id = ANY(get_user_store_ids()));

CREATE POLICY "Users can delete product copies for their stores"
  ON product_copies FOR DELETE
  USING (store_id = ANY(get_user_store_ids()));

-- ============================================
-- AD_CREATOR_CAMPAIGNS
-- ============================================
ALTER TABLE ad_creator_campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can CRUD ad creator campaigns for their stores"
  ON ad_creator_campaigns FOR ALL
  USING (store_id = ANY(get_user_store_ids()));

-- ============================================
-- AD_CAMPAIGNS
-- ============================================
ALTER TABLE ad_campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read ad campaigns for their stores"
  ON ad_campaigns FOR SELECT
  USING (store_id = ANY(get_user_store_ids()));

CREATE POLICY "Users can update ad campaigns for their stores"
  ON ad_campaigns FOR UPDATE
  USING (store_id = ANY(get_user_store_ids()));

-- ============================================
-- AD_CAMPAIGN_DAILY_INSIGHTS
-- ============================================
ALTER TABLE ad_campaign_daily_insights ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own store daily insights"
  ON ad_campaign_daily_insights FOR SELECT
  USING (store_id = ANY(get_user_store_ids()));

-- ============================================
-- AD_ACTIONS
-- ============================================
ALTER TABLE ad_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read ad actions for their stores"
  ON ad_actions FOR SELECT
  USING (store_id = ANY(get_user_store_ids()));

CREATE POLICY "Users can insert ad actions for their stores"
  ON ad_actions FOR INSERT
  WITH CHECK (store_id = ANY(get_user_store_ids()));

-- ============================================
-- CREATIVES
-- ============================================
ALTER TABLE creatives ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can CRUD creatives for their stores"
  ON creatives FOR ALL
  USING (store_id = ANY(get_user_store_ids()));

-- ============================================
-- PROFIT_LOGS
-- ============================================
ALTER TABLE profit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read profit logs for their stores"
  ON profit_logs FOR SELECT
  USING (store_id = ANY(get_user_store_ids()));

CREATE POLICY "Users can manage profit logs for their stores"
  ON profit_logs FOR ALL
  USING (store_id = ANY(get_user_store_ids()));

-- ============================================
-- PRODUCT_COGS
-- ============================================
ALTER TABLE product_cogs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can CRUD product COGs for their stores"
  ON product_cogs FOR ALL
  USING (store_id = ANY(get_user_store_ids()));

-- ============================================
-- CUSTOMER_CASES (deferred but policy-ready)
-- ============================================
ALTER TABLE customer_cases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can CRUD customer cases for their stores"
  ON customer_cases FOR ALL
  USING (store_id = ANY(get_user_store_ids()));

-- ============================================
-- CASE_MESSAGES
-- ============================================
ALTER TABLE case_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can CRUD case messages for their cases"
  ON case_messages FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM customer_cases
      WHERE customer_cases.id = case_messages.case_id
      AND customer_cases.store_id = ANY(get_user_store_ids())
    )
  );

-- ============================================
-- SOP_TEMPLATES
-- ============================================
ALTER TABLE sop_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can CRUD SOP templates for their stores"
  ON sop_templates FOR ALL
  USING (store_id = ANY(get_user_store_ids()) OR store_id IS NULL);

-- ============================================
-- COACHING_ACCESS
-- ============================================
ALTER TABLE coaching_access ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Coaches can read their access requests"
  ON coaching_access FOR SELECT
  USING (coach_id = auth.uid());

CREATE POLICY "Store owners can read access requests to their stores"
  ON coaching_access FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM stores
      WHERE stores.id = coaching_access.store_id
      AND stores.owner_id = auth.uid()
    )
  );

CREATE POLICY "Store owners can update access requests"
  ON coaching_access FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM stores
      WHERE stores.id = coaching_access.store_id
      AND stores.owner_id = auth.uid()
    )
  );

CREATE POLICY "Coaches can insert access requests"
  ON coaching_access FOR INSERT
  WITH CHECK (coach_id = auth.uid());

-- ============================================
-- STORAGE BUCKET: size-charts
-- ============================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('size-charts', 'size-charts', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Authenticated users can upload size charts"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'size-charts'
    AND auth.role() = 'authenticated'
  );

CREATE POLICY "Authenticated users can read size charts"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'size-charts'
    AND auth.role() = 'authenticated'
  );

CREATE POLICY "Users can delete own size charts"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'size-charts'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
