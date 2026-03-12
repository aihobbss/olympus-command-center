import { readFileSync } from 'fs';
import postgres from 'postgres';

const dbPassword = process.env.SUPABASE_DB_PASSWORD;
if (!dbPassword) { console.error('Set SUPABASE_DB_PASSWORD env var.'); process.exit(1); }
const connString = `postgresql://postgres.jueajsofuknwzefcosow:${dbPassword}@aws-0-us-west-2.pooler.supabase.com:5432/postgres`;

const sql = postgres(connString, { ssl: 'require' });
const schemaSQL = readFileSync('supabase/schema.sql', 'utf8');

console.log('Connected to Supabase database. Running schema...\n');

try {
  await sql.unsafe(schemaSQL);
  console.log('Schema executed successfully!');
} catch (err) {
  console.error('Bulk execution failed, trying individual statements...\n');

  // Split on semicolons that end a statement (respecting $$ blocks)
  // Use a simpler approach: split on double-newline + statement start patterns
  const blocks = [];
  let current = '';
  let inDollarBlock = false;

  for (const line of schemaSQL.split('\n')) {
    if (line.includes('$$') && !inDollarBlock) {
      inDollarBlock = true;
      current += line + '\n';
      if ((current.match(/\$\$/g) || []).length >= 2) inDollarBlock = false;
    } else if (line.includes('$$') && inDollarBlock) {
      current += line + '\n';
      inDollarBlock = false;
    } else if (line.trim() === '' && !inDollarBlock && current.trim()) {
      // Don't split on blank lines
      current += line + '\n';
    } else {
      current += line + '\n';
    }
  }
  if (current.trim()) blocks.push(current);

  // Actually, let's just run the whole thing but handle the $$ blocks properly
  // Split by top-level semicolons, preserving $$ blocks
  const statements = [];
  let stmt = '';
  let dollarDepth = 0;

  for (const line of schemaSQL.split('\n')) {
    const dollarMatches = line.match(/\$\$/g);
    if (dollarMatches) dollarDepth += dollarMatches.length;

    stmt += line + '\n';

    if (line.trimEnd().endsWith(';') && dollarDepth % 2 === 0) {
      const trimmed = stmt.trim();
      if (trimmed && !trimmed.startsWith('--')) {
        statements.push(trimmed);
      }
      stmt = '';
    }
  }
  if (stmt.trim()) statements.push(stmt.trim());

  console.log(`Split into ${statements.length} statements\n`);

  let success = 0, failed = 0;
  for (const s of statements) {
    const preview = s.replace(/\s+/g, ' ').substring(0, 70);
    try {
      await sql.unsafe(s);
      success++;
      console.log(`  ✓ ${preview}...`);
    } catch (e) {
      failed++;
      console.error(`  ✗ ${preview}...`);
      console.error(`    ${e.message}`);
    }
  }
  console.log(`\n${success} succeeded, ${failed} failed`);
}

// Verify tables
const tables = await sql`
  SELECT table_name FROM information_schema.tables
  WHERE table_schema = 'public'
  ORDER BY table_name
`;
console.log('\nTables in database:');
tables.forEach(t => console.log(`  ✓ ${t.table_name}`));

await sql.end();
