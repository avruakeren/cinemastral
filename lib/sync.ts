import { createAdminServerClient } from "@/lib/insforge/admin";
import { getContentBySlug, getEpisodes } from "@/lib/data";
import type { Episode } from "@/lib/types";
import {
  oflixFetch,
  OFLIX_ACTIONS,
  oflixDetailToContent,
  oflixDetailToEpisodes,
  type OflixDetail,
} from "@/lib/scrapers/oflix";
import type { Content } from "@/lib/types";

export async function fetchOflixDetail(slug: string): Promise<OflixDetail | null> {
  try {
    const res = await oflixFetch<{ success: boolean; data?: OflixDetail }>(
      OFLIX_ACTIONS.detail,
      [slug],
    );
    return res.success ? res.data ?? null : null;
  } catch {
    return null;
  }
}

/**
 * Ensure a content (and its episodes) exist in the local DB for the given slug.
 * If it already exists, return it. If not, fetch the detail from Oflix and
 * insert it using the admin client (bypasses RLS), then re-fetch so every
 * caller receives a record with a real UUID `id` — which is required for
 * progress/watchlist inserts (those columns are UUID FK constraints).
 */
export async function ensureContentSynced(slug: string): Promise<Content | null> {
  const existing = await getContentBySlug(slug);
  if (existing) return existing;

  const d = await fetchOflixDetail(slug);
  if (!d) return null;

  const content = oflixDetailToContent(slug, d);
  const admin = createAdminServerClient();

  const { data: inserted, error: insertErr } = await admin.database
    .from("content")
    .insert([
      {
        slug: content.slug,
        title: content.title,
        alt_title: content.alt_title,
        synopsis: content.synopsis,
        type: content.type,
        poster_url: content.poster_url,
        backdrop_url: content.backdrop_url,
        release_year: content.release_year,
        rating: content.rating,
        duration: content.duration,
        status: content.status,
        country: content.country,
        source_id: content.source_id,
        source_key: content.source_key,
        release_date: content.release_date ?? null,
        featured: content.featured,
        trending: content.trending,
      },
    ])
    .select("id")
    .single();

  if (insertErr || !inserted) {
    console.error("sync: failed to insert content", slug, insertErr?.message);
    return null;
  }

  const contentId = inserted.id;

  for (const g of content.genres ?? []) {
    const { data: genreRow, error: genreErr } = await admin.database
      .from("genres")
      .upsert([{ name: g.name, slug: g.slug }], { onConflict: "name" })
      .select("id")
      .single();
    if (genreErr || !genreRow) continue;
    await admin.database.from("content_genres").upsert(
      [{ content_id: contentId, genre_id: genreRow.id }],
      { onConflict: "content_id,genre_id" },
    );
  }

  const episodes = oflixDetailToEpisodes(slug, d);
  if (episodes.length > 0) {
    const { error: epErr } = await admin.database.from("episodes").insert(
      episodes.map((e) => ({
        content_id: contentId,
        season: e.season,
        episode_number: e.episode_number,
        title: e.title,
        thumbnail_url: e.thumbnail_url,
        duration: e.duration,
      })),
    );
    if (epErr) {
      console.error("sync: failed to insert episodes for", slug, epErr.message);
    }
  }

  const synced = await getContentBySlug(slug);
  return synced;
}

export async function getContentWithEpisodes(slug: string): Promise<{
  content: Content | null;
  episodes: Episode[];
}> {
  const content = await ensureContentSynced(slug);
  if (!content) return { content: null, episodes: [] };
  const episodes = await getEpisodes(content.id);
  return { content, episodes };
}
