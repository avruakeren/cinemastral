import type { Content } from "@/lib/types";
import type { ResolvedSource, ContentType } from "./types";
import { searchTMDB } from "@/lib/tmdb";
import { createAdminServerClient } from "@/lib/insforge/admin";
import { createInsForgeServerClient } from "@/lib/insforge/server";

const VIDCORE_BASE = "https://cinesrc.st";

export function buildVidcoreEmbedUrl(
  tmdbId: number,
  mediaType: "movie" | "tv",
  season?: string,
  episode?: string,
): string {
  let path: string;
  if (mediaType === "tv") {
    const s = season || "1";
     const e = episode || "1";
     path = `embed/tv/${tmdbId}?s=${encodeURIComponent(s)}&e=${encodeURIComponent(e)}`;
  } else {
    path = `embed/movie/${tmdbId}`;
  }
    return `${VIDCORE_BASE}/${path}?autoplay=false&muted=false`;
}

/** Resolve a VidCore source when we already know the TMDB id (e.g. for TMDB-backed slugs). */
export function resolveVidcoreByTmdbId(
  tmdbId: number,
  mediaType: "movie" | "tv",
  _content: Content | null,
  season?: string,
  episode?: string,
): ResolvedSource {
  return embedSource(tmdbId, mediaType, _content, season, episode);
}

/** Resolve a VidCore source for `content`, caching the TMDB id in `content_sources`. */
export async function resolveVidcoreSource(
  content: Content,
  season?: string,
  episode?: string,
): Promise<ResolvedSource | null> {
  const mediaType = mediaTypeFor(content.type);
  if (!mediaType) return null; // VidCore handles movies & TV; skip anime/donghua as primary.

  const cached = await readVidcoreCache(content.id);
  if (cached) {
    const { tmdb_id, media_type } = cached;
    return embedSource(tmdb_id, media_type, content, season, episode);
  }

  const tmdb = await searchTMDB(content.title, content.release_year, content.type);
  if (!tmdb) return null;

  try {
    await upsertVidcoreCache(content.id, tmdb.id, tmdb.media_type);
  } catch (e) {
    // Cache write is best-effort: never let a DB/env problem break the page.
    console.warn("[vidcore] cache write skipped:", (e as Error).message);
  }
  return embedSource(tmdb.id, tmdb.media_type, content, season, episode);
}

function embedSource(
  tmdbId: number,
  mediaType: "movie" | "tv",
  _content: Content | null,
  season?: string,
  episode?: string,
): ResolvedSource {
  return {
    id: "vidcore",
    label: "CineSrc",
    kind: "iframe",
    iframe: buildVidcoreEmbedUrl(tmdbId, mediaType, season, episode),
  };
}

async function readVidcoreCache(contentId: string): Promise<{ tmdb_id: number; media_type: "movie" | "tv" } | null> {
  try {
    const sb = (await createInsForgeServerClient()).database;
    const { data, error } = await sb
      .from("content_sources")
      .select("metadata")
      .eq("content_id", contentId)
      .eq("provider", "vidcore")
      .maybeSingle();
    if (error || !data) return null;
    const m = (data.metadata as Record<string, unknown>) ?? {};
    const tmdbId = Number(m.tmdb_id);
    const mediaType = m.media_type;
    if (!tmdbId || (mediaType !== "movie" && mediaType !== "tv")) return null;
    return { tmdb_id: tmdbId, media_type: mediaType };
  } catch (e) {
    console.warn("[vidcore] cache read skipped:", (e as Error).message);
    return null;
  }
}

async function upsertVidcoreCache(contentId: string, tmdbId: number, mediaType: "movie" | "tv"): Promise<void> {
  const admin = createAdminServerClient();
  await admin.database.from("content_sources").upsert(
    [
      {
        content_id: contentId,
        provider: "vidcore",
        source_key: String(tmdbId),
        external_url: buildVidcoreEmbedUrl(tmdbId, mediaType),
        priority: 1,
        metadata: { tmdb_id: tmdbId, media_type: mediaType },
      },
    ],
    { onConflict: "content_id,provider" },
  );
}

function mediaTypeFor(type: ContentType): "movie" | "tv" | null {
  switch (type) {
    case "film":
      return "movie";
    case "series":
    case "anime":
    case "donghua":
      // VidCore supports TV; anime/donghua may not be present in TMDB/ VidCore — only set TV
      // if type is series to avoid wrong matches for anime.
      return "tv";
    default:
      return "movie";
  }
}
