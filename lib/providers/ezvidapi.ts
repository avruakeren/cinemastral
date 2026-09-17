import type { Content } from "@/lib/types";
import type { ResolvedSource, ContentType } from "./types";
import { searchTMDB } from "@/lib/tmdb";
import { createInsForgeServerClient } from "@/lib/insforge/server";
import { createAdminServerClient } from "@/lib/insforge/admin";

const EZVIDAPI_BASE = "https://ezvidapi.com";

export function buildEzvidapiEmbedUrl(
  tmdbId: number,
  mediaType: "movie" | "tv",
  season?: string,
  episode?: string,
): string {
  if (mediaType === "tv") {
    const s = season || "1";
    const e = episode || "1";
    return `${EZVIDAPI_BASE}/embed/tv/${tmdbId}/${s}/${e}`;
  }
  return `${EZVIDAPI_BASE}/embed/movie/${tmdbId}`;
}

/** Resolve an ezvidapi source when we already know the TMDB id. */
export function resolveEzvidapiByTmdbId(
  tmdbId: number,
  mediaType: "movie" | "tv",
  _content: Content | null,
  season?: string,
  episode?: string,
): ResolvedSource {
  return embedSource(tmdbId, mediaType);
}

/** Resolve an ezvidapi source for `content`. Reads TMDB ID from any cached provider. */
export async function resolveEzvidapiSource(
  content: Content,
  season?: string,
  episode?: string,
): Promise<ResolvedSource | null> {
  const mediaType = mediaTypeFor(content.type);
  if (!mediaType) {
    console.log("[ezvidapi] no mediaType for", content.type);
    return null;
  }

  const resolved = await findTmdbId(content.id, mediaType, content);
  if (!resolved) {
    console.log("[ezvidapi] no tmdb id found for", content.slug, content.id);
    return null;
  }

  console.log("[ezvidapi] resolved", content.slug, "→ TMDB", resolved.tmdb_id);

  try {
    await upsertEzvidapiCache(content.id, resolved.tmdb_id, resolved.media_type);
  } catch (e) {
    console.warn("[ezvidapi] cache write skipped:", (e as Error).message);
  }
  return embedSource(resolved.tmdb_id, resolved.media_type);
}

/**
 * Find a TMDB ID for this content by checking:
 * 1. EzVidAPI's own cache in content_sources
 * 2. Any other provider's cache in content_sources (e.g. VidCore)
 * 3. TMDB search as last resort
 */
async function findTmdbId(
  contentId: string,
  mediaType: "movie" | "tv",
  content: Content,
): Promise<{ tmdb_id: number; media_type: "movie" | "tv" } | null> {
  // 1. Own cache
  console.log("[ezvidapi] checking own cache for", contentId);
  const own = await readProviderCache(contentId, "ezvidapi");
  if (own) {
    console.log("[ezvidapi] found own cache:", own);
    return own;
  }

  // 2. Any provider's cache (e.g. vidcore)
  console.log("[ezvidapi] checking any provider cache for", contentId);
  const any = await readAnyProviderCache(contentId);
  if (any) {
    console.log("[ezvidapi] found provider cache:", any);
    return any;
  }

  // 3. TMDB search (last resort, needs API key)
  console.log("[ezvidapi] trying searchTMDB for", content.title);
  const tmdb = await searchTMDB(content.title, content.release_year, content.type);
  if (tmdb) {
    console.log("[ezvidapi] searchTMDB found:", tmdb);
    return { tmdb_id: tmdb.id, media_type: tmdb.media_type };
  }

  console.log("[ezvidapi] all methods failed for", content.slug);
  return null;
}

function embedSource(tmdbId: number, mediaType: "movie" | "tv"): ResolvedSource {
  return {
    id: "ezvidapi",
    label: "EzVidAPI",
    kind: "iframe",
    iframe: buildEzvidapiEmbedUrl(tmdbId, mediaType),
  };
}

async function readProviderCache(
  contentId: string,
  provider: string,
): Promise<{ tmdb_id: number; media_type: "movie" | "tv" } | null> {
  try {
    const sb = (await createInsForgeServerClient()).database;
    const { data, error } = await sb
      .from("content_sources")
      .select("metadata")
      .eq("content_id", contentId)
      .eq("provider", provider)
      .maybeSingle();
    if (error) {
      console.error("[ezvidapi] readProviderCache error:", error.message);
      return null;
    }
    if (!data) return null;
    const m = (data.metadata as Record<string, unknown>) ?? {};
    const tmdbId = Number(m.tmdb_id);
    const mt = m.media_type;
    if (!tmdbId || (mt !== "movie" && mt !== "tv")) return null;
    return { tmdb_id: tmdbId, media_type: mt };
  } catch (e) {
    console.error("[ezvidapi] readProviderCache exception:", (e as Error).message);
    return null;
  }
}

async function readAnyProviderCache(
  contentId: string,
): Promise<{ tmdb_id: number; media_type: "movie" | "tv" } | null> {
  try {
    const sb = (await createInsForgeServerClient()).database;
    const { data, error } = await sb
      .from("content_sources")
      .select("provider, metadata")
      .eq("content_id", contentId);
    if (error) {
      console.error("[ezvidapi] readAnyProviderCache error:", error.message);
      return null;
    }
    if (!data?.length) {
      console.log("[ezvidapi] content_sources empty for", contentId);
      return null;
    }
    console.log("[ezvidapi] found", data.length, "content_sources entries");
    for (const row of data) {
      const m = (row.metadata as Record<string, unknown>) ?? {};
      const tmdbId = Number(m.tmdb_id);
      const mt = m.media_type;
      console.log("[ezvidapi] checking", row.provider, "→ tmdb_id:", tmdbId, "media_type:", mt);
      if (tmdbId && (mt === "movie" || mt === "tv")) {
        return { tmdb_id: tmdbId, media_type: mt };
      }
    }
    return null;
  } catch (e) {
    console.error("[ezvidapi] readAnyProviderCache exception:", (e as Error).message);
    return null;
  }
}

async function upsertEzvidapiCache(
  contentId: string,
  tmdbId: number,
  mediaType: "movie" | "tv",
): Promise<void> {
  const admin = createAdminServerClient();
  await admin.database.from("content_sources").upsert(
    [
      {
        content_id: contentId,
        provider: "ezvidapi",
        source_key: String(tmdbId),
        external_url: buildEzvidapiEmbedUrl(tmdbId, mediaType),
        priority: 2,
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
      return "tv";
    default:
      return "movie";
  }
}
