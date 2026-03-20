-- ============================================
-- Migration 005: Product Entity System
-- Renames research_products → products and adds
-- product_id FK to all module tables, enabling
-- unified product tracking across the pipeline.
-- ============================================

-- ============================================
-- STEP 1: Rename research_products → products
-- ============================================

ALTER TABLE research_products RENAME TO products;

-- Rename indexes
ALTER INDEX IF EXISTS idx_research_products_store RENAME TO idx_products_store;
ALTER INDEX IF EXISTS idx_research_products_status RENAME TO idx_products_status;

-- ============================================
-- STEP 2: Add new columns to products table
-- ============================================

-- Pipeline status tracks where the product is in the workflow
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS pipeline_status TEXT DEFAULT 'research'
    CHECK (pipeline_status IN ('research', 'imported', 'copy_created', 'pushed_to_shopify', 'ad_testing', 'live', 'killed'));

-- Shopify product ID (populated when pushed)
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS shopify_product_id TEXT;

-- Compare-at price (original price before discount, used by Shopify)
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS compare_at_price NUMERIC;

-- Update testing_status CHECK to match all app-used values
ALTER TABLE products DROP CONSTRAINT IF EXISTS research_products_testing_status_check;
ALTER TABLE products ADD CONSTRAINT products_testing_status_check
  CHECK (testing_status IN ('', 'Queued', 'Imported', 'Scheduled', 'Live', 'Killed', 'Testing'));

-- ============================================
-- STEP 3: Add product_id FK to module tables
-- ============================================

-- product_copies: add product_id (eventually replaces research_product_id)
ALTER TABLE product_copies
  ADD COLUMN IF NOT EXISTS product_id UUID REFERENCES products(id) ON DELETE SET NULL;

-- creatives: add product_id
ALTER TABLE creatives
  ADD COLUMN IF NOT EXISTS product_id UUID REFERENCES products(id) ON DELETE SET NULL;

-- ad_creator_campaigns: add product_id
ALTER TABLE ad_creator_campaigns
  ADD COLUMN IF NOT EXISTS product_id UUID REFERENCES products(id) ON DELETE SET NULL;

-- ad_campaigns: add product_id
ALTER TABLE ad_campaigns
  ADD COLUMN IF NOT EXISTS product_id UUID REFERENCES products(id) ON DELETE SET NULL;

-- product_cogs: add product_id
ALTER TABLE product_cogs
  ADD COLUMN IF NOT EXISTS product_id UUID REFERENCES products(id) ON DELETE SET NULL;

-- ============================================
-- STEP 4: Create indexes on new FK columns
-- ============================================

CREATE INDEX IF NOT EXISTS idx_product_copies_product_id ON product_copies(product_id);
CREATE INDEX IF NOT EXISTS idx_creatives_product_id ON creatives(product_id);
CREATE INDEX IF NOT EXISTS idx_ad_creator_product_id ON ad_creator_campaigns(product_id);
CREATE INDEX IF NOT EXISTS idx_ad_campaigns_product_id ON ad_campaigns(product_id);
CREATE INDEX IF NOT EXISTS idx_product_cogs_product_id ON product_cogs(product_id);

-- ============================================
-- STEP 5: Backfill product_id on existing data
-- ============================================

-- product_copies: use existing research_product_id FK
UPDATE product_copies
SET product_id = research_product_id
WHERE research_product_id IS NOT NULL
  AND product_id IS NULL;

-- product_copies: fallback by store_id + product_name for unlinked rows
UPDATE product_copies pc
SET product_id = p.id
FROM products p
WHERE pc.store_id = p.store_id
  AND LOWER(TRIM(pc.product_name)) = LOWER(TRIM(p.product_name))
  AND pc.product_id IS NULL
  AND p.product_name IS NOT NULL;

-- creatives: match by store_id + product_name
UPDATE creatives c
SET product_id = p.id
FROM products p
WHERE c.store_id = p.store_id
  AND LOWER(TRIM(c.product_name)) = LOWER(TRIM(p.product_name))
  AND c.product_id IS NULL
  AND p.product_name IS NOT NULL;

-- ad_creator_campaigns: match by store_id + product_name
UPDATE ad_creator_campaigns acc
SET product_id = p.id
FROM products p
WHERE acc.store_id = p.store_id
  AND LOWER(TRIM(acc.product_name)) = LOWER(TRIM(p.product_name))
  AND acc.product_id IS NULL
  AND p.product_name IS NOT NULL;

-- ad_campaigns: match by store_id + product name
UPDATE ad_campaigns ac
SET product_id = p.id
FROM products p
WHERE ac.store_id = p.store_id
  AND LOWER(TRIM(ac.product)) = LOWER(TRIM(p.product_name))
  AND ac.product_id IS NULL
  AND p.product_name IS NOT NULL;

-- ad_campaigns: also try via ad_creator_campaigns meta_campaign_id chain
UPDATE ad_campaigns ac
SET product_id = acc.product_id
FROM ad_creator_campaigns acc
WHERE ac.meta_campaign_id = acc.meta_campaign_id
  AND ac.store_id = acc.store_id
  AND ac.product_id IS NULL
  AND acc.product_id IS NOT NULL
  AND acc.meta_campaign_id IS NOT NULL;

-- product_cogs: match by store_id + product_name
UPDATE product_cogs cog
SET product_id = p.id
FROM products p
WHERE cog.store_id = p.store_id
  AND LOWER(TRIM(cog.product_name)) = LOWER(TRIM(p.product_name))
  AND cog.product_id IS NULL
  AND p.product_name IS NOT NULL;

-- ============================================
-- STEP 6: Backfill pipeline_status from data
-- ============================================

-- Products that were imported
UPDATE products
SET pipeline_status = 'imported'
WHERE testing_status = 'Imported'
  AND pipeline_status = 'research';

-- Products that have been pushed to Shopify
UPDATE products p
SET pipeline_status = 'pushed_to_shopify',
    shopify_product_id = COALESCE(p.shopify_product_id, pc.shopify_product_id)
FROM product_copies pc
WHERE pc.product_id = p.id
  AND pc.push_status = 'pushed'
  AND p.pipeline_status IN ('research', 'imported', 'copy_created');

-- Products with live campaigns
UPDATE products p
SET pipeline_status = 'live'
WHERE EXISTS (
  SELECT 1 FROM ad_campaigns ac
  WHERE ac.product_id = p.id AND ac.status = 'Active'
)
AND p.pipeline_status NOT IN ('killed');

-- Products that were killed
UPDATE products
SET pipeline_status = 'killed'
WHERE testing_status = 'Killed'
  AND pipeline_status != 'killed';

-- ============================================
-- STEP 7: Name propagation trigger
-- When product_name changes on products table,
-- cascade to all child tables automatically.
-- ============================================

CREATE OR REPLACE FUNCTION on_product_name_changed()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.product_name IS DISTINCT FROM NEW.product_name THEN
    UPDATE product_copies SET product_name = NEW.product_name
      WHERE product_id = NEW.id;
    UPDATE creatives SET product_name = NEW.product_name
      WHERE product_id = NEW.id;
    UPDATE ad_creator_campaigns SET product_name = NEW.product_name
      WHERE product_id = NEW.id;
    UPDATE ad_campaigns SET product_name = NEW.product_name
      WHERE product_id = NEW.id;
    UPDATE product_cogs SET product_name = NEW.product_name
      WHERE product_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_product_name_sync ON products;
CREATE TRIGGER trg_product_name_sync
  AFTER UPDATE ON products
  FOR EACH ROW
  EXECUTE FUNCTION on_product_name_changed();

-- ============================================
-- STEP 8: COG propagation trigger
-- When COG changes on products table,
-- auto-upsert into product_cogs table.
-- ============================================

CREATE OR REPLACE FUNCTION on_product_cog_changed()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.cog IS NOT NULL AND (OLD.cog IS NULL OR OLD.cog IS DISTINCT FROM NEW.cog) THEN
    INSERT INTO product_cogs (store_id, product_id, product_name, cog_usd, updated_at)
    VALUES (NEW.store_id, NEW.id, NEW.product_name, NEW.cog, now())
    ON CONFLICT (store_id, product_name)
    DO UPDATE SET
      cog_usd = EXCLUDED.cog_usd,
      product_id = EXCLUDED.product_id,
      updated_at = now();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_product_cog_sync ON products;
CREATE TRIGGER trg_product_cog_sync
  AFTER UPDATE ON products
  FOR EACH ROW
  EXECUTE FUNCTION on_product_cog_changed();

-- Also fire on insert if COG is set
DROP TRIGGER IF EXISTS trg_product_cog_sync_insert ON products;
CREATE TRIGGER trg_product_cog_sync_insert
  AFTER INSERT ON products
  FOR EACH ROW
  WHEN (NEW.cog IS NOT NULL)
  EXECUTE FUNCTION on_product_cog_changed();

-- ============================================
-- STEP 9: Update cross-module triggers to use product_id
-- ============================================

-- product_copies push → auto-create creative (now with product_id)
CREATE OR REPLACE FUNCTION on_product_pushed()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.push_status = 'pushed' AND (OLD.push_status IS NULL OR OLD.push_status != 'pushed') THEN
    -- Update parent product pipeline_status + shopify_product_id
    IF NEW.product_id IS NOT NULL THEN
      UPDATE products SET
        pipeline_status = 'pushed_to_shopify',
        shopify_product_id = COALESCE(NEW.shopify_product_id, shopify_product_id)
      WHERE id = NEW.product_id;
    END IF;

    -- Auto-create creative placeholder if none exists
    IF NOT EXISTS (
      SELECT 1 FROM creatives
      WHERE store_id = NEW.store_id
        AND (
          (product_id IS NOT NULL AND product_id = NEW.product_id)
          OR (product_id IS NULL AND product_name = NEW.product_name)
        )
    ) THEN
      INSERT INTO creatives (store_id, product_id, product_name, prompt_template, prompt, status, type)
      VALUES (NEW.store_id, NEW.product_id, NEW.product_name, 'Auto-queued',
        'Awaiting creative generation for ' || COALESCE(NEW.product_name, 'product'),
        'generating', 'image');
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Re-create triggers with updated function
DROP TRIGGER IF EXISTS trg_product_pushed ON product_copies;
CREATE TRIGGER trg_product_pushed
  AFTER UPDATE ON product_copies
  FOR EACH ROW EXECUTE FUNCTION on_product_pushed();

DROP TRIGGER IF EXISTS trg_product_pushed_insert ON product_copies;
CREATE TRIGGER trg_product_pushed_insert
  AFTER INSERT ON product_copies
  FOR EACH ROW WHEN (NEW.push_status = 'pushed')
  EXECUTE FUNCTION on_product_pushed();

-- creative saved → auto-attach to campaigns (now with product_id)
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
    WHERE store_id = NEW.store_id
      AND (
        (product_id IS NOT NULL AND product_id = NEW.product_id)
        OR (product_id IS NULL AND product_name = NEW.product_name)
      )
      AND status IN ('Queued', 'Ready');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_creative_saved ON creatives;
CREATE TRIGGER trg_creative_saved
  AFTER UPDATE ON creatives
  FOR EACH ROW EXECUTE FUNCTION on_creative_saved();

-- ============================================
-- STEP 10: Update updated_at trigger for renamed table
-- ============================================

DROP TRIGGER IF EXISTS set_updated_at ON products;
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================
-- STEP 11: RLS policies for renamed table
-- ============================================

ALTER TABLE products ENABLE ROW LEVEL SECURITY;

-- Allow all operations for authenticated users on their stores
DROP POLICY IF EXISTS "products_select" ON products;
CREATE POLICY "products_select" ON products
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "products_insert" ON products;
CREATE POLICY "products_insert" ON products
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "products_update" ON products;
CREATE POLICY "products_update" ON products
  FOR UPDATE USING (true);

DROP POLICY IF EXISTS "products_delete" ON products;
CREATE POLICY "products_delete" ON products
  FOR DELETE USING (true);
