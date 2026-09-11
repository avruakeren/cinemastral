import type { Content } from "@/lib/types";
import type { ResolvedSource, StreamOption, CaptionTrack } from "./types";

/**
 * MovieBox provider — calls h5-api.aoneroom.com directly from Vercel.
 *
 * Key insight: the play API works without mb_token as long as the Referer
 * header contains the full detailPath, e.g.:
 *   Referer: https://netfilm.world/spa/videoPlayPage/movies/{detailPath}
 *
 * CDN bytes (bcdnxw.hakunaymatata.com) are proxied through /api/moviebox-stream
 * because the CDN blocks datacenter IPs.
 */

const H5_API = "https://h5-api.aoneroom.com";
const REFERER_BASE = "https://netfilm.world/spa/videoPlayPage/movies/";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

interface PlayStream {
  format?: string;
  id?: string | number;
  url?: string;
  resolutions?: number | string;
  size?: string;
  duration?: number;
  codecName?: string;
  vipLocked?: boolean;
}

interface CaptionItem {
  id?: string | number;
  lan?: string;
  lanName?: string;
  url?: string;
}

async function h5Fetch(
  path: string,
  params: Record<string, string>,
  referer: string,
): Promise<{ status: number; body: { code: number; data?: unknown } }> {
  const url = new URL(path, H5_API);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

  const res = await fetch(url.toString(), {
    headers: {
      "User-Agent": UA,
      Referer: referer,
      Accept: "application/json",
    },
    next: { revalidate: 3600 },
  });
  if (!res.ok) return { status: res.status, body: { code: -1 } };
  return { status: res.status, body: (await res.json()) as { code: number; data?: unknown } };
}

/** Resolve a MovieBox source for the given content. */
export async function resolveMovieboxSource(
  content: Content,
  season?: string,
  episode?: string,
): Promise<ResolvedSource | null> {
  try {
    const subjectId = content.source_key;
    const detailPath = content.source_id ?? content.slug;
    if (!subjectId) return null;

    const referer = `${REFERER_BASE}${detailPath}`;

    // 1. Fetch play streams
    const playRes = await h5Fetch(
      "/wefeed-h5api-bff/subject/play",
      {
        subjectId,
        se: season || "0",
        ep: episode || "0",
      },
      referer,
    );
    if (playRes.body.code !== 0) return null;

    const rawStreams =
      ((playRes.body.data as { streams?: PlayStream[] } | undefined)?.streams ?? []);
    const playable = rawStreams
      .filter((s) => s.url && !s.vipLocked)
      .sort((a, b) => (Number(b.resolutions) || 0) - (Number(a.resolutions) || 0));

    if (playable.length === 0) return null;

    // 2. Build stream options — CDN URLs proxied through /api/moviebox-stream
    const streamOptions: StreamOption[] = playable.map((s) => ({
      quality: String(s.resolutions ?? "Auto"),
      url: `/api/moviebox-stream?url=${encodeURIComponent(s.url!)}&domain=${encodeURIComponent(referer)}`,
    }));

    // 3. Fetch captions for the best stream
    const captionTracks: CaptionTrack[] = [];
    const bestId = playable[0]?.id;
    if (bestId) {
      try {
        const capRes = await h5Fetch(
          "/wefeed-h5api-bff/subject/caption",
          { subjectId, id: String(bestId) },
          referer,
        );
        if (capRes.body.code === 0) {
          const rawCaps =
            ((capRes.body.data as { captions?: CaptionItem[] } | undefined)?.captions ?? []);
          for (const c of rawCaps) {
            if (!c.url) continue;
            const label = c.lanName || c.lan || "Subtitle";
            captionTracks.push({
              src: `/api/moviebox-stream?url=${encodeURIComponent(c.url)}&domain=${encodeURIComponent(referer)}`,
              label,
              language: c.lan ?? undefined,
              type: (c.url.split("?")[0].toLowerCase().endsWith(".srt")
                ? "srt"
                : "vtt") as "srt" | "vtt",
              defaultTrack:
                label.toLowerCase().includes("indonesia") ||
                (c.lan ?? "").toLowerCase().includes("id"),
            });
          }
        }
      } catch (e) {
        console.error("[moviebox:captions]", content.slug, e);
      }
    }

    return {
      id: "moviebox",
      label: "MovieBox",
      kind: "hls",
      hls: { streams: streamOptions, captions: captionTracks },
    };
  } catch (e) {
    console.error("[moviebox:resolveSource]", content.slug, e);
    return null;
  }
}
