import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";
import { getShopifyToken } from "@/lib/shopify-token";

// Push a product to Shopify via Admin API
// Requires: user has a connected Shopify store (token in oauth_tokens)
// Pricing is looked up from the linked research product

// Pricing table (matches data/mock/index.ts pricingTable)
const PRICING: Record<string, { gbp: number; aud: number }> = {
  "Shoes":            { gbp: 38, aud: 78 },
  "Regular Jacket":   { gbp: 38, aud: 78 },
  "Light Jacket":     { gbp: 32, aud: 68 },
  "Luxury Jacket":    { gbp: 48, aud: 92 },
  "Light Sweater":    { gbp: 28, aud: 62 },
  "Heavy Sweater":    { gbp: 32, aud: 68 },
  "Light Top":        { gbp: 26, aud: 48 },
  "Heavy Top":        { gbp: 28, aud: 62 },
  "All Accessories":  { gbp: 26, aud: 48 },
  "Sandals":          { gbp: 28, aud: 62 },
  "Dress":            { gbp: 28, aud: 62 },
  "Set":              { gbp: 38, aud: 78 },
  "Light Pants":      { gbp: 28, aud: 62 },
  "Heavy Pants":      { gbp: 32, aud: 68 },
};

function getPrice(productType: string | null, market: string): number | null {
  if (!productType) return null;
  const entry = PRICING[productType];
  if (!entry) return null;
  return market === "AU" ? entry.aud : entry.gbp;
}

function getCompareAtPrice(salePrice: number, discountPercent: number): number {
  return Math.round(salePrice / (1 - discountPercent / 100));
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      productName,
      shopifyDescription,
      sizeChartTable,
      imageUrl,
      userId,
      storeId,
      productCopyId,
    } = body;

    if (!productName || !userId) {
      return NextResponse.json(
        { error: "Missing required fields: productName, userId" },
        { status: 400 }
      );
    }

    // Fetch user's Shopify token (auto-refreshes if expired)
    const shopify = await getShopifyToken(userId, storeId);

    if (!shopify) {
      return NextResponse.json(
        { error: "NO_SHOPIFY_TOKEN", message: "Connect your Shopify store in Settings first." },
        { status: 401 }
      );
    }

    const shopDomain = shopify.shopifyDomain;
    const accessToken = shopify.accessToken;

    // Build the product description (Shopify-formatted HTML)
    let descriptionHtml = (shopifyDescription || "").replace(/\n/g, "<br>");
    if (sizeChartTable) {
      descriptionHtml += `<br><br><h3>Size Chart</h3>${sizeChartTable}`;
    }

    // Look up store market
    let market = "AU";
    if (storeId) {
      const { data: storeInfo } = await supabaseAdmin
        .from("stores")
        .select("market")
        .eq("id", storeId)
        .single();
      if (storeInfo?.market) market = storeInfo.market;
    }

    // Look up pricing from linked research product
    let resolvedProductType: string | null = null;
    let researchPricing: number | null = null;
    let researchDiscount: number = 42;

    if (productCopyId) {
      const { data: copyRow } = await supabaseAdmin
        .from("product_copies")
        .select("research_product_id")
        .eq("id", productCopyId)
        .single();

      if (copyRow?.research_product_id) {
        const { data: researchRow } = await supabaseAdmin
          .from("research_products")
          .select("product_type, pricing, discount_percent")
          .eq("id", copyRow.research_product_id)
          .single();

        if (researchRow) {
          resolvedProductType = researchRow.product_type || null;
          researchPricing = researchRow.pricing;
          researchDiscount = researchRow.discount_percent ?? 42;
        }
      }
    }

    // Fallback: look up by product name if no research link
    if (!resolvedProductType && productName) {
      const { data: researchRow } = await supabaseAdmin
        .from("research_products")
        .select("product_type, pricing, discount_percent")
        .ilike("product_name", productName)
        .limit(1)
        .single();
      if (researchRow) {
        resolvedProductType = researchRow.product_type || null;
        if (!researchPricing && researchRow.pricing) {
          researchPricing = researchRow.pricing;
          researchDiscount = researchRow.discount_percent ?? 42;
        }
      }
    }

    // Determine sale price: use research pricing directly, or fall back to type-based lookup
    const salePrice = researchPricing || getPrice(resolvedProductType, market);
    const compareAtPrice = salePrice ? getCompareAtPrice(salePrice, researchDiscount) : null;

    // Build variant with pricing
    const variant: Record<string, unknown> = {
      title: "Default",
      inventory_management: null,
    };
    if (salePrice) {
      variant.price = salePrice.toFixed(2);
      if (compareAtPrice) {
        variant.compare_at_price = compareAtPrice.toFixed(2);
      }
    }

    // Create product via Shopify Admin REST API
    const shopifyPayload = {
      product: {
        title: productName,
        body_html: descriptionHtml,
        status: "draft",
        product_type: resolvedProductType || undefined,
        variants: [variant],
        ...(imageUrl
          ? {
              images: [{ src: imageUrl }],
            }
          : {}),
      },
    };

    const shopifyRes = await fetch(
      `https://${shopDomain}/admin/api/2024-01/products.json`,
      {
        method: "POST",
        headers: {
          "X-Shopify-Access-Token": accessToken,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(shopifyPayload),
      }
    );

    if (!shopifyRes.ok) {
      const errText = await shopifyRes.text();
      console.error("Shopify API error:", shopifyRes.status, errText);

      if (shopifyRes.status === 401 || shopifyRes.status === 403) {
        return NextResponse.json(
          { error: "SHOPIFY_AUTH_FAILED", message: "Shopify token is invalid or expired. Reconnect in Settings." },
          { status: 401 }
        );
      }

      return NextResponse.json(
        { error: "SHOPIFY_API_ERROR", message: "Failed to create product in Shopify. Please try again." },
        { status: 502 }
      );
    }

    const result = await shopifyRes.json();
    const shopifyProductId = result.product?.id?.toString() || null;

    return NextResponse.json({
      success: true,
      shopifyProductId,
      message: `Product "${productName}" created as draft in Shopify.`,
    });
  } catch (error) {
    console.error("Push to Shopify error:", error);
    return NextResponse.json(
      { error: "SERVER_ERROR", message: "Internal server error." },
      { status: 500 }
    );
  }
}
