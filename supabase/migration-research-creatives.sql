-- Migration: Add creative_urls column + fix testing_status CHECK constraint
-- Run via: node supabase/run-research-creatives-migration.mjs

-- 1. Add creative_urls TEXT[] column for storing scraped creative/media URLs
ALTER TABLE research_products
  ADD COLUMN IF NOT EXISTS creative_urls TEXT[] DEFAULT '{}';

-- 2. Fix testing_status CHECK constraint
--    Old: ('Queued', 'Testing', 'Killed', 'Imported')
--    New: ('Queued', 'Imported', 'Scheduled', 'Live', 'Killed', '')
--    The app uses Scheduled/Live but DB only allowed Testing.
ALTER TABLE research_products DROP CONSTRAINT IF EXISTS research_products_testing_status_check;
ALTER TABLE research_products ADD CONSTRAINT research_products_testing_status_check
  CHECK (testing_status IS NULL OR testing_status IN ('', 'Queued', 'Imported', 'Scheduled', 'Live', 'Killed'));
