#!/usr/bin/env node
// Runs the oauth_tokens migration via direct Postgres connection,
// then saves Shopify credentials for Vantage Melbourne.
import pg from 'pg';

const PROJECT_REF = process.env.SUPABASE_PROJECT_REF || 'jueajsofuknwzefcosow';
const DB_PASSWORD = process.env.SUPABASE_DB_PASSWORD;
if (!DB_PASSWORD) {
  console.error('Set SUPABASE_DB_PASSWORD env var before running.');
  process.exit(1);
}

console.log('Connecting to Postgres...');
const client = new pg.Client({
  connectionString: `postgresql://postgres.${PROJECT_REF}:${DB_PASSWORD}@aws-0-us-west-2.pooler.supabase.com:5432/postgres`,
  ssl: { rejectUnauthorized: false },
});

await client.connect();
console.log('✓ Connected\n');

// Step 1: Run DDL migration
console.log('Running oauth_tokens migration...');
await client.query('ALTER TABLE oauth_tokens ADD COLUMN IF NOT EXISTS client_id TEXT');
await client.query('ALTER TABLE oauth_tokens ADD COLUMN IF NOT EXISTS client_secret TEXT');
await client.query('ALTER TABLE oauth_tokens ADD COLUMN IF NOT EXISTS scopes TEXT');
await client.query("ALTER TABLE oauth_tokens ADD COLUMN IF NOT EXISTS meta JSONB DEFAULT '{}'");
await client.query('ALTER TABLE oauth_tokens ALTER COLUMN access_token DROP NOT NULL');

const constraintCheck = await client.query(`
  SELECT 1 FROM pg_constraint WHERE conname = 'oauth_tokens_store_id_service_key'
`);
if (constraintCheck.rows.length === 0) {
  await client.query('ALTER TABLE oauth_tokens ADD CONSTRAINT oauth_tokens_store_id_service_key UNIQUE (store_id, service)');
}
console.log('✓ Migration applied\n');

// Step 2: Find stores
const { rows: stores } = await client.query('SELECT id, name, owner_id, shopify_domain FROM stores');
console.log('Stores:');
stores.forEach(s => console.log(`  ${s.id} — ${s.name} (shopify: ${s.shopify_domain || 'not set'})`));

const melbourne = stores.find(s => s.name.toLowerCase().includes('melbourne'));
if (!melbourne) {
  console.error('\n⚠ Could not find Vantage Melbourne store.');
  await client.end();
  process.exit(1);
}

// Step 3: Upsert Shopify credentials (pass via env vars)
const SHOPIFY_CLIENT_ID = process.env.SHOPIFY_CLIENT_ID;
const SHOPIFY_CLIENT_SECRET = process.env.SHOPIFY_CLIENT_SECRET;
const SHOPIFY_DOMAIN = process.env.SHOPIFY_DOMAIN || 'vantagemelbourne.myshopify.com';
if (!SHOPIFY_CLIENT_ID || !SHOPIFY_CLIENT_SECRET) {
  console.error('Set SHOPIFY_CLIENT_ID and SHOPIFY_CLIENT_SECRET env vars.');
  await client.end();
  process.exit(1);
}

console.log(`\nSaving Shopify credentials for: ${melbourne.name} (${melbourne.id})`);

await client.query(`
  INSERT INTO oauth_tokens (user_id, service, store_id, client_id, client_secret, scopes, meta)
  VALUES ($1, 'shopify', $2, $3, $4, $5, $6)
  ON CONFLICT (store_id, service) DO UPDATE SET
    client_id = EXCLUDED.client_id,
    client_secret = EXCLUDED.client_secret,
    scopes = EXCLUDED.scopes,
    meta = EXCLUDED.meta,
    updated_at = now()
`, [
  melbourne.owner_id,
  melbourne.id,
  SHOPIFY_CLIENT_ID,
  SHOPIFY_CLIENT_SECRET,
  'read_products,write_products,read_orders,read_inventory',
  JSON.stringify({ shopify_domain: SHOPIFY_DOMAIN }),
]);

// Update store's shopify_domain
await client.query('UPDATE stores SET shopify_domain = $1 WHERE id = $2', [SHOPIFY_DOMAIN, melbourne.id]);

// Notify PostgREST to reload schema cache
await client.query('NOTIFY pgrst, \'reload schema\'');

console.log('\n✓ Shopify credentials saved!');
console.log(`  Store: ${melbourne.name}`);
console.log(`  Client ID: ${SHOPIFY_CLIENT_ID.slice(0, 8)}...`);
console.log(`  Domain: ${SHOPIFY_DOMAIN}`);
console.log(`  Scopes: read_products, write_products, read_orders, read_inventory`);

// Verify
const { rows: tokens } = await client.query(
  'SELECT service, client_id, scopes, meta FROM oauth_tokens WHERE store_id = $1',
  [melbourne.id]
);
console.log('\nVerification — oauth_tokens for', melbourne.id + ':');
tokens.forEach(t => console.log(`  ${t.service}: client=${t.client_id?.slice(0,8)}... scopes=${t.scopes} meta=${JSON.stringify(t.meta)}`));

await client.end();
console.log('\nDone. Ready for next service (Facebook).');
