import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";

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
    const { imageUrl, userId, storeId } = body;

    if (!imageUrl || !userId) {
      return NextResponse.json(
        { error: "Missing required fields: imageUrl, userId" },
        { status: 400 }
      );
    }

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
      return NextResponse.json(
        { error: "NO_API_KEY", message: "Connect your Claude AI API key in Settings first." },
        { status: 401 }
      );
    }

    const apiKey = tokenRow.access_token;

    // Convert image to base64 — handle both data URLs and remote URLs
    let base64Image: string;
    let mediaType: "image/jpeg" | "image/png" | "image/gif" | "image/webp" = "image/png";

    if (imageUrl.startsWith("data:")) {
      // Data URL from paste/file upload — extract base64 directly
      const match = imageUrl.match(/^data:(image\/\w+);base64,(.+)$/);
      if (!match) {
        return NextResponse.json(
          { error: "INVALID_DATA_URL", message: "Invalid image data." },
          { status: 400 }
        );
      }
      mediaType = match[1] as typeof mediaType;
      base64Image = match[2];
    } else {
      // Remote URL — SSRF protection
      let parsedUrl: URL;
      try {
        parsedUrl = new URL(imageUrl);
      } catch {
        return NextResponse.json(
          { error: "INVALID_URL", message: "Invalid image URL." },
          { status: 400 }
        );
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
        return NextResponse.json(
          { error: "BLOCKED_URL", message: "Image URL must be from a trusted source." },
          { status: 400 }
        );
      }

      const imageResponse = await fetch(imageUrl);
      if (!imageResponse.ok) {
        return NextResponse.json(
          { error: "IMAGE_FETCH_FAILED", message: "Could not fetch the size chart image." },
          { status: 400 }
        );
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
        return NextResponse.json(
          { error: "INVALID_API_KEY", message: "Your Claude API key is invalid. Update it in Settings." },
          { status: 401 }
        );
      }
      return NextResponse.json(
        { error: "API_ERROR", message: "Failed to process size chart. Please try again." },
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
    return NextResponse.json(
      { error: "SERVER_ERROR", message: "Internal server error." },
      { status: 500 }
    );
  }
}
