#!/usr/bin/env node
// Save Shopify credentials for a store in the oauth_tokens table.
// Usage: node supabase/save-shopify-credentials.mjs <store_id> <client_id> <client_secret> <shopify_domain>

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://jueajsofuknwzefcosow.supabase.co';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SERVICE_ROLE_KEY) {
  // Read from .env.local if not in environment
  const fs = await import('fs');
  const path = await import('path');
  const envPath = path.join(process.cwd(), '.env.local');
  const envContent = fs.readFileSync(envPath, 'utf8');
  const match = envContent.match(/SUPABASE_SERVICE_ROLE_KEY=(.+)/);
  if (match) {
    process.env.SUPABASE_SERVICE_ROLE_KEY = match[1].trim();
  }
}

const supabase = createClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const [,, storeId, clientId, clientSecret, shopifyDomain] = process.argv;

if (!storeId || !clientId || !clientSecret || !shopifyDomain) {
  console.error('Usage: node supabase/save-shopify-credentials.mjs <store_id> <client_id> <client_secret> <shopify_domain>');
  console.error('Example: node supabase/save-shopify-credentials.mjs <store-id> <client-id> <client-secret> <domain>.myshopify.com');
  process.exit(1);
}

// Get store owner
const { data: store, error: storeErr } = await supabase
  .from('stores')
  .select('id, name, owner_id, shopify_domain')
  .eq('id', storeId)
  .single();

if (storeErr || !store) {
  console.error('Store not found:', storeId);
  console.error('Available stores:');
  const { data: stores } = await supabase.from('stores').select('id, name');
  stores?.forEach(s => console.error(`  ${s.id} — ${s.name}`));
  process.exit(1);
}

// Upsert Shopify credentials into oauth_tokens
const { error: tokenErr } = await supabase
  .from('oauth_tokens')
  .upsert({
    user_id: store.owner_id,
    service: 'shopify',
    store_id: storeId,
    client_id: clientId,
    client_secret: clientSecret,
    scopes: 'read_products,write_products,read_orders,read_inventory',
    meta: { shopify_domain: shopifyDomain },
  }, { onConflict: 'store_id,service' });

if (tokenErr) {
  console.error('Failed to save credentials:', tokenErr.message);
  process.exit(1);
}

// Update store's shopify_domain
const { error: domainErr } = await supabase
  .from('stores')
  .update({ shopify_domain: shopifyDomain })
  .eq('id', storeId);

if (domainErr) {
  console.error('Warning: failed to update shopify_domain on store:', domainErr.message);
}

console.log(`✓ Shopify credentials saved for ${store.name} (${storeId})`);
console.log(`  Client ID: ${clientId.slice(0, 8)}...`);
console.log(`  Domain: ${shopifyDomain}`);
console.log(`  Scopes: read_products, write_products, read_orders, read_inventory`);
console.log(`\nNext: the app will auto-exchange these for a 24h access token when needed.`);
