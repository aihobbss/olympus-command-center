-- Cross-Module Database Triggers
-- 1. When product_copies.push_status → 'pushed', auto-insert into creatives batch queue
-- 2. When creatives.status → 'saved', auto-attach to matching ad_creator_campaigns

-- ============================================
-- TRIGGER 1: Pushed Product → Auto-create Creative placeholder
-- ============================================
-- When a product copy is pushed to Shopify, create a "queued" creative
-- record so the batch queue picks it up automatically.

CREATE OR REPLACE FUNCTION on_product_pushed()
RETURNS TRIGGER AS $$
BEGIN
  -- Only fire when push_status changes to 'pushed'
  IF NEW.push_status = 'pushed' AND (OLD.push_status IS NULL OR OLD.push_status != 'pushed') THEN
    -- Check if a creative already exists for this product + store
    IF NOT EXISTS (
      SELECT 1 FROM creatives
      WHERE store_id = NEW.store_id
        AND product_name = NEW.product_name
    ) THEN
      INSERT INTO creatives (store_id, product_name, prompt_template, prompt, status, type)
      VALUES (
        NEW.store_id,
        NEW.product_name,
        'Auto-queued',
        'Awaiting creative generation for ' || COALESCE(NEW.product_name, 'product'),
        'generating',
        'image'
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_product_pushed ON product_copies;
CREATE TRIGGER trg_product_pushed
  AFTER UPDATE ON product_copies
  FOR EACH ROW
  EXECUTE FUNCTION on_product_pushed();

-- Also fire on INSERT (in case push_status is 'pushed' at insert time)
DROP TRIGGER IF EXISTS trg_product_pushed_insert ON product_copies;
CREATE TRIGGER trg_product_pushed_insert
  AFTER INSERT ON product_copies
  FOR EACH ROW
  WHEN (NEW.push_status = 'pushed')
  EXECUTE FUNCTION on_product_pushed();


-- ============================================
-- TRIGGER 2: Saved Creative → Auto-attach to Ad Creator Campaign
-- ============================================
-- When a creative is marked as "saved", find matching ad_creator_campaigns
-- by product_name and append the creative ID to their creatives JSONB array.

CREATE OR REPLACE FUNCTION on_creative_saved()
RETURNS TRIGGER AS $$
BEGIN
  -- Only fire when status changes to 'saved'
  IF NEW.status = 'saved' AND (OLD.status IS NULL OR OLD.status != 'saved') THEN
    -- Update all matching ad_creator_campaigns for same store + product
    UPDATE ad_creator_campaigns
    SET creatives = creatives || jsonb_build_array(jsonb_build_object(
      'id', NEW.id::TEXT,
      'type', NEW.type,
      'asset_url', COALESCE(NEW.asset_url, ''),
      'thumbnail_url', COALESCE(NEW.thumbnail_url, ''),
      'prompt_template', COALESCE(NEW.prompt_template, '')
    ))
    WHERE store_id = NEW.store_id
      AND product_name = NEW.product_name
      AND status IN ('Queued', 'Ready');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_creative_saved ON creatives;
CREATE TRIGGER trg_creative_saved
  AFTER UPDATE ON creatives
  FOR EACH ROW
  EXECUTE FUNCTION on_creative_saved();
