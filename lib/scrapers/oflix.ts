export const OFLIX_BASE_URL = "https://oflix.web.id/";

export const OFLIX_ACTIONS = {
  category: "60f406169c602e85ed9c1be184f932649ea75cc171",
  detail: "40c185519a0758814a96c7068ee7461412a8b994a6",
  search: "6094817552ca8bd8cd6c1fbd4d17ce250188487a08",
  play: "7848fa0daf1d1acb7a2efb7ac963e06f0cd618810d",
} as const;

export type OflixContentType = "film" | "series" | "anime" | "donghua";

/** Parse Oflix's free-form release string into a YYYY-MM-DD (or null). */
export function parseReleaseDate(value: string | undefined | null): string | null {
  if (!value) return null;
  const s = String(value).trim();
  if (!s) return null;
  const d =
    !Number.isNaN(Date.parse(s)) && s.length >= 4
      ? new Date(s)
      : null;
  if (d && !Number.isNaN(d.getTime())) {
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, "0");
    const day = String(d.getUTCDate()).padStart(2, "0");
    if (y >= 1900) return `${y}-${m}-${day}`;
  }
  const m = s.match(/^(\d{4})/);
  if (m && Number(m[1]) >= 1900) return `${m[1]}-01-01`;
  return null;
}

export interface OflixCatalogItem {
  title?: string;
  name?: string;
  poster?: string;
  thumbnail?: string;
  image?: string;
  detailPath?: string;
  slug?: string;
  badge?: string;
  rawReleaseDate?: string;
  year?: string;
  rating?: string | number;
  genre?: string[];
  type?: string;
  country?: string;
  duration?: string | number;
  subjectId?: string;
}

export interface OflixEpisode {
  episode?: number;
  title?: string;
  playerUrl?: string;
  url?: string;
  thumbnail?: string;
  duration?: string | number;
}

export interface OflixSeason {
  season?: number;
  episodes?: OflixEpisode[];
}

export interface OflixCast {
  name?: string;
  character?: string;
  avatar?: string;
}

export interface OflixDetail {
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
  cast?: OflixCast[];
  trailerUrl?: string;
  playerUrl?: string;
  sources?: Array<{ url?: string; type?: string }>;
  seasons?: OflixSeason[];
  subjectId?: string;
  captions?: unknown[];
}

export interface OflixPlayDownload {
  url?: string;
  resolution?: number;
  label?: string;
}

export interface OflixPlayResult {
  success: boolean;
  url?: string;
  downloads?: OflixPlayDownload[];
  captions?: Array<{ url?: string; languageCode?: string; lan?: string; language?: string }>;
  watermark?: { image?: string; text?: string };
  source?: string;
  error?: string;
  _debug?: unknown;
}

export interface OflixDecodedToken {
  u?: string;
  r?: string;
}

/** POST a server-action to Oflix and extract the data line (flight format "1:{...}"). */
export async function oflixFetch<T>(action: string, args: unknown[]): Promise<T> {
  const res = await fetch(OFLIX_BASE_URL, {
    method: "POST",
    headers: {
      "Next-Action": action,
      "Content-Type": "text/plain;charset=UTF-8",
    },
    body: JSON.stringify(args),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Oflix HTTP ${res.status}`);
  const text = await res.text();
  const dataLine = text.split("\n").find((l) => l.startsWith("1:"));
  if (!dataLine) throw new Error("Oflix flight response missing data line");
  return JSON.parse(dataLine.slice(2)) as T;
}

/** Normalize an Oflix catalog item into a usable content item. */
export function normalizeCatalogItem(item: OflixCatalogItem, categorySection?: string): {
  title: string;
  slug: string;
  type: OflixContentType;
  posterUrl: string | null;
  releaseYear: number | null;
  releaseDate: string | null;
  rating: number | null;
  country: string | null;
  duration: number | null;
  sourceId: string | null;
  sourceKey: string | null;
  genres: string[];
} {
  const title = item.title || item.name || item.slug || "Untitled";
  const detailPath = item.detailPath || item.slug || "";
  const slug = detailPath || title.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const rawType = item.type || "";
  let type: OflixContentType = "film";
  if (categorySection === "anichin" || rawType === "anime" || rawType === "donghua") {
    type = rawType === "donghua" ? "donghua" : "anime";
  } else if (rawType === "series") {
    type = "series";
  } else {
    type = "film";
  }
  const year = parseInt(String(item.year ?? ""), 10);
  const rating = parseFloat(String(item.rating ?? ""));
  const duration = parseInt(String(item.duration ?? ""), 10);
  return {
    title,
    slug,
    type,
    posterUrl: item.poster || item.thumbnail || item.image || null,
    releaseYear: Number.isNaN(year) ? null : year,
    releaseDate: parseReleaseDate(item.rawReleaseDate),
    rating: Number.isNaN(rating) ? null : rating,
    country: item.country || null,
    duration: Number.isNaN(duration) ? null : duration,
    sourceId: detailPath || null,
    sourceKey: item.subjectId || null,
    genres: Array.isArray(item.genre) ? item.genre : [],
  };
}

/** Decode a `/video/<token>` stream token into {u: real CDN url, r: referer}. */
export function decodeStreamToken(token: string): OflixDecodedToken {
  try {
    const json = atob(token);
    return JSON.parse(json) as OflixDecodedToken;
  } catch {
    return {};
  }
}

/** Convert an OflixDetail response into a Content object. */
export function oflixDetailToContent(slug: string, d: OflixDetail): import("@/lib/types").Content {
  const year = parseInt(String(d.year ?? ""), 10);
  const rating = parseFloat(String(d.rating ?? ""));
  const duration = parseInt(String(d.duration ?? ""), 10);
  const contentType =
    d.type === "series" || d.type === "anime" || d.type === "donghua"
      ? (d.type as import("@/lib/types").Content["type"])
      : "film";
  return {
    id: d.id ?? slug,
    slug,
    title: d.title ?? "Untitled",
    alt_title: null,
    synopsis: d.description ?? null,
    type: contentType,
    poster_url: d.poster ?? null,
    backdrop_url: d.banner ?? null,
    release_year: Number.isNaN(year) ? null : year,
    rating: Number.isNaN(rating) ? null : rating,
    duration: Number.isNaN(duration) ? null : duration,
    status: null,
    country: d.country ?? null,
    source_id: slug,
    source_key: d.subjectId ?? null,
    source_url: null,
    stream_data: null,
    stream_updated_at: null,
    release_date: parseReleaseDate(d.rawReleaseDate),
    featured: false,
    trending: false,
    genres: (Array.isArray(d.genre) ? d.genre : []).map((name, i) => ({
      id: i,
      name,
      slug: name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
    })),
    created_at: "",
    updated_at: "",
  };
}

/** Extract episodes from an OflixDetail response. */
export function oflixDetailToEpisodes(slug: string, d: OflixDetail): import("@/lib/types").Episode[] {
  if (!d.seasons) return [];
  return d.seasons.flatMap((s) => {
    const seasonNo = Number(s.season ?? 1) || 1;
    return (s.episodes ?? []).map((ep, idx) => ({
      id: `${slug}-s${seasonNo}e${ep.episode ?? idx + 1}`,
      content_id: slug,
      season: seasonNo,
      episode_number: Number(ep.episode) || idx + 1,
      title: ep.title ?? null,
      thumbnail_url: ep.thumbnail ?? null,
      duration: ep.duration ? (parseInt(String(ep.duration), 10) || null) : null,
      stream_data: null,
      stream_updated_at: null,
      created_at: "",
    }));
  });
}