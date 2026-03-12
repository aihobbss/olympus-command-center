// Usage: node supabase/approve-user.mjs <email>
// Approves a user — they create their own store on first login via StoreSetup

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

  // Approve user (they'll create their own store on first login)
  await sql.unsafe(
    `UPDATE public.profiles SET approved = true WHERE id = $1`,
    [userId]
  );
  console.log("✓ Approved user");
  console.log("\nDone! User will set up their store on first login.");
} catch (e) {
  console.error("Error:", e.message);
}

process.exit(0);
