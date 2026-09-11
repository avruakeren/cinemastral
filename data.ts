import { createInsForgeServerClient } from "@/lib/insforge/server";
import type { Content, Genre, Episode, StreamData } from "@/lib/types";

const SELECT_CONTENT =
  "id, slug, title, alt_title, synopsis, type, poster_url, backdrop_url, release_year, rating, duration, status, country, source_id, source_key, release_date, featured, trending, created_at, updated_at, genres:content_genres(genre_id, name:genres(name, slug))";

interface ContentRow extends Omit<Content, "genres" | "source_url" | "stream_data" | "stream_updated_at"> {
  source_url?: string | null;
  stream_data?: StreamData | null;
  stream_updated_at?: string | null;
  genres?: Array<{ genre_id: number; name: Array<{ name: string; slug: string }> }>;
}

export function mapContentRow(row: ContentRow): Content {
  const { genres, ...rest } = row;
  const g: Genre[] = (genres ?? []).map((x) => {
    const genreData = Array.isArray(x.name) ? x.name?.[0] : x.name;
    return {
      id: x.genre_id,
      name: genreData?.name ?? "",
      slug: genreData?.slug ?? "",
    };
  });
  return { ...rest, genres: g } as Content;
}

export async function getContents(params: {
  type?: Content["type"] | Content["type"][];
  limit?: number;
  offset?: number;
  orderBy?: string;
  orderDirection?: "asc" | "desc";
  genreSlug?: string;
  country?: string;
} = {}): Promise<Content[]> {
  const sb = (await createInsForgeServerClient()).database;
  const { type, limit = 24, offset = 0, orderBy = "created_at", orderDirection = "desc", genreSlug, country } = params;

  let query = sb.from("content").select(SELECT_CONTENT);
  if (type) query = query.in("type", Array.isArray(type) ? type : [type]);
  if (country) query = query.eq("country", country);
  if (genreSlug) {
    query = query.eq("genres.name.slug", genreSlug);
  }
  const { data, error } = await query.order(orderBy, { ascending: orderDirection === "asc" }).range(offset, offset + limit - 1);
  if (error) throw new Error(error.message);
  return (data ?? []).map(mapContentRow);
}

export async function getContentBySlug(slug: string): Promise<Content | null> {
  const sb = (await createInsForgeServerClient()).database;
  const { data, error } = await sb.from("content").select(SELECT_CONTENT).eq("slug", slug).maybeSingle();
  if (error) throw new Error(error.message);
  return data ? mapContentRow(data as ContentRow) : null;
}

export async function getContentBySourceId(sourceId: string): Promise<Content | null> {
  const sb = (await createInsForgeServerClient()).database;
  const { data, error } = await sb.from("content").select(SELECT_CONTENT).eq("source_id", sourceId).maybeSingle();
  if (error) throw new Error(error.message);
  return data ? mapContentRow(data as ContentRow) : null;
}

export async function getEpisodes(contentId: string): Promise<Episode[]> {
  const sb = (await createInsForgeServerClient()).database;
  const { data, error } = await sb
    .from("episodes")
    .select("id, content_id, season, episode_number, title, thumbnail_url, duration, stream_data, stream_updated_at, created_at")
    .eq("content_id", contentId)
    .order("season")
    .order("episode_number");
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getTrending(limit = 20): Promise<Content[]> {
  const sb = (await createInsForgeServerClient()).database;
  const { data, error } = await sb
    .from("content")
    .select(SELECT_CONTENT)
    .order("rating", { ascending: false, nullsFirst: false })
    .order("updated_at", { ascending: false })
    .range(0, limit - 1);
  if (error) throw new Error(error.message);
  return (data ?? []).map(mapContentRow);
}

export async function getRecentAdded(limit = 20): Promise<Content[]> {
  const sb = (await createInsForgeServerClient()).database;
  const { data, error } = await sb
    .from("content")
    .select(SELECT_CONTENT)
    .order("release_date", { ascending: false, nullsFirst: false })
    .order("updated_at", { ascending: false })
    .range(0, limit - 1);
  if (error) throw new Error(error.message);
  return (data ?? []).map(mapContentRow);
}

export async function getUpcoming(limit = 12): Promise<Content[]> {
  const sb = (await createInsForgeServerClient()).database;
  const now = new Date().toISOString();
  const { data, error } = await sb
    .from("content")
    .select(SELECT_CONTENT)
    .or(`release_date.gte.${now},and(release_date.is.null,release_year.gte.${new Date().getFullYear()})`)
    .order("release_date", { ascending: true, nullsFirst: false })
    .order("release_year", { ascending: true, nullsFirst: false })
    .order("rating", { ascending: false, nullsFirst: false })
    .range(0, limit - 1);
  if (error) throw new Error(error.message);
  return (data ?? []).map(mapContentRow);
}

export async function searchContent(query: string, limit = 24): Promise<Content[]> {
  const sb = (await createInsForgeServerClient()).database;
  const { data, error } = await sb
    .from("content")
    .select(SELECT_CONTENT)
    .ilike("title", `%${query}%`)
    .order("rating", { ascending: false, nullsFirst: false })
    .range(0, limit - 1);
  if (error) throw new Error(error.message);
  return (data ?? []).map(mapContentRow);
}
