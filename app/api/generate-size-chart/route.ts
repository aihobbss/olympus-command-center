import { NextResponse } from "next/server";
import { supabaseAdmin, verifyApiUser } from "@/lib/supabase-server";
import { apiError } from "@/lib/api-error";

const SYSTEM_PROMPT = `You are a precise data extraction assistant. Given an image of a size chart, extract all measurements and return them as a clean HTML table.

RULES:
1. Return ONLY an HTML <table> element followed by a <p> note — no surrounding text, no markdown, no code fences
2. Include proper <thead> and <tbody>
3. Do NOT add inline styles — the app styles the table via CSS
4. Use CM measurements ONLY — ignore/omit any inch columns. If the image only has inches, convert them to cm (multiply by 2.54, round to 1 decimal)
5. Use clean header names — e.g. "Length" not "Length cm", "Bust" not "Bust (cm)". The first column should be "Size"
6. If you cannot read certain values, use "—" as placeholder
7. After the closing </table> tag, add: <p class="size-chart-note">All measurements in centimetres</p>`;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { imageUrl, storeId } = body;

    if (!imageUrl) {
      return apiError("missing_field", "Missing required field: imageUrl", 400);
    }

    // Verify caller identity via JWT
    const authResult = await verifyApiUser(request, storeId);
    if ("error" in authResult) {
      return apiError("auth_failed", authResult.error, authResult.status);
    }
    const userId = authResult.userId;

    // Fetch user's Claude API key (prefer store-scoped)
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

    // Convert image to base64 — handle both data URLs and remote URLs
    let base64Image: string;
    let mediaType: "image/jpeg" | "image/png" | "image/gif" | "image/webp" = "image/png";

    if (imageUrl.startsWith("data:")) {
      // Data URL from paste/file upload — extract base64 directly
      const match = imageUrl.match(/^data:(image\/\w+);base64,(.+)$/);
      if (!match) {
        return apiError("invalid_data_url", "Invalid image data.", 400);
      }
      mediaType = match[1] as typeof mediaType;
      base64Image = match[2];
    } else {
      // Remote URL — SSRF protection
      let parsedUrl: URL;
      try {
        parsedUrl = new URL(imageUrl);
      } catch {
        return apiError("invalid_url", "Invalid image URL.", 400);
      }

      const ALLOWED_HOSTS = [
        "jueajsofuknwzefcosow.supabase.co",
        "cdn.shopify.com",
        "images.unsplash.com",
        "i.imgur.com",
      ];

      if (
        parsedUrl.protocol !== "https:" ||
        !ALLOWED_HOSTS.some((h) => parsedUrl.hostname === h || parsedUrl.hostname.endsWith(`.${h}`))
      ) {
        return apiError("blocked_url", "Image URL must be from a trusted source.", 400);
      }

      const imageResponse = await fetch(imageUrl);
      if (!imageResponse.ok) {
        return apiError("image_fetch_failed", "Could not fetch the size chart image.", 400);
      }

      const imageBuffer = await imageResponse.arrayBuffer();
      base64Image = Buffer.from(imageBuffer).toString("base64");
      const contentType = imageResponse.headers.get("content-type") || "image/png";
      mediaType = contentType.startsWith("image/")
        ? contentType as typeof mediaType
        : "image/png";
    }

    // Call Claude Vision API
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 4096,
        system: SYSTEM_PROMPT,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image",
                source: {
                  type: "base64",
                  media_type: mediaType,
                  data: base64Image,
                },
              },
              {
                type: "text",
                text: "Extract this size chart into a clean HTML table. Return only the <table> HTML, nothing else.",
              },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error("Claude Vision API error:", response.status, err);
      if (response.status === 401) {
        return apiError("invalid_api_key", "Your Claude API key is invalid. Update it in Settings.", 401);
      }
      return apiError("claude_api_error", "Failed to process size chart. Please try again.", 502, true);
    }

    const result = await response.json();
    const textContent = result.content?.[0]?.text;

    if (!textContent) {
      return apiError("empty_response", "Claude returned an empty response.", 502, true);
    }

    // Clean up: extract just the table HTML
    let tableHtml = textContent.trim();
    // Strip markdown code fences if present
    tableHtml = tableHtml.replace(/```html\n?/g, "").replace(/```\n?/g, "").trim();
    // Extract from <table to end of </p> (table + note)
    const tableStart = tableHtml.indexOf("<table");
    const noteEnd = tableHtml.lastIndexOf("</p>");
    const tableEndIndex = tableHtml.lastIndexOf("</table>");

    if (tableStart >= 0 && noteEnd >= 0 && noteEnd > tableEndIndex) {
      // Got both table and note
      tableHtml = tableHtml.slice(tableStart, noteEnd + "</p>".length);
    } else if (tableStart >= 0 && tableEndIndex >= 0) {
      // Got table but no note — append it
      tableHtml = tableHtml.slice(tableStart, tableEndIndex + "</table>".length)
        + '\n<p class="size-chart-note">All measurements in centimetres</p>';
    } else if (tableStart >= 0) {
      // </table> missing (truncated) — close it and add note
      tableHtml = tableHtml.slice(tableStart) + "</table>"
        + '\n<p class="size-chart-note">All measurements in centimetres</p>';
    }

    return NextResponse.json({ sizeChartTable: tableHtml });
  } catch (error) {
    console.error("Generate size chart error:", error);
    return apiError("server_error", "Internal server error.", 500, true);
  }
}
