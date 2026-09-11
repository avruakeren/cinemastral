import { oflixFetch, OFLIX_ACTIONS, type OflixDetail, type OflixPlayResult } from "@/lib/scrapers/oflix";
import { getContentBySlug } from "@/lib/data";
import { fetchOflixDetail } from "@/lib/sync";

const OFLIX_BASE_URL = "https://oflix.web.id/";

export interface ResolvedStream {
  streams: Array<{ quality: string; url: string }>;
  captions: Array<{ url: string; label: string; language?: string }>;
  watermark: Record<string, unknown>;
  /** When the primary Oflix play worker is region-blocked, fall back to the
   * Oflix web player (region = the viewer's IP, not the serverless region). */
  fallbackIframe?: string;
}

export async function resolveStream(
  slug: string,
  season?: string,
  episode?: string,
): Promise<ResolvedStream | null> {
  let sourceKey: string | null = null;
  let detailPath: string = slug;

  const content = await getContentBySlug(slug);
  if (content) {
    sourceKey = content.source_key ?? null;
    detailPath = content.source_id ?? slug;
  }

  if (!sourceKey) {
    try {
      const detailRes = await oflixFetch<{ success: boolean; data?: OflixDetail }>(
        OFLIX_ACTIONS.detail,
        [slug],
      );
      if (detailRes.success && detailRes.data?.subjectId) {
        sourceKey = detailRes.data.subjectId;
      }
    } catch (e) {
      console.error("stream: failed to get detail from Oflixt:", e);
    }
  }

  if (!sourceKey) {
    console.error("[stream:nosource]", slug, { detailPath, sourceId: content?.source_id ?? null });
    return null;
  }

  const playRes = await oflixFetch<OflixPlayResult>(OFLIX_ACTIONS.play, [
    sourceKey,
    season ?? "",
    episode ?? "",
    detailPath,
  ]);

  if (!playRes.success) {
    console.error("[stream:playFailed]", slug, { success: playRes.success, error: playRes.error, _debug: playRes._debug });
    // Oflix `moviebox-worker` is geo-restricted per content (e.g. "invalid region").
    // Fall back to the Oflix web player (netfilm.world/play), which is served from
    // the viewer's IP and is not subject to the serverless region block.
    try {
      const d = await fetchOflixDetail(slug);
      const fallback = d?.sources?.[0]?.url || d?.playerUrl || null;
      if (fallback) {
        return {
          streams: [],
          captions: [],
          watermark: playRes.watermark ?? {},
          fallbackIframe: fallback,
        };
      }
    } catch (fe) {
      console.error("[stream:fallbackFailed]", slug, fe);
    }
    throw new Error(playRes.error ?? "Play failed");
  }

  const streams: Array<{ quality: string; url: string }> = [];

  if (playRes.url) {
    streams.push({
      quality: "Auto",
      url: `${OFLIX_BASE_URL}${playRes.url.replace(/^\//, "")}`,
    });
  }

  if (playRes.downloads?.length) {
    const sorted = [...playRes.downloads].sort((a, b) => (b.resolution ?? 0) - (a.resolution ?? 0));
    for (const d of sorted) {
      if (!d.url) continue;
      streams.push({
        quality: String(d.resolution ?? d.label ?? "Auto"),
        url: `${OFLIX_BASE_URL}${d.url.replace(/^\//, "")}`,
      });
    }
  }

  if (streams.length === 0) {
    throw new Error("No usable stream URLs");
  }

  const captions = (playRes.captions ?? [])
    .filter((c) => c.url)
    .map((c) => ({ url: c.url as string, label: c.language ?? c.languageCode ?? "Subtitle" }));

  return { streams, captions, watermark: playRes.watermark ?? {} };
}
