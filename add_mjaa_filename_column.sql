-- Add mjaa_filename column to salesforce_revenue table
-- Run this in your Supabase SQL Editor

ALTER TABLE salesforce_revenue
ADD COLUMN mjaa_filename TEXT;

-- Add index for performance (optional)
CREATE INDEX IF NOT EXISTS idx_salesforce_mjaa_filename ON salesforce_revenue(mjaa_filename);