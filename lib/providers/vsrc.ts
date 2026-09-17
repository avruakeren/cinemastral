import type { Content } from "@/lib/types";
import type { ResolvedSource, ContentType } from "./types";
import { searchTMDB } from "@/lib/tmdb";

const VSRC_BASE = "https://vidsrc.buzz";

export function buildVsrcEmbedUrl(
  tmdbId: number,
  mediaType: "movie" | "tv",
  season?: string,
  episode?: string,
): string {
  if (mediaType === "tv") {
    const s = season || "1";
    const e = episode || "1";
    return `${VSRC_BASE}/embed/tv/${tmdbId}/${s}/${e}`;
  }
  return `${VSRC_BASE}/embed/movie/${tmdbId}`;
}

/** Resolve a VidSrc source when we already know the TMDB id. */
export function resolveVsrcByTmdbId(
  tmdbId: number,
  mediaType: "movie" | "tv",
  season?: string,
  episode?: string,
): ResolvedSource {
  return {
    id: "vsrc",
    label: "VidSrc",
    kind: "iframe",
    iframe: buildVsrcEmbedUrl(tmdbId, mediaType, season, episode),
  };
}

/** Resolve a VidSrc source for `content` using TMDB search. */
export async function resolveVsrcSource(
  content: Content,
  season?: string,
  episode?: string,
): Promise<ResolvedSource | null> {
  const mediaType = mediaTypeFor(content.type);
  if (!mediaType) return null;

  const tmdb = await searchTMDB(content.title, content.release_year, content.type);
  if (!tmdb) return null;

  return resolveVsrcByTmdbId(tmdb.id, tmdb.media_type, season, episode);
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
