-- Migration 009: Add refunds_usd column to profit_logs
-- Separates refund amounts from revenue for display purposes.
-- revenue_usd continues to store NET revenue (gross - refunds) for profit calculations.
-- refunds_usd stores the raw refund amount for that day (informational).

ALTER TABLE profit_logs
  ADD COLUMN IF NOT EXISTS refunds_usd numeric DEFAULT 0;

-- Backfill: existing rows get 0 (we can't retroactively split them — next sync will populate correctly)
UPDATE profit_logs SET refunds_usd = 0 WHERE refunds_usd IS NULL;
