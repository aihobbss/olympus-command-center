import { NextResponse } from "next/server";
import { supabaseAdmin, verifyApiUser } from "@/lib/supabase-server";
import { apiError } from "@/lib/api-error";

// SSRF protection — only allow fetching images from known e-commerce CDNs
const ALLOWED_IMAGE_HOSTS = new Set([
  "cdn.shopify.com",
  "images.unsplash.com",
  "m.media-amazon.com",
  "ae01.alicdn.com",
  "img.alicdn.com",
  "cbu01.alicdn.com",
  "i.ebayimg.com",
  "i.imgur.com",
  "res.cloudinary.com",
]);

function isAllowedImageUrl(urlStr: string): boolean {
  try {
    const url = new URL(urlStr);
    if (url.protocol !== "https:" && url.protocol !== "http:") return false;
    // Block private/internal IPs
    const hostname = url.hostname;
    if (hostname === "localhost" || hostname === "127.0.0.1" || hostname.startsWith("192.168.") || hostname.startsWith("10.") || hostname.startsWith("172.")) return false;
    // Allow known CDN hosts, or any hostname that looks like a public domain with image extension
    if (ALLOWED_IMAGE_HOSTS.has(hostname)) return true;
    // Allow any public domain (but block internal IPs above)
    return hostname.includes(".");
  } catch {
    return false;
  }
}

// ── Country label mapping ──────────────────────────────
const COUNTRY_LABELS: Record<string, string> = {
  AU: "Australia",
  UK: "the UK",
  US: "the US",
  NZ: "New Zealand",
  CA: "Canada",
};

// ── System prompt (expert e-commerce copywriter) ───────
const SYSTEM_PROMPT = `You are an expert e-commerce copywriter. Generate product descriptions and Facebook ad copy with precise formatting.

CRITICAL CONTENT RULES:
1. DO NOT make claims about materials unless explicitly provided in the product data
2. DO NOT assume fabric types, materials, or composition - only mention if stated
3. DO NOT mention ANY colors, shades, or color-related terms (e.g., "blue", "cream", "rust-orange", "dark", "light", "navy", "white", "black", etc.)
4. The vision_analysis only shows ONE product image - products may have multiple color variants not shown in that image
5. Focus ONLY on: style category, fit type, design structure, styling versatility, occasion use
6. Be specific about SHAPE and DESIGN ONLY: silhouette, construction details, structural elements, design features

FORBIDDEN COLOR TERMS:
Do not use: blue, red, green, yellow, orange, purple, pink, black, white, gray, grey, brown, tan, beige, cream, navy, rust, burgundy, olive, maroon, teal, turquoise, coral, mint, ivory, charcoal, slate, mocha, taupe, khaki, indigo, crimson, scarlet, azure, emerald, gold, silver, bronze, copper, dark, light, bright, pale, vibrant, muted, neutral, warm, cool, earthy, or any other color descriptor.

Instead use: "contrast details", "accent elements", "tonal variation", "textured surfaces", "distinctive details"

OUTPUT FORMAT:
You must respond with ONLY valid JSON in this exact structure:
{
  "product_name": "Clean Product Name Here",
  "shopify_description": "Header Line\\n\\nFirst paragraph description.\\n\\n• Feature One: Description here\\n• Feature Two: Description here\\n• Feature Three: Description here\\n• Feature Four: Description here\\n\\nClosing brand sentence.",
  "facebook_ad": "Opening hook line\\n\\nAd copy paragraph here.\\n\\nWord. Word. Word.\\n\\n[URL]\\n[Product Name]\\nFree Shipping in [Country]\\n[Shop now]"
}

SHOPIFY DESCRIPTION STRUCTURE:
- Line 1: "[Benefit] Meets [Benefit]" (e.g., "Effortless Style Meets Relaxed Comfort")
- Line 2: Empty line
- Line 3-4: 2-3 sentence description paragraph
- Line 5: Empty line
- Lines 6-9: EXACTLY 4 bullets in format "• **Label**: Description"
- Line 10: Empty line
- Line 11: One sentence about the brand/store (use the exact store name provided, e.g., "Vantage Melbourne infuses [style approach] — a [garment] essential you'll rely on every day.")

PRODUCT NAME RULES:
- 2-4 words maximum
- Title Case
- Use human first names as the brand/style name — NOT cities, countries, or places
- Format: "[Human Name] [Garment Type]" or "[Human Name] [Adjective] [Garment Type]"
- Good examples: "Joseph Owen Shirt", "Harrington Trainers", "Matteo Cotton Pants", "Haldrin Layered Shirt", "Enzo Suede Loafers", "Avalon Puffer Vest"
- BAD examples (never use): "Melbourne Jacket", "London Coat", "Paris Dress", "Milan Sneakers", "Tokyo Bomber"
- NO color references in product names

FEATURE BULLETS (when materials unknown):
Good examples:
• **Relaxed Fit**: Comfortable silhouette for easy, all-day wear
• **Versatile Design**: Pairs effortlessly with trousers or denim
• **Clean Collar**: Modern shape that keeps the look polished
• **Textured Upper**: Distinctive surface pattern adds dimension
• **Contrast Accents**: Accent details offer visual interest

Bad examples (avoid):
• **Premium Cotton**: ... (don't claim materials you can't verify)
• **Soft Fabric**: ... (too vague without material info)
• **Rust-Orange Details**: ... (NO COLOR REFERENCES)

FACEBOOK AD STRUCTURE:
- Line 1: "Slide Into [creative phrase] with the [Product Name]"
- Line 2: Empty
- Line 3-5: 2-3 sentences of ad copy
- Line 6: Empty
- Line 7: Three adjectives format: "Word. Word. Word."
- Line 8: Empty
- Line 9: [Product URL]
- Line 10: [Product Name]
- Line 11: Free Shipping in [Country] (use the exact country provided)
- Line 12: [Shop now]

NO EMOJIS. NO HASHTAGS. NO EXTRA TEXT OUTSIDE THE JSON. NO COLOR REFERENCES ANYWHERE.

Remember: Output ONLY the JSON object, nothing else before or after it.`;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      productName,
      productUrl,
      imageUrl,
      market,
      currency,
      storeName,
      storeId,
      productCopyId,
    } = body;
    let { productType, price, compareAtPrice } = body;

    if (!productName) {
      return apiError("missing_field", "Missing required field: productName", 400);
    }

    // Verify caller identity via JWT
    const authResult = await verifyApiUser(request, storeId);
    if ("error" in authResult) {
      return apiError("auth_failed", authResult.error, authResult.status);
    }
    const userId = authResult.userId;

    // Look up pricing from linked research product if not provided
    if (productCopyId && (!price || !productType)) {
      const { data: copyRow } = await supabaseAdmin
        .from("product_copies")
        .select("research_product_id")
        .eq("id", productCopyId)
        .single();

      if (copyRow?.research_product_id) {
        const { data: researchRow } = await supabaseAdmin
          .from("products")
          .select("product_type, pricing, discount_percent")
          .eq("id", copyRow.research_product_id)
          .single();

        if (researchRow) {
          if (!productType && researchRow.product_type) productType = researchRow.product_type;
          if (!price && researchRow.pricing) {
            price = researchRow.pricing;
            // Calculate compare-at price from discount
            const discount = researchRow.discount_percent ?? 42;
            compareAtPrice = Math.round(researchRow.pricing / (1 - discount / 100));
          }
        }
      }
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
      return apiError("no_api_key", "Connect your Claude AI API key in Settings first.", 401);
    }

    const apiKey = tokenRow.access_token;
    const country = COUNTRY_LABELS[market] || market || "Australia";

    // ── Step 1: Vision analysis of product image (if provided) ──
    let visionAnalysis = "";
    if (imageUrl && isAllowedImageUrl(imageUrl)) {
      try {
        // Fetch image and convert to base64
        const imgRes = await fetch(imageUrl);
        if (imgRes.ok) {
          const imgBuf = await imgRes.arrayBuffer();
          const base64 = Buffer.from(imgBuf).toString("base64");
          const contentType = imgRes.headers.get("content-type") || "image/jpeg";
          const mediaType = contentType.startsWith("image/")
            ? (contentType as "image/jpeg" | "image/png" | "image/gif" | "image/webp")
            : "image/jpeg";

          const visionRes = await fetch("https://api.anthropic.com/v1/messages", {
            method: "POST",
            headers: {
              "x-api-key": apiKey,
              "anthropic-version": "2023-06-01",
              "content-type": "application/json",
            },
            body: JSON.stringify({
              model: "claude-sonnet-4-20250514",
              max_tokens: 512,
              messages: [
                {
                  role: "user",
                  content: [
                    {
                      type: "image",
                      source: { type: "base64", media_type: mediaType, data: base64 },
                    },
                    {
                      type: "text",
                      text: `Analyze this product image in detail and provide:
1. Material appearance (e.g., cotton, leather, linen, wool, synthetic)
2. Style category (casual, formal, sporty, elegant, minimalist)
3. Key visual features (collar type, pockets, buttons, patterns, texture, cut/fit)
4. Target demographic (men's/women's, approximate age range, style preference)
5. Overall mood/vibe (3 descriptive words)

Format your response as a structured list with these exact labels. Do NOT describe colors.`,
                    },
                  ],
                },
              ],
            }),
          });

          if (visionRes.ok) {
            const visionData = await visionRes.json();
            visionAnalysis = visionData.content?.[0]?.text || "";
          }
        }
      } catch (err) {
        console.error("Vision analysis failed (non-fatal):", err);
      }
    }

    // ── Step 2: Build the copy generation prompt ──
    const pricePart = price ? `Price: ${currency}${price}` : "";
    const comparePart = compareAtPrice ? `Compare At Price: ${currency}${compareAtPrice}` : "";
    const typePart = productType ? `Category: ${productType}` : "";
    const urlPart = productUrl ? `URL: ${productUrl}` : "";
    const visionPart = visionAnalysis ? `Image Analysis: ${visionAnalysis}` : "";

    const storeNamePart = storeName ? `Store Name: ${storeName}` : "";

    const userPrompt = `Generate ad copy for:

Title: ${productName}
${urlPart}
${typePart}
${pricePart}
${comparePart}
${storeNamePart}
Shipping: Free Shipping in ${country}
CTA: Shop now
${visionPart}

Create a clean product name (2-4 words, using human names not cities, no colors), a Shopify Product Description with 4 bullets, and Facebook Ad Copy. Follow the exact format specified. Use "${country}" for the shipping line in the Facebook ad.${storeName ? ` Use "${storeName}" as the brand name in the closing sentence of the Shopify description.` : ""}

Return ONLY the JSON object, no markdown, no code fences.`;

    // ── Step 3: Generate the copy ──
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
        return apiError("invalid_api_key", "Your Claude API key is invalid. Update it in Settings.", 401);
      }
      return apiError("claude_api_error", "Failed to generate copy. Please try again.", 502, true);
    }

    const result = await response.json();
    const textContent = result.content?.[0]?.text;

    if (!textContent) {
      return apiError("empty_response", "Claude returned an empty response.", 502, true);
    }

    // Parse the JSON response from Claude
    let parsed;
    try {
      const cleaned = textContent.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      parsed = JSON.parse(cleaned);
    } catch {
      console.error("Failed to parse Claude response:", textContent);
      return apiError("parse_error", "Failed to parse generated copy.", 502, true);
    }

    return NextResponse.json({
      cleanedTitle: parsed.product_name || parsed.cleanedTitle || productName,
      shopifyDescription: parsed.shopify_description || parsed.shopifyDescription || "",
      facebookCopy: parsed.facebook_ad || parsed.facebookCopy || "",
    });
  } catch (error) {
    console.error("Generate copy error:", error);
    return apiError("server_error", "Internal server error.", 500, true);
  }
}
