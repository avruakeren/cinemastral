import { createAdminClient } from "npm:@insforge/sdk";

const OFLIX_BASE_URL = "https://oflix.web.id/";
const ACTIONS = {
  detail: "40c185519a0758814a96c7068ee7461412a8b994a6",
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

const STALE_MS = 12 * 60 * 60 * 1000; // 12 hours
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

interface OflixDetail {
  id?: string;
  title?: string;
  poster?: string;
  banner?: string;
  rating?: string | number;
  year?: string;
  rawReleaseDate?: string;
  duration?: string | number;
  type?: string;
  description?: string;
  genre?: string[];
  country?: string;
  quality?: string;
  cast?: Array<{ name?: string; character?: string; avatar?: string }>;
  trailerUrl?: string;
  playerUrl?: string;
  sources?: Array<{ url?: string; type?: string }>;
  seasons?: Array<{ season?: number; episodes?: Array<{ episode?: number; title?: string; thumbnail?: string; duration?: string | number }> }>;
  subjectId?: string;
}

/** Stored as content.stream_data._detail so it never collides with stream caches (keys "film" / "s<S>:e<E>"). */
interface DetailMeta {
  description?: string;
  quality?: string;
  cast?: Array<{ name?: string; character?: string; avatar?: string }>;
  trailerUrl?: string;
  playerUrl?: string;
  sources?: Array<{ url?: string; type?: string }>;
  rawReleaseDate?: string;
  fetchedAt?: string;
}

function isFresh(ts: string | null | undefined): boolean {
  if (!ts) return false;
  return Date.now() - new Date(ts).getTime() < STALE_MS;
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
  if (!detailPath) {
    return json({ success: false, error: "Missing detailPath query param" }, 400);
  }

  const admin = createAdminClient({ baseUrl, apiKey });

  const { data: content, error: contentError } = await admin.database
    .from("content")
    .select("id, slug, source_id, source_key, stream_data, stream_updated_at, updated_at")
    .eq("source_id", detailPath)
    .maybeSingle();
  if (contentError || !content) {
    return json({ success: false, error: contentError?.message ?? "Content not found" }, 404);
  }

  try {
    const map = (content.stream_data as Record<string, unknown>) ?? {};
    const cachedMeta = (map._detail ?? null) as DetailMeta | null;
    if (cachedMeta?.fetchedAt && isFresh(cachedMeta.fetchedAt)) {
      return json({ success: true, cached: true, detail: cachedMeta });
    }

    const res = await oflixFetch<{ success: boolean; data?: OflixDetail }>(ACTIONS.detail, [detailPath]);
    if (!res.success || !res.data) {
      throw new Error("Oflix detail failed");
    }
    const d = res.data;

    const meta: DetailMeta = {
      description: d.description || null,
      quality: d.quality || null,
      cast: Array.isArray(d.cast) ? d.cast : [],
      trailerUrl: d.trailerUrl || null,
      playerUrl: d.playerUrl || null,
      sources: Array.isArray(d.sources) ? d.sources : [],
      rawReleaseDate: d.rawReleaseDate || null,
      fetchedAt: new Date().toISOString(),
    };

    map._detail = meta;

    const year = parseInt(String(d.year ?? ""), 10);
    const rating = parseFloat(String(d.rating ?? ""));
    const duration = parseInt(String(d.duration ?? ""), 10);
    const contentPatch: Record<string, unknown> = {
      stream_data: map,
      stream_updated_at: meta.fetchedAt,
    };
    if (d.banner) contentPatch.backdrop_url = d.banner;
    if (d.description) contentPatch.synopsis = d.description;
    if (!Number.isNaN(year)) contentPatch.release_year = year;
    if (!Number.isNaN(rating)) contentPatch.rating = rating;
    if (!Number.isNaN(duration)) contentPatch.duration = duration;
    if (d.country) contentPatch.country = d.country;
    if (d.subjectId) contentPatch.source_key = d.subjectId;

    const { error: updateError } = await admin.database
      .from("content")
      .update(contentPatch)
      .eq("id", content.id);
    if (updateError) {
      console.error("update content detail:", updateError);
    }

    // ---- populate episodes for series ----
    let episodesUpserted = 0;
    const seasons = Array.isArray(d.seasons) ? d.seasons : [];
    if (seasons.length > 0) {
      const rows: Array<Record<string, unknown>> = [];
      for (const s of seasons) {
        const seasonNo = Number(s.season ?? 1) || 1;
        for (const ep of s.episodes ?? []) {
          const epNo = Number(ep.episode) || rows.filter((r) => r.season === seasonNo).length + 1;
          rows.push({
            content_id: content.id,
            season: seasonNo,
            episode_number: epNo,
            title: ep.title || null,
            thumbnail_url: ep.thumbnail || null,
            duration: ep.duration ? (parseInt(String(ep.duration), 10) || null) : null,
          });
        }
      }
      if (rows.length > 0) {
        const { error: epError } = await admin.database
          .from("episodes")
          .upsert(rows, { onConflict: "content_id,season,episode_number" });
        if (epError) {
          console.error("upsert episodes:", epError);
        } else {
          episodesUpserted = rows.length;
        }
      }
    }

    return json({
      success: true,
      cached: false,
      detail: meta,
      sourceKey: d.subjectId || null,
      episodesUpserted,
    });
  } catch (e) {
    console.error("fetch-detail error:", e);
    return json({ success: false, error: String((e as Error).message ?? e) }, 500);
  }
}
