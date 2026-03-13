#!/usr/bin/env node
// Adds creative_urls column and fixes testing_status CHECK constraint
import pg from 'pg';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

const PROJECT_REF = process.env.SUPABASE_PROJECT_REF || 'jueajsofuknwzefcosow';
const DB_PASSWORD = process.env.SUPABASE_DB_PASSWORD;
if (!DB_PASSWORD) {
  console.error('Set SUPABASE_DB_PASSWORD env var before running.');
  process.exit(1);
}

const client = new pg.Client({
  connectionString: `postgresql://postgres.${PROJECT_REF}:${DB_PASSWORD}@aws-0-us-west-2.pooler.supabase.com:5432/postgres`,
  ssl: { rejectUnauthorized: false },
});

console.log('Connecting to Postgres...');
await client.connect();
console.log('✓ Connected\n');

const sql = readFileSync(join(__dirname, 'migration-research-creatives.sql'), 'utf8');
console.log('Running migration...');
await client.query(sql);
console.log('✓ Migration applied\n');

// Verify
const { rows } = await client.query(`
  SELECT column_name, data_type, column_default
  FROM information_schema.columns
  WHERE table_name = 'research_products' AND column_name = 'creative_urls'
`);
console.log('Verification — creative_urls column:', rows[0] || 'NOT FOUND');

// Check constraint
const { rows: constraints } = await client.query(`
  SELECT conname, pg_get_constraintdef(oid) as def
  FROM pg_constraint
  WHERE conrelid = 'research_products'::regclass AND conname LIKE '%testing_status%'
`);
console.log('Testing status constraint:', constraints[0] || 'NONE');

await client.query("NOTIFY pgrst, 'reload schema'");
console.log('\n✓ Done. Schema cache reloaded.');

await client.end();
