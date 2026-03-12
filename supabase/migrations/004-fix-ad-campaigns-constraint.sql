-- Fix: Add missing unique constraint on ad_campaigns for upsert support
-- The schema defines UNIQUE(store_id, meta_campaign_id) but it was not applied to the live database.
-- This constraint is required by the sync-meta-campaigns API route's onConflict: "store_id,meta_campaign_id".

ALTER TABLE ad_campaigns
  ADD CONSTRAINT ad_campaigns_store_meta_unique UNIQUE (store_id, meta_campaign_id);
