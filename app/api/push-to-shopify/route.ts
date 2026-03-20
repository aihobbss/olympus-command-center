import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";
import { getShopifyToken } from "@/lib/shopify-token";
import { apiError } from "@/lib/api-error";

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

  // Append size chart table if present — add inline styles for Shopify storefront
  if (sizeChartTable) {
    const styledTable = sizeChartTable
      .replace(/<table/g, '<table style="width:100%;border-collapse:collapse;font-size:14px"')
      .replace(/<th(?=[\s>])/g, '<th style="background:#f3f4f6;text-align:left;padding:8px 12px;border:1px solid #e5e7eb"')
      .replace(/<td(?=[\s>])/g, '<td style="padding:8px 12px;border:1px solid #e5e7eb"')
      .replace(/<p class="size-chart-note">/g, '<p style="font-size:12px;color:#6b7280;font-style:italic;margin-top:8px">');
    html += `\n<h3 style="text-align:center;">Size Chart</h3>\n${styledTable}`;
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
      return apiError("missing_fields", "Missing required fields: productName, userId", 400);
    }

    // Fetch user's Shopify token (auto-refreshes if expired)
    const shopify = await getShopifyToken(userId, storeId);

    if (!shopify) {
      return apiError("no_shopify_token", "Connect your Shopify store in Settings first.", 401);
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
          .from("products")
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

    // Product title is always ALL CAPS on Shopify
    const shopifyTitle = productName.toUpperCase();

    // ── Step 2: Look up existing product by handle ──
    let shopifyProductId: string | null = null;
    let existingVariants: Array<{ id: string }> = [];

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
          existingVariants = (existingProduct.variants || []).map((v: { id: number | string }) => ({
            id: v.id?.toString(),
          }));
        }
      }
    }

    // ── Step 3: Update existing product or create new one ──
    if (shopifyProductId) {
      // UPDATE existing product
      const updatePayload: Record<string, unknown> = {
        product: {
          id: shopifyProductId,
          title: shopifyTitle,
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
        return apiError("shopify_api_error", "Failed to update product in Shopify.", 502, true);
      }

      // Update pricing on ALL variants (not just the first)
      if (salePrice && existingVariants.length > 0) {
        for (const variant of existingVariants) {
          const variantPayload = {
            variant: {
              id: variant.id,
              price: salePrice.toFixed(2),
              ...(compareAtPrice ? { compare_at_price: compareAtPrice.toFixed(2) } : {}),
            },
          };

          await fetch(
            `https://${shopDomain}/admin/api/2024-01/variants/${variant.id}.json`,
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
      }

      // Update the products table with shopify_product_id + pipeline_status
      if (productCopyId && shopifyProductId) {
        const { data: copyRow } = await supabaseAdmin
          .from("product_copies")
          .select("product_id")
          .eq("id", productCopyId)
          .single();

        if (copyRow?.product_id) {
          await supabaseAdmin
            .from("products")
            .update({
              shopify_product_id: shopifyProductId,
              pipeline_status: "pushed_to_shopify",
            })
            .eq("id", copyRow.product_id);
        }
      }

      return NextResponse.json({
        success: true,
        shopifyProductId,
        message: `Product "${shopifyTitle}" updated in Shopify.`,
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
          title: shopifyTitle,
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
          return apiError("shopify_auth_failed", "Shopify token is invalid or expired. Reconnect in Settings.", 401);
        }

        return apiError("shopify_api_error", "Failed to create product in Shopify.", 502, true);
      }

      const result = await createRes.json();
      shopifyProductId = result.product?.id?.toString() || null;

      // Update the products table with shopify_product_id + pipeline_status
      if (productCopyId && shopifyProductId) {
        const { data: copyRow } = await supabaseAdmin
          .from("product_copies")
          .select("product_id")
          .eq("id", productCopyId)
          .single();

        if (copyRow?.product_id) {
          await supabaseAdmin
            .from("products")
            .update({
              shopify_product_id: shopifyProductId,
              pipeline_status: "pushed_to_shopify",
            })
            .eq("id", copyRow.product_id);
        }
      }

      return NextResponse.json({
        success: true,
        shopifyProductId,
        message: `Product "${productName}" created as draft in Shopify.`,
      });
    }
  } catch (error) {
    console.error("Push to Shopify error:", error);
    return apiError("server_error", "Internal server error.", 500, true);
  }
}
