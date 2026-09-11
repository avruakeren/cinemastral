import type { Content } from "@/lib/types";
import type { ResolvedSource, StreamOption, CaptionTrack } from "./types";

/**
 * MovieBox (themebox) provider.
 *
 * Video bytes are served through the `cinemastral-moviebox` Cloudflare Worker
 * (see `workers/moviebox-proxy`). The MovieBox CDN (`bcdnxw.hakunaymatata.com`)
 * blocks datacenter egress — AWS/Vercel gets 403, Cloudflare Worker egress gets
 * 427 — so the worker forwards every request through the Oflix relay
 * (`https://oflix.web.id/video/<token>`), whose origin egress is whitelisted
 * and returns 206 with full CORS + Range support.
 *
 * The play API (`h5-api.aoneroom.com`) blocks Vercel's datacenter egress (403),
 * but the Oflix relay forwards it fine, so resolve happens through the worker's
 * `/resolve` and `/caption` routes (which proxy h5-api via the relay).
 */

const WORKER_URL = (process.env.MOVIEBOX_PROXY_URL ?? "").replace(/\/+$/, "");
const DEFAULT_MEDIA_DOMAIN = "https://netfilm.world/";

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

/** Query the h5-api through the worker (which proxies via the Oflix relay). */
async function h5ApiViaWorker(
  route: "resolve" | "caption",
  params: Record<string, string>,
): Promise<{ status: number; body: { code: number; data?: unknown } }> {
  const qs = new URLSearchParams(params).toString();
  const res = await fetch(`${WORKER_URL}/${route}?${qs}`, { next: { revalidate: 3600 } });
  return { status: res.status, body: (await res.json()) as { code: number; data?: unknown } };
}

async function resolveFromPlayApi(
  subjectId: string,
  detailPath: string,
  season?: string,
  episode?: string,
): Promise<{ streams: PlayStream[] }> {
  const { status, body } = await h5ApiViaWorker("resolve", {
    subjectId,
    se: season || "0",
    ep: episode || "0",
    detailPath,
  });
  if (status !== 200) throw new Error(`play HTTP ${status}`);
  if (body.code !== 0) throw new Error("play failed");
  return { streams: ((body.data as { streams?: PlayStream[] } | undefined)?.streams ?? []) };
}

async function fetchCaptionsFromApi(
  subjectId: string,
  detailPath: string,
  streamId: string | number,
): Promise<CaptionItem[]> {
  const { status, body } = await h5ApiViaWorker("caption", {
    subjectId,
    id: String(streamId),
    detailPath,
  });
  if (status !== 200) return [];
  return ((body.data as { captions?: CaptionItem[] } | undefined)?.captions ?? []);
}

/** Resolve a MovieBox (themebox) source through the Cloudflare Worker byte-proxy. */
export async function resolveMovieboxSource(
  content: Content,
  season?: string,
  episode?: string,
): Promise<ResolvedSource | null> {
  try {
    if (!WORKER_URL) return null;

    const subjectId = content.source_key;
    const detailPath = content.source_id ?? content.slug;
    if (!subjectId) return null;

    const { streams } = await resolveFromPlayApi(subjectId, detailPath, season, episode);
    const playable = streams
      .filter((s) => s.url && !s.vipLocked)
      .sort((a, b) => (Number(b.resolutions) || 0) - (Number(a.resolutions) || 0));

    if (playable.length === 0) return null;

    const absolute = (path: string) => (path.startsWith("http") ? path : `${WORKER_URL}${path}`);
    const streamParam = (cdnUrl: string) =>
      `/stream?url=${encodeURIComponent(cdnUrl)}&domain=${encodeURIComponent(DEFAULT_MEDIA_DOMAIN)}`;

    const streamOptions: StreamOption[] = playable.map((s) => ({
      quality: String(s.resolutions ?? "Auto"),
      url: absolute(streamParam(s.url!)),
    }));

    const captionTracks: CaptionTrack[] = [];
    const bestId = playable[0]?.id;
    if (bestId) {
      try {
        const caps = await fetchCaptionsFromApi(subjectId, detailPath, bestId);
        captionTracks.push(
          ...caps.filter((c) => c.url).map((c) => {
            const label = c.lanName || c.lan || "Subtitle";
            return {
              src: absolute(`/subtitle?url=${encodeURIComponent(c.url!)}`),
              label,
              language: c.lan ?? undefined,
              type: (c.url!.split("?")[0].toLowerCase().endsWith(".srt") ? "srt" : "vtt") as "srt" | "vtt",
              defaultTrack:
                label.toLowerCase().includes("indonesia") ||
                (c.lan ?? "").toLowerCase().includes("id"),
            };
          }),
        );
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
