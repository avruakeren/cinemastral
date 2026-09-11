import { NextRequest, NextResponse } from "next/server";
import {
  getContents,
  getTrending,
  getUpcoming,
  getRecentAdded,
  searchContent,
} from "@/lib/data";
import { getTmdbTrending, getTmdbPopular, tmdbToFullContent } from "@/lib/tmdb";
import type { Content } from "@/lib/types";

export const dynamic = "force-dynamic";

const VALID_TYPES = ["film", "series", "anime", "donghua"] as const;

interface HomeRow {
  key: string;
  title: string;
  href?: string;
  items: Content[];
}

async function tmdbTrendingOrDb(fallback: () => Promise<Content[]>): Promise<Content[]> {
  try {
    const items = await getTmdbTrending(20);
    if (items.length > 0) return items.map((i) => tmdbToFullContent(i) as unknown as Content);
  } catch (e) {
    console.warn("[catalog] tmdb trending failed:", (e as Error).message);
  }
  return fallback();
}

async function tmdbPopularOrDb(fallback: () => Promise<Content[]>): Promise<Content[]> {
  try {
    const items = await getTmdbPopular(20);
    if (items.length > 0) return items.map((i) => tmdbToFullContent(i) as unknown as Content);
  } catch (e) {
    console.warn("[catalog] tmdb popular failed:", (e as Error).message);
  }
  return fallback();
}

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;

  const section = sp.get("section") ?? "";

  if (section === "home") {
    try {
      const [trending, films, series, anime, recent, kdrama, dramaChina, seriesIndo, upcoming] =
        await Promise.all([
          tmdbTrendingOrDb(() => getTrending(20)),
          getContents({ type: "film", limit: 20, orderBy: "rating", orderDirection: "desc" }),
          getContents({ type: "series", limit: 20, orderBy: "rating", orderDirection: "desc" }),
          getContents({ type: "anime", limit: 20, orderBy: "rating", orderDirection: "desc" }),
          getRecentAdded(20),
          getContents({ type: "series", country: "Korea", limit: 20, orderBy: "rating", orderDirection: "desc" }),
          getContents({ type: "series", country: "China", limit: 20, orderBy: "rating", orderDirection: "desc" }),
          getContents({ type: "series", country: "Indonesia", limit: 20, orderBy: "rating", orderDirection: "desc" }),
          getUpcoming(16),
        ]);

      const popular = await tmdbPopularOrDb(() => Promise.resolve(series));
      const hero = trending.length >= 3 ? trending : [...films, ...series, ...anime].slice(0, 8);

      const rows: HomeRow[] = [
        { key: "trending", title: "Sedang Trending", items: trending },
        { key: "film-best", title: "Film Terbaik", items: films, href: "/film" },
        { key: "popular", title: "Sedang Populer", items: popular },
        { key: "kdrama", title: "K-Drama", items: kdrama, href: "/series" },
        { key: "drama-china", title: "Drama China", items: dramaChina, href: "/series" },
        { key: "series-indo", title: "Series Indonesia", items: seriesIndo, href: "/series" },
        { key: "anime", title: "Anime & Donghua", items: anime, href: "/anime" },
        { key: "upcoming", title: "Akan Tayang", items: upcoming },
        { key: "recent", title: "Terbaru Ditambahkan", items: recent },
      ].filter((r) => r.items.length > 0);

      return NextResponse.json({ hero: hero.slice(0, 8), rows });
    } catch (e) {
      console.error("[catalog:home]", e);
      return NextResponse.json({ error: String((e as Error).message ?? e) }, { status: 500 });
    }
  }

  const type = sp.get("type") ?? "";
  const genre = sp.get("genre") ?? "";
  const country = sp.get("country") ?? "";
  const query = sp.get("query") ?? "";
  const limit = Math.min(50, Math.max(1, parseInt(sp.get("limit") ?? "24", 10) || 24));
  const offset = Math.max(0, parseInt(sp.get("offset") ?? "0", 10) || 0);
  const orderBy = sp.get("orderBy") ?? "created_at";
  const orderDirection = sp.get("orderDirection") === "asc" ? "asc" : "desc";

  try {
    if (query) {
      const items = await searchContent(query, limit);
      return NextResponse.json({ items });
    }

    const typeList = VALID_TYPES.includes(type as (typeof VALID_TYPES)[number])
      ? (type as Content["type"])
      : undefined;

    const items = await getContents({
      type: typeList,
      limit,
      offset,
      orderBy,
      orderDirection,
      genreSlug: genre || undefined,
      country: country || undefined,
    });

    return NextResponse.json({ items, offset, limit });
  } catch (e) {
    console.error("[catalog]", e);
    return NextResponse.json({ error: String((e as Error).message ?? e) }, { status: 500 });
  }
}
