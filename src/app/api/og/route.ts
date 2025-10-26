import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const revalidate = 3600;

const ALLOWED_HOSTS = [
  "opengraph.githubassets.com",
  "avatars.githubusercontent.com",
  "user-images.githubusercontent.com",
  "raw.githubusercontent.com",
  "camo.githubusercontent.com",
  "githubusercontent.com",
  "githubassets.com",
];

export async function GET(req: NextRequest) {
  try {
    const urlParam = req.nextUrl.searchParams.get("url");
    if (!urlParam) {
      return NextResponse.json({ error: "missing url" }, { status: 400 });
    }

    const upstream = new URL(urlParam);
    if (!ALLOWED_HOSTS.some((h) => upstream.hostname.endsWith(h))) {
      return NextResponse.json({ error: "host not allowed" }, { status: 400 });
    }

    const resp = await fetch(upstream.toString(), {
      headers: {
        "User-Agent": "flock4h-og-proxy",
        Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
        Referer: "https://github.com/",
      },
      next: { revalidate },
    });

    if (!resp.ok) {
      const svg =
        `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 120 120">` +
        `<rect fill="#111" width="100%" height="100%"/><text x="50%" y="50%" fill="#fff" font-family="Verdana" font-size="10" text-anchor="middle" dominant-baseline="middle">no og</text></svg>`;
      return new NextResponse(svg, {
        status: 200,
        headers: { "Content-Type": "image/svg+xml", "Cache-Control": "public, max-age=60" },
      });
    }

    const buf = await resp.arrayBuffer();
    const ct = resp.headers.get("content-type") ?? "image/png";

    return new NextResponse(buf, {
      status: 200,
      headers: {
        "Content-Type": ct,
        "Cache-Control": "public, max-age=3600, s-maxage=3600",
      },
    });
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message ?? e) }, { status: 400 });
  }
}