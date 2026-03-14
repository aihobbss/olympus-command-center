-- Add custom_domain column to stores table
-- This stores the public-facing domain (e.g., vantagemelbourne.com)
-- separate from shopify_domain which is the admin .myshopify.com domain
ALTER TABLE stores ADD COLUMN IF NOT EXISTS custom_domain TEXT;
