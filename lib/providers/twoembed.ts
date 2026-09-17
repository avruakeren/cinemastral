import type { Content } from "@/lib/types";
import type { ResolvedSource, ContentType } from "./types";
import { searchTMDB } from "@/lib/tmdb";

const EMBED_BASE = "https://www.2embed.cc";

export function buildEmbedUrl(
  tmdbId: number,
  mediaType: "movie" | "tv",
  season?: string,
  episode?: string,
): string {
  if (mediaType === "tv") {
    const s = season || "1";
    const e = episode || "1";
    return `${EMBED_BASE}/embed/tv/${tmdbId}/${s}/${e}`;
  }
  return `${EMBED_BASE}/embed/movie/${tmdbId}`;
}

export function resolve2embedByTmdbId(
  tmdbId: number,
  mediaType: "movie" | "tv",
  season?: string,
  episode?: string,
): ResolvedSource {
  return {
    id: "2embed",
    label: "2Embed",
    kind: "iframe",
    iframe: buildEmbedUrl(tmdbId, mediaType, season, episode),
  };
}

export async function resolve2embedSource(
  content: Content,
  season?: string,
  episode?: string,
): Promise<ResolvedSource | null> {
  const mediaType = mediaTypeFor(content.type);
  if (!mediaType) return null;

  const tmdb = await searchTMDB(content.title, content.release_year, content.type);
  if (!tmdb) return null;

  return resolve2embedByTmdbId(tmdb.id, tmdb.media_type, season, episode);
}

function mediaTypeFor(type: ContentType): "movie" | "tv" | null {
  switch (type) {
    case "film":
      return "movie";
    case "series":
    case "anime":
    case "donghua":
      return "tv";
    default:
      return "movie";
  }
}
