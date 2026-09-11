import type { Content } from "@/lib/types";
import type { ResolvedSource, StreamOption, CaptionTrack } from "./types";
import { resolveStream } from "@/lib/stream";

/** Alternative: Oflix HLS stream (uses the already-integrated play token flow). */
export async function resolveOflixSource(
  content: Content,
  season?: string,
  episode?: string,
): Promise<ResolvedSource | null> {
  try {
    const result = await resolveStream(content.slug, season, episode);
    if (!result) return null;

    const streams: StreamOption[] = (result.streams ?? []).map((s) => ({
      quality: s.quality,
      url: s.url,
    }));

    if (streams.length === 0) {
      // No HLS tokens — fall back to the Oflix web-player iframe (geo-friendly).
      if (result.fallbackIframe) {
        return { id: "oflix", label: "Oflix (web)", kind: "iframe", iframe: result.fallbackIframe };
      }
      return null;
    }

    const captions: CaptionTrack[] = (result.captions ?? []).map((c) => {
      const label = c.label ?? "Subtitle";
      return {
        src: `/api/subtitle?url=${encodeURIComponent(c.url)}`,
        label,
        language: c.language ?? "id",
        defaultTrack:
          label.toLowerCase().includes("indonesia") ||
          (c.language ?? "").toLowerCase().includes("id"),
      };
    });

    return {
      id: "oflix",
      label: "Oflix",
      kind: "hls",
      hls: { streams, captions },
    };
  } catch (e) {
    console.error("[oflix:resolveSource]", content.slug, e);
    return null;
  }
}
