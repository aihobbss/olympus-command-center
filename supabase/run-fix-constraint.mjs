#!/usr/bin/env node
// Runs migration 004: adds missing unique constraint on ad_campaigns
import pg from 'pg';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

const PROJECT_REF = 'jueajsofuknwzefcosow';
const DB_PASSWORD = process.env.SUPABASE_DB_PASSWORD;
if (!DB_PASSWORD) { console.error('Set SUPABASE_DB_PASSWORD env var.'); process.exit(1); }

console.log('Connecting to Postgres...');
const client = new pg.Client({
  connectionString: `postgresql://postgres.${PROJECT_REF}:${DB_PASSWORD}@aws-0-us-west-2.pooler.supabase.com:5432/postgres`,
  ssl: { rejectUnauthorized: false },
});

await client.connect();
console.log('Connected\n');

const sql = readFileSync(
  join(__dirname, 'migrations', '004-fix-ad-campaigns-constraint.sql'),
  'utf-8'
);

console.log('Running ad_campaigns constraint migration...');
try {
  await client.query(sql);
  console.log('Constraint added successfully!\n');
} catch (err) {
  if (err.code === '42710') {
    // 42710 = duplicate_object — constraint already exists
    console.log('Constraint already exists, skipping.\n');
  } else {
    throw err;
  }
}

// Verify constraint exists
const { rows } = await client.query(`
  SELECT constraint_name, constraint_type
  FROM information_schema.table_constraints
  WHERE table_name = 'ad_campaigns' AND constraint_type = 'UNIQUE'
  ORDER BY constraint_name
`);

console.log('Unique constraints on ad_campaigns:');
rows.forEach(r => console.log(`  ${r.constraint_name} (${r.constraint_type})`));

await client.query("NOTIFY pgrst, 'reload schema'");
await client.end();
console.log('\nDone.');
