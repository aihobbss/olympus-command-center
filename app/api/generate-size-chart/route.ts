import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";

const SYSTEM_PROMPT = `You are a precise data extraction assistant. Given an image of a size chart, extract all measurements and return them as a clean HTML table.

RULES:
1. Return ONLY an HTML <table> element — no surrounding text, no markdown
2. Use inline styles for the table (border-collapse, width, text-align, font-size)
3. Include proper <thead> and <tbody>
4. Style headers with a light gray background (#f3f4f6)
5. All cells should have: border: 1px solid #e5e7eb, padding: 8px 12px
6. Keep original units (cm, inches, etc.)
7. If you cannot read certain values, use "—" as placeholder
8. Preserve the exact column headers from the image`;

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
        max_tokens: 2048,
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
    // Ensure it starts with <table
    const tableStart = tableHtml.indexOf("<table");
    const tableEnd = tableHtml.lastIndexOf("</table>") + "</table>".length;
    if (tableStart >= 0 && tableEnd > tableStart) {
      tableHtml = tableHtml.slice(tableStart, tableEnd);
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
