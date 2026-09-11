import { oflixFetch, OFLIX_ACTIONS, normalizeCatalogItem, type OflixCatalogItem } from "@/lib/scrapers/oflix";
import { createInsForgeServerClient } from "@/lib/insforge/server";
import { mapContentRow } from "@/lib/data";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { searchTmdbResults, tmdbToContent } from "@/lib/tmdb";

export const dynamic = "force-dynamic";

interface SearchResultItem {
  id: string;
  slug: string;
  title: string;
  type: string;
  posterUrl: string | null;
  releaseYear: number | null;
  releaseDate: string | null;
  rating: number | null;
  sourceId: string | null;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q") ?? "";

  const limited = rateLimit(`search:${clientIp(request)}`, 30);
  if (!limited.ok) {
    return Response.json({ error: "Too many requests" }, { status: 429 });
  }

  if (!query.trim()) {
    return Response.json({ results: [] });
  }

  const merged: SearchResultItem[] = [];
  const seenTitles = new Set<string>();
  const seenSlugs = new Set<string>();

  const push = (item: SearchResultItem) => {
    const t = item.title.trim().toLowerCase();
    if (!t || seenSlugs.has(item.slug) || seenTitles.has(t)) return;
    seenTitles.add(t);
    seenSlugs.add(item.slug);
    merged.push(item);
  };

  // 1. Local DB (search title + alt_title)
  try {
    const sb = await createInsForgeServerClient();
    const { data: localData } = await sb.database
      .from("content")
      .select("id, slug, title, alt_title, synopsis, type, poster_url, backdrop_url, release_year, rating, duration, status, country, source_id, source_key, featured, trending, created_at, updated_at, genres:content_genres(genre_id, name:genres(name, slug))")
      .or(`title.ilike.%${query}%,alt_title.ilike.%${query}%`)
      .order("rating", { ascending: false, nullsFirst: false })
      .range(0, 23);

    for (const c of (localData ?? []).map((row) => mapContentRow(row as never))) {
      push({
        id: c.id,
        slug: c.slug,
        title: c.title,
        type: c.type,
        posterUrl: c.poster_url,
        releaseYear: c.release_year,
        releaseDate: c.release_date ?? null,
        rating: c.rating,
        sourceId: c.slug,
      });
    }
  } catch (e) {
    console.error("search-oflix local error:", e);
  }

  // 2. TMDB (if API key available)
  try {
    const tmdb = await searchTmdbResults(query);
    for (const item of tmdb) {
      const c = tmdbToContent(item);
      push({
        id: c.slug,
        slug: c.slug,
        title: c.title,
        type: c.type,
        posterUrl: c.poster_url,
        releaseYear: c.release_year,
        releaseDate: c.release_date,
        rating: c.rating,
        sourceId: c.slug,
      });
    }
  } catch (e) {
    console.error("search-oflix tmdb error:", e);
  }

  // 3. Oflixt (fallback, may fail if Oflix relay is down)
  try {
    const res = await oflixFetch<{ success: boolean; items: OflixCatalogItem[] }>(
      OFLIX_ACTIONS.search,
      [query]
    );
    const queryWords = query.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 1);
    const sharesQuery = (title: string) => {
      const words = new Set(title.toLowerCase().split(/[^a-z0-9]+/));
      return words.size > 0 && queryWords.some((w) => words.has(w));
    };
    if (res.success && Array.isArray(res.items)) {
      for (const raw of res.items) {
        const n = normalizeCatalogItem(raw);
        if (queryWords.length > 0 && !sharesQuery(n.title)) continue;
        push({
          id: n.sourceId ?? n.slug,
          slug: n.slug,
          title: n.title,
          type: n.type,
          posterUrl: n.posterUrl,
          releaseYear: n.releaseYear,
          releaseDate: null,
          rating: n.rating,
          sourceId: n.sourceId,
        });
      }
    }
  } catch (e) {
    console.error("search-oflix oflix error:", e);
  }

  return Response.json({ results: merged });
}
