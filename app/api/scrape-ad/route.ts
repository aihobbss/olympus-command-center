import { NextRequest, NextResponse } from "next/server";

// ── Normalized response shape ────────────────────────────────
export type ScrapeAdResponse = {
  productName: string;
  adCopy: string;
  storeLink: string;
  imageUrl: string;
  creatives: string[];
  countries: string[];
  gender: string;
  daysActive: number | null;
};

// ── Structured error shape ───────────────────────────────────
type ScrapeErrorResponse = {
  error: string;
  code:
    | "MISSING_URL"
    | "INVALID_URL"
    | "UNSUPPORTED_URL"
    | "RATE_LIMITED"
    | "TIMEOUT"
    | "SCRAPE_FAILED";
  details?: string;
};

function errorResponse(
  body: ScrapeErrorResponse,
  status: number
): NextResponse<ScrapeErrorResponse> {
  return NextResponse.json(body, { status });
}

// ── Rate limiting (in-memory) ────────────────────────────────
const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute
const RATE_LIMIT_MAX = 10;

// Map<ip, timestamp[]>
const rateLimitMap = new Map<string, number[]>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const timestamps = rateLimitMap.get(ip) ?? [];

  // Prune entries older than the window
  const recent = timestamps.filter((t) => now - t < RATE_LIMIT_WINDOW_MS);

  if (recent.length >= RATE_LIMIT_MAX) {
    rateLimitMap.set(ip, recent);
    return true;
  }

  recent.push(now);
  rateLimitMap.set(ip, recent);
  return false;
}

// Periodically clean up stale IPs to prevent memory leaks (singleton interval)
const _g = globalThis as unknown as Record<string, unknown>;
if (!_g.__scrapeRateLimitCleanup) {
  _g.__scrapeRateLimitCleanup = setInterval(() => {
    const now = Date.now();
    for (const [ip, timestamps] of Array.from(rateLimitMap.entries())) {
      const recent = timestamps.filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
      if (recent.length === 0) {
        rateLimitMap.delete(ip);
      } else {
        rateLimitMap.set(ip, recent);
      }
    }
  }, RATE_LIMIT_WINDOW_MS);
}

const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

const SCRAPE_TIMEOUT_MS = 10_000;
const RETRY_DELAY_MS = 1_000;

// ── Timeout-aware fetch with 1 retry on 5xx ─────────────────

class ScrapeTimeoutError extends Error {
  constructor() {
    super("Scrape request timed out after 10 seconds");
    this.name = "ScrapeTimeoutError";
  }
}

class UpstreamError extends Error {
  status: number;
  constructor(source: string, status: number) {
    super(`${source} API returned ${status}`);
    this.name = "UpstreamError";
    this.status = status;
  }
}

async function fetchWithTimeoutAndRetry(
  input: string,
  init: RequestInit,
  source: string
): Promise<Response> {
  const attempt = async (): Promise<Response> => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), SCRAPE_TIMEOUT_MS);

    try {
      const res = await fetch(input, {
        ...init,
        signal: controller.signal,
      });

      if (!res.ok) {
        throw new UpstreamError(source, res.status);
      }

      return res;
    } catch (err) {
      if (err instanceof DOMException || (err instanceof Error && err.name === "AbortError")) {
        throw new ScrapeTimeoutError();
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  };

  try {
    return await attempt();
  } catch (err) {
    // Retry once on 5xx errors
    if (err instanceof UpstreamError && err.status >= 500) {
      await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
      return await attempt();
    }
    throw err;
  }
}

// ── Afterlib handler ─────────────────────────────────────────

async function scrapeAfterlib(adId: string): Promise<ScrapeAdResponse> {
  const res = await fetchWithTimeoutAndRetry(
    "https://api.afterlib.com/rpc/ads/getSharedAd",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": BROWSER_UA,
      },
      body: JSON.stringify({ json: { metaAdId: adId } }),
    },
    "Afterlib"
  );

  const data = await res.json();
  // oRPC wraps the result in { result: { data: { json: ... } } }
  const ad = data?.result?.data?.json ?? data;

  // Extract all media URLs (thumbnails, previews, videos)
  const creatives: string[] = [];
  if (Array.isArray(ad.media)) {
    for (const m of ad.media) {
      const url = m?.thumbnail ?? m?.preview ?? m?.url ?? m?.video_url;
      if (url && typeof url === "string") creatives.push(url);
    }
  }

  return {
    productName: ad.headline ?? "",
    adCopy: ad.body ?? "",
    storeLink: ad.offerLink ?? ad.displayUrl ?? "",
    imageUrl: creatives[0] ?? "",
    creatives,
    countries: ad.countries ?? [],
    gender: ad.audienceGender ?? "",
    daysActive: null,
  };
}

// ── Winning Hunter handler ───────────────────────────────────

async function scrapeWinningHunter(
  productId: string
): Promise<ScrapeAdResponse> {
  const res = await fetchWithTimeoutAndRetry(
    `https://app.winninghunter.com/ad/${productId}?getad=`,
    {
      method: "GET",
      headers: {
        Accept: "application/json",
        "User-Agent": BROWSER_UA,
      },
    },
    "Winning Hunter"
  );

  const data = await res.json();
  const ad = Array.isArray(data) ? data[0] : data;

  // Collect all available creative URLs
  const creatives: string[] = [];
  for (const key of ["product_image", "image", "poster", "video_url", "thumbnail"]) {
    const val = ad[key];
    if (val && typeof val === "string") creatives.push(val);
  }
  // Also check media array if present
  if (Array.isArray(ad.media)) {
    for (const m of ad.media) {
      const url = typeof m === "string" ? m : m?.url ?? m?.thumbnail ?? m?.preview;
      if (url && typeof url === "string" && !creatives.includes(url)) creatives.push(url);
    }
  }

  return {
    productName: ad.product_title ?? ad.caption ?? "",
    adCopy: ad.copy ?? ad.description ?? "",
    storeLink: ad.urlStore ?? "",
    imageUrl: creatives[0] ?? "",
    creatives,
    countries: ad.countries ?? [],
    gender: ad.gender_always ?? "",
    daysActive: ad.daysrunning ?? null,
  };
}

// ── Route handler ────────────────────────────────────────────

export async function GET(request: NextRequest) {
  // Extract client IP for rate limiting (use rightmost x-forwarded-for entry — least spoofable)
  const forwardedFor = request.headers.get("x-forwarded-for");
  const forwardedParts = forwardedFor?.split(",").map((s) => s.trim()) ?? [];
  const ip =
    (forwardedParts.length > 0 ? forwardedParts[forwardedParts.length - 1] : null) ??
    request.headers.get("x-real-ip") ??
    request.ip ??
    "unknown";

  if (isRateLimited(ip)) {
    return errorResponse(
      {
        error: "Rate limit exceeded. Maximum 10 scrapes per minute.",
        code: "RATE_LIMITED",
      },
      429
    );
  }

  const url = request.nextUrl.searchParams.get("url");

  if (!url) {
    return errorResponse(
      {
        error: "Missing ?url= parameter. Provide an Afterlib or Winning Hunter URL.",
        code: "MISSING_URL",
      },
      400
    );
  }

  // Basic URL validation
  try {
    new URL(url);
  } catch {
    return errorResponse(
      {
        error: "Invalid URL format. Provide a valid Afterlib or Winning Hunter URL.",
        code: "INVALID_URL",
        details: "The provided value could not be parsed as a URL.",
      },
      400
    );
  }

  // Detect source from URL
  const afterlibMatch = url.match(/ad_id=([0-9a-f-]+)/i);
  const winningHunterMatch = url.match(/winninghunter\.com\/ad\/(\d+)/i);

  if (!afterlibMatch && !winningHunterMatch) {
    return errorResponse(
      {
        error:
          "Unsupported URL. Only Afterlib (containing ad_id=) and Winning Hunter (winninghunter.com/ad/) links are supported.",
        code: "UNSUPPORTED_URL",
      },
      400
    );
  }

  try {
    let result: ScrapeAdResponse;

    if (afterlibMatch) {
      result = await scrapeAfterlib(afterlibMatch[1]);
    } else {
      result = await scrapeWinningHunter(winningHunterMatch![1]);
    }

    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof ScrapeTimeoutError) {
      return errorResponse(
        {
          error: "The upstream service did not respond in time. Try again shortly.",
          code: "TIMEOUT",
        },
        504
      );
    }

    const message = err instanceof Error ? err.message : "Unknown error";
    const details =
      err instanceof UpstreamError
        ? `Upstream returned HTTP ${err.status} (after retry if 5xx).`
        : undefined;

    return errorResponse(
      {
        error: `Scrape failed: ${message}`,
        code: "SCRAPE_FAILED",
        details,
      },
      502
    );
  }
}
