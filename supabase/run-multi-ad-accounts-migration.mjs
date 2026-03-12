#!/usr/bin/env node
// Runs the multi-ad-account migration via direct Postgres connection.
import pg from 'pg';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

const PROJECT_REF = 'jueajsofuknwzefcosow';
const DB_PASSWORD = process.env.SUPABASE_DB_PASSWORD || 'Rk3aJn52c4GtcSaQ';

console.log('Connecting to Postgres...');
const client = new pg.Client({
  connectionString: `postgresql://postgres.${PROJECT_REF}:${DB_PASSWORD}@aws-0-us-west-2.pooler.supabase.com:5432/postgres`,
  ssl: { rejectUnauthorized: false },
});

await client.connect();
console.log('✓ Connected\n');

// Step 1: Create user_ad_accounts table
console.log('Creating user_ad_accounts table...');
await client.query(`
  CREATE TABLE IF NOT EXISTS user_ad_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    store_id TEXT NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    ad_account_id TEXT NOT NULL,
    account_name TEXT DEFAULT '',
    account_status INTEGER DEFAULT 1,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id, ad_account_id)
  )
`);
console.log('✓ user_ad_accounts table created');

// Step 2: Create indexes
console.log('Creating indexes...');
await client.query('CREATE INDEX IF NOT EXISTS idx_user_ad_accounts_user ON user_ad_accounts(user_id)');
await client.query('CREATE INDEX IF NOT EXISTS idx_user_ad_accounts_store ON user_ad_accounts(store_id)');
console.log('✓ Indexes created');

// Step 3: Apply updated_at trigger
console.log('Applying updated_at trigger...');
await client.query(`
  DROP TRIGGER IF EXISTS set_updated_at ON user_ad_accounts;
  CREATE TRIGGER set_updated_at
    BEFORE UPDATE ON user_ad_accounts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
`);
console.log('✓ Trigger applied');

// Step 4: Enable RLS + policies
console.log('Setting up RLS policies...');
await client.query('ALTER TABLE user_ad_accounts ENABLE ROW LEVEL SECURITY');

// Drop existing policies first (in case re-running)
for (const action of ['select', 'insert', 'update', 'delete']) {
  await client.query(`DROP POLICY IF EXISTS "Users can ${action} own ad accounts" ON user_ad_accounts`);
}

await client.query(`
  CREATE POLICY "Users can select own ad accounts"
    ON user_ad_accounts FOR SELECT USING (user_id = auth.uid())
`);
await client.query(`
  CREATE POLICY "Users can insert own ad accounts"
    ON user_ad_accounts FOR INSERT WITH CHECK (user_id = auth.uid())
`);
await client.query(`
  CREATE POLICY "Users can update own ad accounts"
    ON user_ad_accounts FOR UPDATE USING (user_id = auth.uid())
`);
await client.query(`
  CREATE POLICY "Users can delete own ad accounts"
    ON user_ad_accounts FOR DELETE USING (user_id = auth.uid())
`);
console.log('✓ RLS policies created');

// Step 5: Add ad_account_id to ad_campaigns
console.log('Adding ad_account_id to ad_campaigns...');
await client.query('ALTER TABLE ad_campaigns ADD COLUMN IF NOT EXISTS ad_account_id TEXT');
await client.query('CREATE INDEX IF NOT EXISTS idx_ad_campaigns_ad_account ON ad_campaigns(ad_account_id)');
console.log('✓ ad_campaigns.ad_account_id added');

// Step 6: Add ad_account_id to ad_creator_campaigns
console.log('Adding ad_account_id to ad_creator_campaigns...');
await client.query('ALTER TABLE ad_creator_campaigns ADD COLUMN IF NOT EXISTS ad_account_id TEXT');
console.log('✓ ad_creator_campaigns.ad_account_id added');

// Notify PostgREST to reload schema cache
await client.query("NOTIFY pgrst, 'reload schema'");

// Verify
const { rows } = await client.query(`
  SELECT table_name, column_name
  FROM information_schema.columns
  WHERE table_name IN ('user_ad_accounts', 'ad_campaigns', 'ad_creator_campaigns')
    AND column_name = 'ad_account_id'
  ORDER BY table_name
`);
console.log('\nVerification — ad_account_id columns:');
rows.forEach(r => console.log(`  ✓ ${r.table_name}.${r.column_name}`));

const { rows: tableCheck } = await client.query(`
  SELECT count(*) as cols FROM information_schema.columns WHERE table_name = 'user_ad_accounts'
`);
console.log(`  ✓ user_ad_accounts has ${tableCheck[0].cols} columns`);

await client.end();
console.log('\n✓ Migration complete! Multi-ad-account support is ready.');
