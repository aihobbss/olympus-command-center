import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";

// ── Copy generation house rules ──────────────────────────
const SYSTEM_PROMPT = `You are a senior e-commerce copywriter for a men's fashion dropshipping brand. You write clean, confident, benefit-driven product copy.

RULES — follow these exactly:
1. Cleaned title: 2–4 words, Title Case, no colors mentioned
2. Shopify description format:
   - "Benefit Meets Benefit" style headline (e.g. "Timeless Style Meets Modern Craft")
   - 2-3 sentences of body copy
   - Exactly 4 bullet points starting with "•" (benefit-focused, not feature-focused)
   - 1-sentence closing line
3. Facebook ad copy format:
   - Opening hook: "Slide Into [relevant phrase] with the [Product Name]" or similar confident opener
   - 2-3 short punchy lines about the product
   - Short tagline (3 words, period-separated like "Clean. Confident. Versatile.")
   - "Free Shipping" on its own line
   - "Shop now" on its own line
4. NEVER mention specific colors (these are multi-variant products)
5. NEVER use emojis
6. Keep language masculine, confident, understated — not hypey or salesy
7. Currency and pricing will be provided — use them accurately if given`;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { productName, productType, market, currency, price, discount, userId, storeId } = body;

    if (!productName || !userId) {
      return NextResponse.json(
        { error: "Missing required fields: productName, userId" },
        { status: 400 }
      );
    }

    // Fetch user's Claude API key from oauth_tokens (prefer store-scoped)
    let tokenQuery = supabaseAdmin
      .from("oauth_tokens")
      .select("access_token")
      .eq("user_id", userId)
      .eq("service", "anthropic");

    if (storeId) {
      tokenQuery = tokenQuery.eq("store_id", storeId);
    }

    const { data: tokenRow, error: tokenError } = await tokenQuery.single();

    if (tokenError || !tokenRow?.access_token) {
      return NextResponse.json(
        { error: "NO_API_KEY", message: "Connect your Claude AI API key in Settings first." },
        { status: 401 }
      );
    }

    const apiKey = tokenRow.access_token;

    // Build the user prompt
    const pricingInfo = price
      ? `Price: ${currency}${price}${discount ? ` (${discount}% off)` : ""}`
      : "";
    const marketInfo = market ? `Market: ${market}` : "";
    const typeInfo = productType ? `Product type: ${productType}` : "";

    const userPrompt = `Generate product copy for: "${productName}"
${typeInfo}
${marketInfo}
${pricingInfo}

Return your response in this exact JSON format (no markdown, no code fences):
{
  "cleanedTitle": "2-4 word title",
  "shopifyDescription": "Full Shopify description with headline, body, 4 bullets, closing",
  "facebookCopy": "Full Facebook ad copy"
}`;

    // Call Claude API
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1024,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: userPrompt }],
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error("Claude API error:", response.status, err);
      if (response.status === 401) {
        return NextResponse.json(
          { error: "INVALID_API_KEY", message: "Your Claude API key is invalid. Update it in Settings." },
          { status: 401 }
        );
      }
      return NextResponse.json(
        { error: "API_ERROR", message: "Failed to generate copy. Please try again." },
        { status: 502 }
      );
    }

    const result = await response.json();
    const textContent = result.content?.[0]?.text;

    if (!textContent) {
      return NextResponse.json(
        { error: "EMPTY_RESPONSE", message: "Claude returned an empty response." },
        { status: 502 }
      );
    }

    // Parse the JSON response from Claude
    let parsed;
    try {
      // Strip any markdown code fences if present
      const cleaned = textContent.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      parsed = JSON.parse(cleaned);
    } catch {
      console.error("Failed to parse Claude response:", textContent);
      return NextResponse.json(
        { error: "PARSE_ERROR", message: "Failed to parse generated copy." },
        { status: 502 }
      );
    }

    return NextResponse.json({
      cleanedTitle: parsed.cleanedTitle || productName,
      shopifyDescription: parsed.shopifyDescription || "",
      facebookCopy: parsed.facebookCopy || "",
    });
  } catch (error) {
    console.error("Generate copy error:", error);
    return NextResponse.json(
      { error: "SERVER_ERROR", message: "Internal server error." },
      { status: 500 }
    );
  }
}
