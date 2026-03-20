-- Vantage Command Center — Full Database Schema
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor → New Query)

-- ============================================
-- 1. PROFILES (extends Supabase auth.users)
-- ============================================
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  full_name TEXT,
  active_store_id TEXT,
  role TEXT DEFAULT 'owner' CHECK (role IN ('owner', 'collaborator', 'admin')),
  approved BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, approved)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    false
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================
-- 2. STORES
-- ============================================
CREATE TABLE IF NOT EXISTS stores (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  market TEXT NOT NULL CHECK (market IN ('UK', 'AU', 'US')),
  currency TEXT NOT NULL CHECK (currency IN ('GBP', 'AUD', 'USD')),
  owner_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  shopify_domain TEXT,
  meta_account_id TEXT,
  exchange_rate_to_usd NUMERIC DEFAULT 1.0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- 3. USER-STORE MEMBERSHIPS
-- ============================================
CREATE TABLE IF NOT EXISTS user_stores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  store_id TEXT NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'owner' CHECK (role IN ('owner', 'collaborator')),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, store_id)
);

-- ============================================
-- 4. OAUTH TOKENS (per-store, per-service credentials)
-- ============================================
-- Credentials are per-store because each user connects their own
-- Shopify store, Facebook ad account, etc. App-level secrets
-- (Facebook App ID/Secret, Google service account) stay in .env.local.
--
-- Shopify (2026+): Uses client_credentials grant. Store client_id +
-- client_secret permanently; access_token is cached (expires every 24h)
-- and auto-refreshed via POST to store's OAuth endpoint.
--
-- Facebook: User OAuth flow. access_token expires every 60 days.
-- Re-prompt user 7 days before expiry.
--
-- Google: App-level service account in .env.local, per-store sheet IDs here.
CREATE TABLE IF NOT EXISTS oauth_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  service TEXT NOT NULL CHECK (service IN ('shopify', 'facebook', 'google')),
  store_id TEXT REFERENCES stores(id) ON DELETE CASCADE,
  client_id TEXT,           -- Shopify: app client ID (permanent)
  client_secret TEXT,       -- Shopify: app client secret (permanent)
  access_token TEXT,        -- Cached token (Shopify: 24h, Facebook: 60d)
  refresh_token TEXT,       -- Facebook only
  scopes TEXT,              -- Granted scopes (for validation)
  expires_at TIMESTAMPTZ,   -- When access_token expires
  meta JSONB DEFAULT '{}',  -- Service-specific data (e.g. ad_account_id, sheet_id)
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(store_id, service)
);

-- ============================================
-- 4b. USER AD ACCOUNTS (multiple Meta ad accounts per user)
-- ============================================
-- Users can connect multiple Meta ad accounts (accounts get banned,
-- new ones are created). All active accounts are synced for metrics.

CREATE TABLE IF NOT EXISTS user_ad_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  store_id TEXT NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  ad_account_id TEXT NOT NULL,       -- Meta format: "act_123456789"
  account_name TEXT DEFAULT '',
  account_status INTEGER DEFAULT 1,  -- Meta: 1=ACTIVE, 2=DISABLED
  active BOOLEAN DEFAULT true,       -- User toggle for sync inclusion
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, ad_account_id)
);

CREATE INDEX idx_user_ad_accounts_user ON user_ad_accounts(user_id);
CREATE INDEX idx_user_ad_accounts_store ON user_ad_accounts(store_id);

-- ============================================
-- 5. PRODUCTS (unified product entity, renamed from research_products)
-- ============================================
CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id TEXT NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  product_name TEXT,
  ad_link TEXT,
  store_link TEXT,
  image_url TEXT,
  ad_copy TEXT,
  countries TEXT[],
  gender TEXT,
  days_active INTEGER,
  brands_running INTEGER,
  creatives_count INTEGER,
  testing_status TEXT CHECK (testing_status IN ('', 'Queued', 'Testing', 'Killed', 'Imported', 'Scheduled', 'Live')),
  creative_saved BOOLEAN DEFAULT false,
  cog NUMERIC,
  product_type TEXT,
  pricing NUMERIC,
  discount_percent NUMERIC,
  compare_at_price NUMERIC,
  notes TEXT,
  scraped_from TEXT CHECK (scraped_from IN ('afterlib', 'winning_hunter', NULL)),
  pipeline_status TEXT DEFAULT 'research' CHECK (pipeline_status IN ('research', 'imported', 'copy_created', 'pushed_to_shopify', 'ad_testing', 'live', 'killed')),
  shopify_product_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_products_store ON products(store_id);
CREATE INDEX idx_products_status ON products(testing_status);

-- ============================================
-- 6. PRODUCT COPIES
-- ============================================
CREATE TABLE IF NOT EXISTS product_copies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id TEXT NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  research_product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  product_name TEXT NOT NULL,
  product_url TEXT,
  image_url TEXT,
  ad_status TEXT DEFAULT 'red' CHECK (ad_status IN ('red', 'yellow', 'green')),
  shopify_description TEXT,
  facebook_copy TEXT,
  size_chart_image_url TEXT,
  size_chart_table TEXT,
  size_chart_status TEXT DEFAULT '',
  copy_status TEXT DEFAULT '',
  push_status TEXT DEFAULT '' CHECK (push_status IN ('', 'pushing', 'pushed')),
  shopify_product_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_product_copies_store ON product_copies(store_id);
CREATE INDEX idx_product_copies_push ON product_copies(push_status);

-- ============================================
-- 7. AD CREATOR CAMPAIGNS (test campaigns)
-- ============================================
CREATE TABLE IF NOT EXISTS ad_creator_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id TEXT NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  product_name TEXT,
  product_url TEXT,
  primary_text TEXT,
  headline TEXT,
  description TEXT,
  cta TEXT DEFAULT 'Shop Now',
  country TEXT,
  daily_budget NUMERIC DEFAULT 30,
  gender TEXT,
  creatives JSONB DEFAULT '[]',
  status TEXT DEFAULT 'Queued',
  meta_campaign_id TEXT,
  ad_account_id TEXT,              -- Which Meta ad account this was pushed to
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_ad_creator_store ON ad_creator_campaigns(store_id);

-- ============================================
-- 8. AD CAMPAIGNS (synced from Meta API)
-- ============================================
CREATE TABLE IF NOT EXISTS ad_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id TEXT NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  meta_campaign_id TEXT,
  ad_account_id TEXT,              -- Which Meta ad account owns this campaign
  campaign_name TEXT,
  product TEXT,
  spend NUMERIC DEFAULT 0,
  budget NUMERIC DEFAULT 0,
  cpc NUMERIC DEFAULT 0,
  ctr NUMERIC DEFAULT 0,
  atc INTEGER DEFAULT 0,
  roas NUMERIC DEFAULT 0,
  revenue NUMERIC DEFAULT 0,
  orders INTEGER DEFAULT 0,
  profit NUMERIC DEFAULT 0,
  status TEXT CHECK (status IN ('Active', 'Paused', 'Killed', 'Scaling')),
  recommendation TEXT CHECK (recommendation IN ('Kill', 'Scale', 'Watch', 'Pass', NULL)),
  recommendation_reason TEXT,
  last_synced_at TIMESTAMPTZ,
  budget_history JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(store_id, meta_campaign_id)
);

CREATE INDEX idx_ad_campaigns_store ON ad_campaigns(store_id);
CREATE INDEX idx_ad_campaigns_ad_account ON ad_campaigns(ad_account_id);

-- ============================================
-- 9. AD ACTIONS (audit trail)
-- ============================================
CREATE TABLE IF NOT EXISTS ad_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id TEXT NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  campaign_id UUID REFERENCES ad_campaigns(id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK (action IN ('kill', 'scale', 'pass')),
  details JSONB DEFAULT '{}',
  performed_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- 10. CREATIVES (URLs only, no file storage)
-- ============================================
CREATE TABLE IF NOT EXISTS creatives (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id TEXT NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  product_name TEXT,
  prompt_template TEXT,
  prompt TEXT,
  asset_url TEXT,
  thumbnail_url TEXT,
  type TEXT DEFAULT 'image' CHECK (type IN ('image', 'video', 'carousel')),
  status TEXT DEFAULT 'generating' CHECK (status IN ('generating', 'ready', 'saved', 'archived')),
  reference_image_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_creatives_store ON creatives(store_id);
CREATE INDEX idx_creatives_product ON creatives(product_name);

-- ============================================
-- 11. PROFIT LOGS (daily P&L)
-- ============================================
CREATE TABLE IF NOT EXISTS profit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id TEXT NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  revenue_usd NUMERIC DEFAULT 0,
  cog_usd NUMERIC DEFAULT 0,
  ad_spend_usd NUMERIC DEFAULT 0,
  transaction_fee_usd NUMERIC DEFAULT 0,
  profit_usd NUMERIC DEFAULT 0,
  roas NUMERIC DEFAULT 0,
  profit_percent NUMERIC DEFAULT 0,
  orders INTEGER DEFAULT 0,
  synced_from TEXT CHECK (synced_from IN ('auto', 'manual', NULL)),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(store_id, date)
);

CREATE INDEX idx_profit_logs_store_date ON profit_logs(store_id, date);

-- ============================================
-- 12. PRODUCT COGS
-- ============================================
CREATE TABLE IF NOT EXISTS product_cogs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id TEXT NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  product_name TEXT NOT NULL,
  cog_usd NUMERIC NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(store_id, product_name)
);

-- ============================================
-- 13. CUSTOMER CASES (deferred — schema ready)
-- ============================================
CREATE TABLE IF NOT EXISTS customer_cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id TEXT NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  customer_name TEXT,
  email TEXT,
  subject TEXT,
  classification TEXT CHECK (classification IN ('Quality Issue', 'Sizing', 'Wrong Item', 'Delivery', 'Trustpilot', 'Other')),
  order_number TEXT,
  product TEXT,
  order_date TIMESTAMPTZ,
  tracking_status TEXT,
  lifetime_value NUMERIC DEFAULT 0,
  order_count INTEGER DEFAULT 0,
  previous_refunds INTEGER DEFAULT 0,
  is_repeat_claimer BOOLEAN DEFAULT false,
  status TEXT DEFAULT 'open' CHECK (status IN ('open', 'resolved', 'escalated')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- 14. CASE MESSAGES (deferred — schema ready)
-- ============================================
CREATE TABLE IF NOT EXISTS case_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES customer_cases(id) ON DELETE CASCADE,
  sender TEXT NOT NULL CHECK (sender IN ('customer', 'agent')),
  body TEXT NOT NULL,
  sent_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- 15. SOP TEMPLATES (deferred — schema ready)
-- ============================================
CREATE TABLE IF NOT EXISTS sop_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id TEXT REFERENCES stores(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category TEXT CHECK (category IN ('Quality Issue', 'Sizing', 'Wrong Item', 'Delivery', 'Trustpilot')),
  subject TEXT,
  body TEXT NOT NULL,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- 16. COACHING ACCESS (deferred — schema ready)
-- ============================================
CREATE TABLE IF NOT EXISTS coaching_access (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  store_id TEXT NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'denied', 'revoked')),
  requested_at TIMESTAMPTZ DEFAULT now(),
  responded_at TIMESTAMPTZ,
  UNIQUE(coach_id, store_id)
);

-- ============================================
-- UPDATED_AT TRIGGER (auto-update timestamps)
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to all tables with updated_at
DO $$
DECLARE
  t TEXT;
BEGIN
  FOR t IN
    SELECT unnest(ARRAY[
      'profiles', 'products', 'product_copies',
      'ad_creator_campaigns', 'ad_campaigns', 'oauth_tokens',
      'customer_cases', 'user_ad_accounts'
    ])
  LOOP
    EXECUTE format('
      DROP TRIGGER IF EXISTS set_updated_at ON %I;
      CREATE TRIGGER set_updated_at
        BEFORE UPDATE ON %I
        FOR EACH ROW EXECUTE FUNCTION update_updated_at();
    ', t, t);
  END LOOP;
END;
$$;

-- ============================================
-- CROSS-MODULE TRIGGERS
-- ============================================

-- When product_copies.push_status → 'pushed', auto-create creative placeholder
CREATE OR REPLACE FUNCTION on_product_pushed()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.push_status = 'pushed' AND (OLD.push_status IS NULL OR OLD.push_status != 'pushed') THEN
    IF NOT EXISTS (
      SELECT 1 FROM creatives
      WHERE store_id = NEW.store_id AND product_name = NEW.product_name
    ) THEN
      INSERT INTO creatives (store_id, product_name, prompt_template, prompt, status, type)
      VALUES (NEW.store_id, NEW.product_name, 'Auto-queued',
        'Awaiting creative generation for ' || COALESCE(NEW.product_name, 'product'),
        'generating', 'image');
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_product_pushed ON product_copies;
CREATE TRIGGER trg_product_pushed
  AFTER UPDATE ON product_copies
  FOR EACH ROW EXECUTE FUNCTION on_product_pushed();

DROP TRIGGER IF EXISTS trg_product_pushed_insert ON product_copies;
CREATE TRIGGER trg_product_pushed_insert
  AFTER INSERT ON product_copies
  FOR EACH ROW WHEN (NEW.push_status = 'pushed')
  EXECUTE FUNCTION on_product_pushed();

-- When creatives.status → 'saved', auto-attach to matching ad_creator_campaigns
CREATE OR REPLACE FUNCTION on_creative_saved()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'saved' AND (OLD.status IS NULL OR OLD.status != 'saved') THEN
    UPDATE ad_creator_campaigns
    SET creatives = creatives || jsonb_build_array(jsonb_build_object(
      'id', NEW.id::TEXT, 'type', NEW.type,
      'asset_url', COALESCE(NEW.asset_url, ''),
      'thumbnail_url', COALESCE(NEW.thumbnail_url, ''),
      'prompt_template', COALESCE(NEW.prompt_template, '')))
    WHERE store_id = NEW.store_id AND product_name = NEW.product_name
      AND status IN ('Queued', 'Ready');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_creative_saved ON creatives;
CREATE TRIGGER trg_creative_saved
  AFTER UPDATE ON creatives
  FOR EACH ROW EXECUTE FUNCTION on_creative_saved();
