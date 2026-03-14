// Edge Runtime — uses V8/chromium TLS stack which passes Cloudflare's
// TLS fingerprinting (Node.js runtime gets 403).
export const runtime = "edge";

export async function POST(request: Request) {
  let body: { adId?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const adId = body.adId;
  if (!adId || typeof adId !== "string") {
    return Response.json({ error: "Missing adId" }, { status: 400 });
  }

  try {
    const res = await fetch("https://api.afterlib.com/rpc/ads/getSharedAd", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      },
      body: JSON.stringify({ json: { metaAdId: adId } }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return Response.json(
        { error: `Afterlib returned ${res.status}`, details: text.slice(0, 200) },
        { status: 502 }
      );
    }

    const raw = await res.json();

    // oRPC response: { json: { items: [ ad ] } }
    const ad =
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (raw as any)?.json?.items?.[0] ??
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (raw as any)?.result?.data?.json ??
      raw;

    // Extract media URLs
    const creatives: string[] = [];
    if (Array.isArray(ad.media)) {
      for (const m of ad.media) {
        const url =
          m?.urls?.thumbnail ?? m?.urls?.preview ?? m?.thumbnail ?? m?.preview ?? m?.url;
        if (url && typeof url === "string") creatives.push(url);
      }
    }

    return Response.json({
      productName: ad.headline ?? ad.productTitle ?? "",
      adCopy: (ad.body ?? "").replace(/<br\s*\/?>/gi, "\n"),
      storeLink: ad.offerLink ?? ad.displayUrl ?? "",
      imageUrl: creatives[0] ?? "",
      creatives,
      countries: ad.countries ?? [],
      gender: ad.audienceGender ?? "",
      daysActive: null,
    });
  } catch (err) {
    return Response.json(
      { error: `Scrape failed: ${err instanceof Error ? err.message : "Unknown"}` },
      { status: 502 }
    );
  }
}
