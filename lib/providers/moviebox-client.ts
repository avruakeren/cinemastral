/**
 * Client-side MovieBox resolver.
 *
 * Runs in the browser (not serverless) so h5-api.aoneroom.com and the
 * MovieBox CDN don't block the request (they only block datacenter IPs).
 */

const H5_API = "https://h5-api.aoneroom.com";
const DEFAULT_MEDIA_DOMAIN = "https://netfilm.world/";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

interface PlayStream {
  resolutions?: number | string;
  id?: string | number;
  url?: string;
  vipLocked?: boolean;
}

interface CaptionItem {
  id?: string | number;
  lan?: string;
  lanName?: string;
  url?: string;
}

export interface MovieboxStream {
  quality: string;
  url: string;
}

export interface MovieboxCaption {
  src: string;
  label: string;
  language?: string;
  type?: "srt" | "vtt";
  defaultTrack?: boolean;
}

async function h5Fetch(
  path: string,
  params: Record<string, string>,
): Promise<{ code: number; data?: unknown }> {
  const url = new URL(path, H5_API);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

  const res = await fetch(url.toString(), {
    headers: {
      "User-Agent": UA,
      Accept: "application/json",
    },
  });
  if (!res.ok) throw new Error(`h5-api ${res.status}`);
  return res.json() as Promise<{ code: number; data?: unknown }>;
}

export async function resolveMovieboxClient(
  subjectId: string,
  detailPath: string,
  season?: string,
  episode?: string,
): Promise<{ streams: MovieboxStream[]; captions: MovieboxCaption[] } | null> {
  try {
    const playData = await h5Fetch("/wefeed-h5api-bff/subject/play", {
      subjectId,
      se: season || "0",
      ep: episode || "0",
    });
    if (playData.code !== 0) return null;

    const rawStreams =
      ((playData.data as { streams?: PlayStream[] } | undefined)?.streams ?? []);
    const playable = rawStreams
      .filter((s) => s.url && !s.vipLocked)
      .sort((a, b) => (Number(b.resolutions) || 0) - (Number(a.resolutions) || 0));

    if (playable.length === 0) return null;

    const streams: MovieboxStream[] = playable.map((s) => ({
      quality: String(s.resolutions ?? "Auto"),
      url: s.url!,
    }));

    // Fetch captions for the best stream
    const captions: MovieboxCaption[] = [];
    const bestId = playable[0]?.id;
    if (bestId) {
      try {
        const capData = await h5Fetch("/wefeed-h5api-bff/subject/caption", {
          subjectId,
          id: String(bestId),
        });
        const rawCaps =
          ((capData.data as { captions?: CaptionItem[] } | undefined)?.captions ?? []);
        for (const c of rawCaps) {
          if (!c.url) continue;
          const label = c.lanName || c.lan || "Subtitle";
          captions.push({
            src: c.url,
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
      } catch {
        // captions are optional
      }
    }

    return { streams, captions };
  } catch (e) {
    console.error("[moviebox-client]", e);
    return null;
  }
}
