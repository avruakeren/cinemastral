import { createAdminClient } from "npm:@insforge/sdk";

const OFLIX_BASE_URL = "https://oflix.web.id/";
const ACTIONS = {
  play: "7848fa0daf1d1acb7a2efb7ac963e06f0cd618810d",
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, Range",
  "Access-Control-Expose-Headers": "Content-Range, Accept-Ranges, Content-Length, Content-Type",
};

const STALE_MS = 6 * 60 * 60 * 1000; // 6 hours
const REQUEST_TIMEOUT_MS = 25_000;

async function oflixFetch<T>(action: string, args: unknown[]): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(OFLIX_BASE_URL, {
      method: "POST",
      headers: {
        "Next-Action": action,
        "Content-Type": "text/plain;charset=UTF-8",
      },
      body: JSON.stringify(args),
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`Oflix HTTP ${res.status}`);
    const text = await res.text();
    const dataLine = text.split("\n").find((l) => l.startsWith("1:"));
    if (!dataLine) throw new Error("Oflix flight response missing data line");
    return JSON.parse(dataLine.slice(2)) as T;
  } finally {
    clearTimeout(timer);
  }
}

interface PlayDownload {
  url?: string;
  resolution?: number;
  label?: string;
}

interface PlayResult {
  success: boolean;
  url?: string;
  downloads?: PlayDownload[];
  captions?: Array<{ url?: string; languageCode?: string; lan?: string; language?: string }>;
  watermark?: { image?: string; text?: string };
  source?: string;
  error?: string;
}

interface ResolvedStream {
  quality: string;
  cdnUrl: string;
  referer: string;
  /** Oflix `/video/<token>` proxy path — used as fallback when the CDN blocks the egress IP. */
  proxyPath?: string;
}

interface StreamCache {
  streams: ResolvedStream[];
  captions: Array<{ url: string; label: string }>;
  watermark: { image?: string; text?: string };
  resolvedAt: string;
}

/** content.stream_data is a map: key -> StreamCache (film uses "film", episodes use "s<S>:e<E>"). */
type StreamDataMap = Record<string, StreamCache>;

function cacheKey(season: string, episode: string): string {
  return season || episode ? `s${season || "0"}:e${episode || "0"}` : "film";
}

function decodeToken(token: string): { u?: string; r?: string } {
  try {
    const json = atob(token);
    return JSON.parse(json);
  } catch {
    return {};
  }
}

function isFresh(ts: string | null | undefined): boolean {
  if (!ts) return false;
  return Date.now() - new Date(ts).getTime() < STALE_MS;
}

async function resolvePlay(
  admin: ReturnType<typeof createAdminClient>,
  content: { id: string; source_id: string | null; source_key: string | null },
  season: string,
  episode: string
): Promise<{ cache: StreamCache; cached: boolean }> {
  const key = cacheKey(season, episode);

  const { data: row } = await admin.database
    .from("content")
    .select("stream_data, stream_updated_at")
    .eq("id", content.id)
    .maybeSingle();

  const map = (row?.stream_data as StreamDataMap | null) ?? {};
  const cached = map[key]?.streams?.length ? map[key] : null;
  if (cached && isFresh(row?.stream_updated_at as string)) {
    return { cache: cached, cached: true };
  }

  if (!content.source_key) throw new Error("content has no source_key (numeric Oflix id)");
  const res = await oflixFetch<PlayResult>(ACTIONS.play, [
    content.source_key,
    season || "",
    episode || "",
    content.source_id || "",
  ]);
  if (!res.success) {
    throw new Error(res.error || "Oflix play failed");
  }

  const downloads = res.downloads?.length
    ? [...res.downloads].sort((a, b) => (b.resolution || 0) - (a.resolution || 0))
    : [];
  const streams: ResolvedStream[] = [];

  if (res.url) {
    const token = res.url.replace(/^\/video\//, "");
    const { u, r } = decodeToken(token);
    if (u) streams.push({ quality: "Auto", cdnUrl: u, referer: r || OFLIX_BASE_URL, proxyPath: res.url });
  }
  for (const d of downloads) {
    const token = d.url?.replace(/^\/video\//, "") ?? "";
    const { u, r } = decodeToken(token);
    if (u) streams.push({ quality: String(d.resolution ?? d.label ?? "Auto"), cdnUrl: u, referer: r || OFLIX_BASE_URL, proxyPath: d.url });
  }
  if (streams.length === 0) throw new Error("no usable stream URLs");

  const captions = (res.captions ?? [])
    .filter((c) => c.url)
    .map((c) => ({ url: c.url as string, label: c.language || c.languageCode || "Subtitle" }));

  const cache: StreamCache = {
    streams,
    captions,
    watermark: res.watermark || {},
    resolvedAt: new Date().toISOString(),
  };

  map[key] = cache;
  await admin.database
    .from("content")
    .update({ stream_data: map, stream_updated_at: cache.resolvedAt })
    .eq("id", content.id);

  return { cache, cached: false };
}

function pickQuality(streams: ResolvedStream[], quality?: string | null): ResolvedStream {
  if (quality && quality !== "Auto") {
    const found = streams.find((s) => s.quality === quality);
    if (found) return found;
  }
  return streams[0];
}

function json(res: unknown, status = 200): Response {
  return new Response(JSON.stringify(res), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export default async function (req: Request): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const baseUrl = Deno.env.get("INSFORGE_BASE_URL");
  const apiKey = Deno.env.get("API_KEY") || Deno.env.get("INSFORGE_API_KEY");
  if (!baseUrl || !apiKey) {
    return json({ success: false, error: "Missing INSFORGE_BASE_URL / API_KEY secrets" }, 500);
  }

  const url = new URL(req.url);
  const detailPath = url.searchParams.get("detailPath") || "";
  const season = url.searchParams.get("season") || "";
  const episode = url.searchParams.get("episode") || "";
  const quality = url.searchParams.get("quality");

  if (!detailPath) {
    return json({ success: false, error: "Missing detailPath query param" }, 400);
  }

  const admin = createAdminClient({ baseUrl, apiKey });

  const { data: content, error: contentError } = await admin.database
    .from("content")
    .select("id, slug, source_id, source_key")
    .eq("source_id", detailPath)
    .maybeSingle();
  if (contentError || !content) {
    return json({ success: false, error: contentError?.message ?? "Content not found" }, 404);
  }

  try {
    if (req.method === "POST") {
      const { cache, cached } = await resolvePlay(admin, content, season, episode);
      return json({
        success: true,
        cached,
        // Browser-friendly playable URLs. The CDN blocks datacenter IPs, so we surface
        // Oflix's own /video/<token> proxy which works from residential/Indonesian IPs
        // (and doesn't need a Referer/CORS for <video> playback). Direct CDN URLs are
        // included too for debugging/hybrid use.
        streams: cache.streams.map((s) => ({
          quality: s.quality,
          url: s.proxyPath ? `${OFLIX_BASE_URL}${s.proxyPath.replace(/^\//, "")}` : s.cdnUrl,
        })),
        captions: cache.captions,
        watermark: cache.watermark,
        proxyUrl: `${url.origin}${url.pathname}?detailPath=${encodeURIComponent(detailPath)}&season=${encodeURIComponent(season)}&episode=${encodeURIComponent(episode)}&quality=${encodeURIComponent(pickQuality(cache.streams).quality)}`,
      });
    }

    // ---- GET: redirect to the playable source ----
    // Byte-proxying from a cloud egress IP is blocked by the upstream CDN (426), so we
    // resolve the stream and 302 the player to Oflix's /video/<token> proxy. The browser
    // streams directly from a residential IP where the CDN allows it.
    const { cache } = await resolvePlay(admin, content, season, episode);
    const stream = pickQuality(cache.streams, quality);

    if (!stream.proxyPath) {
      // No proxy path available — attempt direct CDN streaming as a best effort.
      const range = req.headers.get("Range") || "";
      const headers: Record<string, string> = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0 Safari/537.36",
        Referer: stream.referer,
        Accept: "*/*",
      };
      if (range) headers["Range"] = range;
      const upstream = await fetch(stream.cdnUrl, { headers });
      if (!upstream.ok && upstream.status !== 206) {
        return json({ success: false, error: `CDN upstream ${upstream.status}` }, upstream.status);
      }
      const outHeaders = new Headers(corsHeaders);
      const ct = upstream.headers.get("Content-Type");
      if (ct) outHeaders.set("Content-Type", ct);
      const cl = upstream.headers.get("Content-Length");
      if (cl) outHeaders.set("Content-Length", cl);
      const cr = upstream.headers.get("Content-Range");
      if (cr) outHeaders.set("Content-Range", cr);
      outHeaders.set("Accept-Ranges", "bytes");
      outHeaders.set("Cache-Control", "public, max-age=3600");
      return new Response(upstream.body, { status: upstream.status, headers: outHeaders });
    }

    const location = `${OFLIX_BASE_URL}${stream.proxyPath.replace(/^\//, "")}`;
    const headers = new Headers(corsHeaders);
    headers.set("Location", location);
    headers.set("Cache-Control", "public, max-age=3600");
    return new Response(null, { status: 302, headers });
  } catch (e) {
    console.error("fetch-stream error:", e);
    return json({ success: false, error: String((e as Error).message ?? e) }, 500);
  }
}
