import { NextRequest, NextResponse } from "next/server";

const TAGS = {
  hacking: ["hacking", "cybersecurity"],
  crypto:  ["solana", "base", "ethereum", "bitcoin", "tron", "trading", "crypto", "solana-bot", "sniper-bot"],
};

type Tagset = keyof typeof TAGS;

export const revalidate = 300; // cache

const apiHeaders: Record<string, string> = {
  Accept: "application/vnd.github+json",
  "X-GitHub-Api-Version": "2022-11-28",
  "User-Agent": "flock4h-room-app",
  ...(process.env.GITHUB_TOKEN ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {}),
};

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const user   = searchParams.get("user")   || "FLOCK4H";
  const tagset = (searchParams.get("tagset") || "crypto") as Tagset;

  const url = `https://api.github.com/users/${user}/repos?per_page=100&type=owner&sort=updated`;
  const res = await fetch(url, { headers: apiHeaders, next: { revalidate } });

  if (!res.ok) {
    const text = await res.text();
    return NextResponse.json({ error: `GitHub ${res.status}`, details: text }, { status: res.status });
  }

  const repos = (await res.json()) as any[];

  const wanted = new Set(TAGS[tagset].map((t) => t.toLowerCase()));
  const filtered = repos.filter((r) =>
    Array.isArray(r.topics) && r.topics.some((t: string) => wanted.has(t.toLowerCase()))
  );

  async function repoOgFromHtml(owner: string, name: string, revalidate: number, headers: Record<string,string>) {
    try {
      const htmlRes = await fetch(`https://github.com/${owner}/${name}`, {
        headers: { ...headers, Accept: "text/html", "User-Agent": "flock4h-og" },
        next: { revalidate },
      });
      const html = await htmlRes.text();
      const m = html.match(/<meta\s+property="og:image"\s+content="([^"]+)"/i);
      return m?.[1] ?? null;
    } catch { return null; }
  }
  
  const detailFetches = filtered.map(async (r) => {
    const fullRes = await fetch(`https://api.github.com/repos/${user}/${r.name}`, {
      headers: apiHeaders, next: { revalidate }
    });
  
    let stars = r.stargazers_count;
    let updated_at = r.updated_at;
    let og: string | null = null;
  
    if (fullRes.ok) {
      const full = await fullRes.json();
      stars = full.stargazers_count ?? stars;
      updated_at = full.updated_at ?? updated_at;
      og = full.open_graph_image_url ?? null;
    }
  
    if (!og || /opengraph\.githubassets\.com/i.test(og)) {
      const htmlOg = await repoOgFromHtml(user, r.name, revalidate, apiHeaders);
      if (htmlOg) og = htmlOg;
    }
  
    if (!og) og = `https://opengraph.githubassets.com/1/${user}/${r.name}`;
  
    return {
      id: r.id,
      name: r.name,
      html_url: r.html_url,
      description: r.description,
      topics: r.topics,
      stars,
      updated_at,
      og,
    };
  });
  
  const details = await Promise.all(detailFetches);
  const items = details.sort(
    (a, b) => (b.stars ?? 0) - (a.stars ?? 0) || new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
  );
  return NextResponse.json({ items });
}