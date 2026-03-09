import { NextRequest, NextResponse } from "next/server";

// ── Normalized response shape ────────────────────────────────
export type ScrapeAdResponse = {
  productName: string;
  adCopy: string;
  storeLink: string;
  imageUrl: string;
  countries: string[];
  gender: string;
  daysActive: number | null;
};

const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

// ── Afterlib handler ─────────────────────────────────────────

async function scrapeAfterlib(adId: string): Promise<ScrapeAdResponse> {
  const res = await fetch("https://api.afterlib.com/rpc/ads/getSharedAd", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "User-Agent": BROWSER_UA,
    },
    body: JSON.stringify({ json: { metaAdId: adId } }),
  });

  if (!res.ok) {
    throw new Error(`Afterlib API returned ${res.status}`);
  }

  const data = await res.json();
  // oRPC wraps the result in { result: { data: { json: ... } } }
  const ad = data?.result?.data?.json ?? data;

  return {
    productName: ad.headline ?? "",
    adCopy: ad.body ?? "",
    storeLink: ad.offerLink ?? ad.displayUrl ?? "",
    imageUrl: ad.media?.[0]?.thumbnail ?? ad.media?.[0]?.preview ?? "",
    countries: ad.countries ?? [],
    gender: ad.audienceGender ?? "",
    daysActive: null,
  };
}

// ── Winning Hunter handler ───────────────────────────────────

async function scrapeWinningHunter(
  productId: string
): Promise<ScrapeAdResponse> {
  const res = await fetch(
    `https://app.winninghunter.com/ad/${productId}?getad=`,
    {
      method: "GET",
      headers: {
        Accept: "application/json",
        "User-Agent": BROWSER_UA,
      },
    }
  );

  if (!res.ok) {
    throw new Error(`Winning Hunter API returned ${res.status}`);
  }

  const data = await res.json();
  const ad = Array.isArray(data) ? data[0] : data;

  return {
    productName: ad.product_title ?? ad.caption ?? "",
    adCopy: ad.copy ?? ad.description ?? "",
    storeLink: ad.urlStore ?? "",
    imageUrl: ad.product_image ?? ad.image ?? ad.poster ?? "",
    countries: ad.countries ?? [],
    gender: ad.gender_always ?? "",
    daysActive: ad.daysrunning ?? null,
  };
}

// ── Route handler ────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get("url");

  if (!url) {
    return NextResponse.json(
      { error: "Missing ?url= parameter" },
      { status: 400 }
    );
  }

  try {
    // Detect source from URL
    const afterlibMatch = url.match(/ad_id=([0-9a-f-]+)/i);
    const winningHunterMatch = url.match(/winninghunter\.com\/ad\/(\d+)/i);

    let result: ScrapeAdResponse;

    if (afterlibMatch) {
      result = await scrapeAfterlib(afterlibMatch[1]);
    } else if (winningHunterMatch) {
      result = await scrapeWinningHunter(winningHunterMatch[1]);
    } else {
      return NextResponse.json(
        { error: "Unrecognized URL — must be an Afterlib or Winning Hunter link" },
        { status: 400 }
      );
    }

    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
