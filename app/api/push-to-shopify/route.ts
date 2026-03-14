import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";
import { getShopifyToken } from "@/lib/shopify-token";

// Push product copy to an EXISTING Shopify product (imported via Kopy).
// Flow: extract handle from store URL → look up product by handle → update it.

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

// Convert plain-text Shopify description to proper HTML
// (centered heading, paragraphs, ul/li bullets — matches n8n format body html node)
function formatDescriptionHtml(description: string, sizeChartTable?: string): string {
  if (!description) return sizeChartTable || "";

  const lines = description.split("\n").filter((line) => line.trim());
  let html = "";
  let inList = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    if (i === 0) {
      // First line is the header — centered H3
      html += `<h3 style="text-align: center;">${line}</h3>\n\n`;
    } else if (line.startsWith("•")) {
      // Bullet point — start list if needed
      if (!inList) {
        html += "<ul>\n";
        inList = true;
      }
      // Remove bullet, process markdown bold
      let content = line.substring(1).trim();
      content = content.replace(/\*\*/g, "");
      // Bold text before colon
      if (content.includes(":")) {
        const colonIndex = content.indexOf(":");
        const label = content.substring(0, colonIndex);
        const desc = content.substring(colonIndex + 1);
        content = `<strong>${label}:</strong>${desc}`;
      }
      html += `<li>${content}</li>\n`;
    } else {
      // Close list if we were in one
      if (inList) {
        html += "</ul>\n\n";
        inList = false;
      }
      // Regular paragraph — center first paragraph only
      if (i === 1) {
        html += `<p style="text-align: center;">${line}</p>\n\n`;
      } else {
        html += `<p>${line}</p>\n`;
      }
    }
  }

  // Close list if still open
  if (inList) {
    html += "</ul>\n";
  }

  // Append size chart table if present
  if (sizeChartTable) {
    html += `\n<h3>Size Chart</h3>\n${sizeChartTable}`;
  }

  return html.trim();
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      productName,
      shopifyDescription,
      sizeChartTable,
      productUrl,
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

    // Format the description as proper HTML
    const descriptionHtml = formatDescriptionHtml(shopifyDescription, sizeChartTable);

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

    const salePrice = researchPricing || getPrice(resolvedProductType, market);
    const compareAtPrice = salePrice ? getCompareAtPrice(salePrice, researchDiscount) : null;

    // ── Step 1: Extract handle from store URL ──
    let productHandle: string | null = null;
    if (productUrl) {
      const handleMatch = productUrl.match(/\/products\/([^/?#]+)/);
      if (handleMatch) productHandle = handleMatch[1];
    }

    // ── Step 2: Look up existing product by handle ──
    let shopifyProductId: string | null = null;
    let existingVariantId: string | null = null;

    if (productHandle) {
      const lookupRes = await fetch(
        `https://${shopDomain}/admin/api/2024-01/products.json?handle=${productHandle}`,
        {
          headers: {
            "X-Shopify-Access-Token": accessToken,
            "Content-Type": "application/json",
          },
        }
      );

      if (lookupRes.ok) {
        const lookupData = await lookupRes.json();
        const existingProduct = lookupData.products?.[0];
        if (existingProduct) {
          shopifyProductId = existingProduct.id?.toString();
          existingVariantId = existingProduct.variants?.[0]?.id?.toString();
        }
      }
    }

    // ── Step 3: Update existing product or create new one ──
    if (shopifyProductId) {
      // UPDATE existing product
      const updatePayload: Record<string, unknown> = {
        product: {
          id: shopifyProductId,
          title: productName,
          body_html: descriptionHtml,
        },
      };

      const updateRes = await fetch(
        `https://${shopDomain}/admin/api/2024-01/products/${shopifyProductId}.json`,
        {
          method: "PUT",
          headers: {
            "X-Shopify-Access-Token": accessToken,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(updatePayload),
        }
      );

      if (!updateRes.ok) {
        const errText = await updateRes.text();
        console.error("Shopify update error:", updateRes.status, errText);
        return NextResponse.json(
          { error: "SHOPIFY_API_ERROR", message: "Failed to update product in Shopify." },
          { status: 502 }
        );
      }

      // Update variant pricing if we have a price and variant ID
      if (existingVariantId && salePrice) {
        const variantPayload = {
          variant: {
            id: existingVariantId,
            price: salePrice.toFixed(2),
            ...(compareAtPrice ? { compare_at_price: compareAtPrice.toFixed(2) } : {}),
          },
        };

        await fetch(
          `https://${shopDomain}/admin/api/2024-01/variants/${existingVariantId}.json`,
          {
            method: "PUT",
            headers: {
              "X-Shopify-Access-Token": accessToken,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(variantPayload),
          }
        );
      }

      return NextResponse.json({
        success: true,
        shopifyProductId,
        message: `Product "${productName}" updated in Shopify.`,
      });
    } else {
      // No existing product found — create as draft (fallback)
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

      const createPayload = {
        product: {
          title: productName,
          body_html: descriptionHtml,
          status: "draft",
          product_type: resolvedProductType || undefined,
          variants: [variant],
        },
      };

      const createRes = await fetch(
        `https://${shopDomain}/admin/api/2024-01/products.json`,
        {
          method: "POST",
          headers: {
            "X-Shopify-Access-Token": accessToken,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(createPayload),
        }
      );

      if (!createRes.ok) {
        const errText = await createRes.text();
        console.error("Shopify create error:", createRes.status, errText);

        if (createRes.status === 401 || createRes.status === 403) {
          return NextResponse.json(
            { error: "SHOPIFY_AUTH_FAILED", message: "Shopify token is invalid or expired. Reconnect in Settings." },
            { status: 401 }
          );
        }

        return NextResponse.json(
          { error: "SHOPIFY_API_ERROR", message: "Failed to create product in Shopify." },
          { status: 502 }
        );
      }

      const result = await createRes.json();
      shopifyProductId = result.product?.id?.toString() || null;

      return NextResponse.json({
        success: true,
        shopifyProductId,
        message: `Product "${productName}" created as draft in Shopify.`,
      });
    }
  } catch (error) {
    console.error("Push to Shopify error:", error);
    return NextResponse.json(
      { error: "SERVER_ERROR", message: "Internal server error." },
      { status: 500 }
    );
  }
}
