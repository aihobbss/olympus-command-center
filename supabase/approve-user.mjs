// Usage: node supabase/approve-user.mjs <email>
// Approves a user and makes them admin + creates a default store

import postgres from "postgres";

const email = process.argv[2];
if (!email) {
  console.error("Usage: node supabase/approve-user.mjs <email>");
  process.exit(1);
}

const dbPassword = process.env.SUPABASE_DB_PASSWORD;
if (!dbPassword) {
  console.error("Set SUPABASE_DB_PASSWORD env var before running.");
  process.exit(1);
}
const sql = postgres(
  `postgresql://postgres.jueajsofuknwzefcosow:${dbPassword}@aws-0-us-west-2.pooler.supabase.com:6543/postgres`,
  { ssl: "require" }
);

try {
  // Find user by email in auth.users
  const [authUser] = await sql.unsafe(
    `SELECT id FROM auth.users WHERE email = $1`,
    [email]
  );

  if (!authUser) {
    console.error(`No user found with email: ${email}`);
    process.exit(1);
  }

  const userId = authUser.id;
  console.log(`Found user: ${userId}`);

  // Approve + make admin
  await sql.unsafe(
    `UPDATE public.profiles SET approved = true, role = 'admin' WHERE id = $1`,
    [userId]
  );
  console.log("✓ Approved and set role to admin");

  // Create default store (Vantage Melbourne)
  const [melbourneStore] = await sql.unsafe(
    `INSERT INTO public.stores (name, market, currency, owner_id)
     VALUES ('Vantage Melbourne', 'AU', 'AUD', $1)
     ON CONFLICT DO NOTHING
     RETURNING id`,
    [userId]
  );

  if (melbourneStore) {
    await sql.unsafe(
      `INSERT INTO public.user_stores (user_id, store_id, role) VALUES ($1, $2, 'owner') ON CONFLICT DO NOTHING`,
      [userId, melbourneStore.id]
    );
    console.log(`✓ Created store: Vantage Melbourne (${melbourneStore.id})`);
  }

  console.log("\nDone! You can now sign in.");
} catch (e) {
  console.error("Error:", e.message);
}

process.exit(0);
