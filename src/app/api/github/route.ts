import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const revalidate = 300;

const TAGS = {
  hacking: ["hacking", "cybersecurity"],
  crypto: ["solana", "base", "ethereum", "bitcoin", "tron", "trading", "crypto", "solana-bot", "sniper-bot"],
} as const;

type Tagset = keyof typeof TAGS;

const apiHeaders: Record<string, string> = {
  Accept: "application/vnd.github+json",
  "X-GitHub-Api-Version": "2022-11-28",
  "User-Agent": "flock4h-room-app",
  ...(process.env.GITHUB_TOKEN ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {}),
};

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const user = searchParams.get("user") || "FLOCK4H";
    const raw = (searchParams.get("tagset") || "crypto").toLowerCase();
    const tagset: Tagset = (raw in TAGS ? (raw as Tagset) : "crypto");

    const listUrl = `https://api.github.com/users/${encodeURIComponent(user)}/repos?per_page=100&type=owner&sort=updated`;

    // Kluczowe: nie utrwalaj złych odpowiedzi
    const res = await fetch(listUrl, {
      headers: apiHeaders,
      cache: "no-store",
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      // ZAWSZE status 200 dla UI; w payload info diagnostyczne
      return NextResponse.json(
        { items: [], warning: `GitHub ${res.status}`, details: text.slice(0, 800) },
        { status: 200, headers: { "Cache-Control": "no-store" } }
      );
    }

    const repos = (await res.json()) as any[];

    const wanted = new Set(TAGS[tagset].map((t) => t.toLowerCase()));
    const filtered = repos.filter(
      (r: any) => Array.isArray(r.topics) && r.topics.some((t: string) => wanted.has(String(t).toLowerCase()))
    );

    const items: {
      id: number;
      name: string;
      html_url: string;
      description: string | null;
      topics: string[];
      stars: number;
      updated_at: string;
      og: string;
    }[] = [];

    // Mały limit równoległości, żeby nie trafić w anty-abuse
    const chunk = 4;
    for (let i = 0; i < filtered.length; i += chunk) {
      const slice = filtered.slice(i, i + chunk).map(async (r: any) => {
        const fullRes = await fetch(
          `https://api.github.com/repos/${encodeURIComponent(user)}/${encodeURIComponent(r.name)}`,
          { headers: apiHeaders, next: { revalidate } }
        ).catch(() => null);

        let stars = r.stargazers_count;
        let updated_at = r.updated_at;
        let og: string | null = null;

        if (fullRes && fullRes.ok) {
          const full = await fullRes.json().catch(() => ({} as any));
          stars = full.stargazers_count ?? stars;
          updated_at = full.updated_at ?? updated_at;
          og = full.open_graph_image_url ?? null;
        }

        if (!og || /opengraph\.githubassets\.com/i.test(og)) {
          const htmlOg = await repoOgFromHtml(user, r.name);
          if (htmlOg) og = htmlOg;
        }
        if (!og) og = `https://opengraph.githubassets.com/1/${user}/${r.name}`;

        items.push({
          id: r.id,
          name: r.name,
          html_url: r.html_url,
          description: r.description,
          topics: r.topics,
          stars,
          updated_at,
          og,
        });
      });

      await Promise.all(slice);
    }

    items.sort(
      (a, b) =>
        (b.stars ?? 0) - (a.stars ?? 0) ||
        new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
    );

    return NextResponse.json(
      { items },
      { status: 200, headers: { "Cache-Control": "public, max-age=60" } }
    );
  } catch (e: any) {
    // Nigdy 400/500 na warstwie API dla UI
    return NextResponse.json(
      { items: [], warning: "internal", details: String(e?.message ?? e) },
      { status: 200, headers: { "Cache-Control": "no-store" } }
    );
  }
}

async function repoOgFromHtml(owner: string, name: string) {
  try {
    const htmlRes = await fetch(`https://github.com/${encodeURIComponent(owner)}/${encodeURIComponent(name)}`, {
      headers: { ...apiHeaders, Accept: "text/html", "User-Agent": "flock4h-og" },
      next: { revalidate },
    });
    if (!htmlRes.ok) return null;
    const html = await htmlRes.text();
    const m = html.match(/<meta\s+property="og:image"\s+content="([^"]+)"/i);
    return m?.[1] ?? null;
  } catch {
    return null;
  }
}