#!/usr/bin/env node
// Runs cross-module database triggers migration
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
console.log('✓ Connected\n');

const sql = readFileSync(
  join(__dirname, 'migrations', '003-cross-module-triggers.sql'),
  'utf-8'
);

console.log('Running cross-module triggers migration...');
await client.query(sql);
console.log('✓ Triggers created!\n');

// Verify triggers exist
const { rows: triggers } = await client.query(`
  SELECT trigger_name, event_object_table, action_timing, event_manipulation
  FROM information_schema.triggers
  WHERE trigger_name LIKE 'trg_%'
  ORDER BY trigger_name
`);

console.log('Active triggers:');
triggers.forEach(t =>
  console.log(`  ${t.trigger_name} → ${t.action_timing} ${t.event_manipulation} ON ${t.event_object_table}`)
);

await client.query("NOTIFY pgrst, 'reload schema'");
await client.end();
console.log('\nDone.');
