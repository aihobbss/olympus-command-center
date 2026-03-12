#!/usr/bin/env node
// One-time migration: moves all data from Vantage London to Vantage Melbourne,
// then deletes the Vantage London store.
import pg from "pg";

const PROJECT_REF = process.env.SUPABASE_PROJECT_REF || "jueajsofuknwzefcosow";
const DB_PASSWORD = process.env.SUPABASE_DB_PASSWORD;
if (!DB_PASSWORD) {
  console.error("Set SUPABASE_DB_PASSWORD env var before running.");
  process.exit(1);
}

const client = new pg.Client({
  connectionString: `postgresql://postgres.${PROJECT_REF}:${DB_PASSWORD}@aws-0-us-west-2.pooler.supabase.com:5432/postgres`,
  ssl: { rejectUnauthorized: false },
});

await client.connect();
console.log("✓ Connected\n");

try {
  // 1. Find both store IDs
  const { rows: stores } = await client.query(
    `SELECT id, name FROM public.stores WHERE name IN ('Vantage London', 'Vantage Melbourne')`
  );

  const london = stores.find((s) => s.name === "Vantage London");
  const melbourne = stores.find((s) => s.name === "Vantage Melbourne");

  if (!london) {
    console.log("No Vantage London store found — nothing to migrate.");
    process.exit(0);
  }
  if (!melbourne) {
    console.error("Vantage Melbourne store not found! Cannot migrate.");
    process.exit(1);
  }

  console.log(`London store ID:    ${london.id}`);
  console.log(`Melbourne store ID: ${melbourne.id}\n`);

  // 2. Migrate ad_campaigns
  const adResult = await client.query(
    `UPDATE public.ad_campaigns SET store_id = $1 WHERE store_id = $2`,
    [melbourne.id, london.id]
  );
  console.log(`✓ Migrated ${adResult.rowCount} ad_campaigns`);

  // 3. Migrate profit_logs
  const plResult = await client.query(
    `UPDATE public.profit_logs SET store_id = $1 WHERE store_id = $2`,
    [melbourne.id, london.id]
  );
  console.log(`✓ Migrated ${plResult.rowCount} profit_logs`);

  // 4. Migrate product_cogs
  const cogResult = await client.query(
    `UPDATE public.product_cogs SET store_id = $1 WHERE store_id = $2`,
    [melbourne.id, london.id]
  );
  console.log(`✓ Migrated ${cogResult.rowCount} product_cogs`);

  // 5. Migrate oauth_tokens
  const oauthResult = await client.query(
    `UPDATE public.oauth_tokens SET store_id = $1 WHERE store_id = $2`,
    [melbourne.id, london.id]
  );
  console.log(`✓ Migrated ${oauthResult.rowCount} oauth_tokens`);

  // 6. Migrate research_products
  const rpResult = await client.query(
    `UPDATE public.research_products SET store_id = $1 WHERE store_id = $2`,
    [melbourne.id, london.id]
  );
  console.log(`✓ Migrated ${rpResult.rowCount} research_products`);

  // 7. Migrate copy_products
  const cpResult = await client.query(
    `UPDATE public.copy_products SET store_id = $1 WHERE store_id = $2`,
    [melbourne.id, london.id]
  );
  console.log(`✓ Migrated ${cpResult.rowCount} copy_products`);

  // 8. Migrate ad_creator_campaigns
  const acResult = await client.query(
    `UPDATE public.ad_creator_campaigns SET store_id = $1 WHERE store_id = $2`,
    [melbourne.id, london.id]
  );
  console.log(`✓ Migrated ${acResult.rowCount} ad_creator_campaigns`);

  // 9. Delete user_stores link for London
  const usResult = await client.query(
    `DELETE FROM public.user_stores WHERE store_id = $1`,
    [london.id]
  );
  console.log(`\n✓ Removed ${usResult.rowCount} user_stores links for London`);

  // 10. Update any profiles that had London as active_store_id
  const profResult = await client.query(
    `UPDATE public.profiles SET active_store_id = $1 WHERE active_store_id = $2`,
    [melbourne.id, london.id]
  );
  console.log(`✓ Updated ${profResult.rowCount} profiles active_store_id`);

  // 11. Delete the London store
  const delResult = await client.query(
    `DELETE FROM public.stores WHERE id = $1`,
    [london.id]
  );
  console.log(`✓ Deleted Vantage London store (${london.id})`);

  console.log("\n✅ Migration complete! Only Vantage Melbourne remains.");
} catch (e) {
  console.error("Error:", e.message);
} finally {
  await client.end();
}
