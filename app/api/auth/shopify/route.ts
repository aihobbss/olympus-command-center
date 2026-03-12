import { NextResponse } from "next/server";

// Shopify OAuth Step 1: Redirect to Shopify authorization page
// Requires: SHOPIFY_CLIENT_ID in env
//
// Flow:
// 1. User clicks "Connect Shopify" → submits store domain via POST
// 2. We return the Shopify OAuth URL (userId encoded in state)
// 3. Shopify redirects back to /api/auth/shopify/callback with code + state
// 4. Callback decodes userId from state, exchanges code for token, saves to oauth_tokens

export async function GET() {
  return NextResponse.json(
    {
      error: "STORE_DOMAIN_REQUIRED",
      message: "POST to this endpoint with { storeDomain, userId } to begin OAuth.",
    },
    { status: 400 }
  );
}

export async function POST(request: Request) {
  const clientId = process.env.SHOPIFY_CLIENT_ID;
  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/shopify/callback`;
  const scopes = process.env.SHOPIFY_SCOPES || "read_products,write_products,read_orders";

  if (!clientId) {
    return NextResponse.json(
      { error: "SHOPIFY_NOT_CONFIGURED", message: "Shopify app credentials not configured." },
      { status: 503 }
    );
  }

  const body = await request.json().catch(() => ({}));
  const storeDomain = body.storeDomain as string;
  const userId = body.userId as string;

  if (!storeDomain || !storeDomain.endsWith(".myshopify.com")) {
    return NextResponse.json(
      { error: "INVALID_DOMAIN", message: "Provide a valid .myshopify.com domain." },
      { status: 400 }
    );
  }

  if (!userId) {
    return NextResponse.json(
      { error: "UNAUTHORIZED", message: "userId is required." },
      { status: 401 }
    );
  }

  // Encode userId + storeDomain + CSRF token into state
  const csrf = crypto.randomUUID();
  const state = Buffer.from(
    JSON.stringify({ csrf, userId, shop: storeDomain })
  ).toString("base64url");

  const authUrl =
    `https://${storeDomain}/admin/oauth/authorize` +
    `?client_id=${clientId}` +
    `&scope=${scopes}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&state=${state}`;

  return NextResponse.json({ redirect: authUrl });
}
