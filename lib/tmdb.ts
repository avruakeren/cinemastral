/** TMDB v3 lookup: resolve a title (+ optional year) to a TMDB id. */
const TMDB_BASE = "https://api.themoviedb.org/3";
export const TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p";

export interface TmdbIdentity {
  id: number;
  media_type: "movie" | "tv";
}

export interface TmdbItem {
  id: number;
  media_type: "movie" | "tv";
  title: string;
  overview: string | null;
  poster_path: string | null;
  backdrop_path: string | null;
  logo_path: string | null;
  release_date: string | null; // release_date (movie) | first_air_date (tv)
  release_year: number | null;
  vote_average: number | null;
  genre_ids: number[];
  genres: Array<{ id: number; name: string; slug: string }>;
}

export interface TmdbSeasonEpisode {
  season: number;
  episode_number: number;
  title: string | null;
  overview: string | null;
  still_path: string | null;
  still_url: string | null;
  air_date: string | null;
  runtime: number | null;
}

export interface TmdbDetails extends TmdbItem {
  runtime: number | null;
  number_of_seasons: number;
  status: string | null;
  seasons: Array<{ season_number: number; episode_count: number }>;
}

const key = process.env.TMDB_API_KEY;

function tmdbUrl(path: string, search?: Record<string, string>): string {
  // Build URL keeping the /3 base (an absolute `path` must not drop it).
  const u = new URL(path.replace(/^\/+/, ""), TMDB_BASE + "/");
  if (key) u.searchParams.set("api_key", key);
  u.searchParams.set("language", "en-US");
  if (search) for (const [k, v] of Object.entries(search)) u.searchParams.set(k, v);
  return u.toString();
}

function posterUrl(path: string | null): string | null {
  return path ? `${TMDB_IMAGE_BASE}/w500${path}` : null;
}

function backdropUrl(path: string | null): string | null {
  return path ? `${TMDB_IMAGE_BASE}/w1280${path}` : null;
}

function yearFromDate(date: string | null): number | null {
  if (!date) return null;
  const y = parseInt(date.slice(0, 4), 10);
  return Number.isNaN(y) ? null : y;
}

function normalize(item: Record<string, unknown>, mediaType: "movie" | "tv"): TmdbItem {
  const title = (item.title || item.name || "") as string;
  const releaseDate =
    (mediaType === "movie"
      ? (item.release_date as string | undefined)
      : (item.first_air_date as string | undefined)) ?? null;
  const genreIds = (item.genre_ids as number[] | undefined) ?? (item.genre_ids ? [item.genre_ids as number] : []);
  const genres = (genreIds as number[]).map((id) => ({ id, name: "", slug: "" }));
  const logoPath = item.logo_path as string | null;
  return {
    id: item.id as number,
    media_type: mediaType,
    title,
    overview: (item.overview as string | null) ?? null,
    poster_path: (item.poster_path as string | null) ?? null,
    backdrop_path: (item.backdrop_path as string | null) ?? null,
    logo_path: logoPath,
    release_date: releaseDate,
    release_year: yearFromDate(releaseDate),
    vote_average: (item.vote_average as number | null | undefined) ?? null,
    genre_ids: genreIds,
    genres,
  };
}

function mergeByRank(movies: TmdbItem[], tvs: TmdbItem[], limit: number): TmdbItem[] {
  const out: TmdbItem[] = [];
  const n = Math.max(movies.length, tvs.length);
  for (let i = 0; i < n && out.length < limit; i++) {
    if (movies[i]) out.push(movies[i]);
    if (tvs[i] && out.length < limit) out.push(tvs[i]);
  }
  return out;
}

/** Fetch TMDB trending (movie+tv, week) as Content-compatible items. Returns [] if no key. */
export async function getTmdbTrending(limit = 20): Promise<TmdbItem[]> {
  if (!key) {
    console.warn("[tmdb] no TMDB_API_KEY set; skipping trending");
    return [];
  }
  const [movies, tvs] = await Promise.all([
    fetch(tmdbUrl("/trending/movie/week"), { next: { revalidate: 60 * 60 * 24 } })
      .then((r) => (r.ok ? (r.json() as Promise<{ results?: unknown[] }>) : { results: [] }))
      .then((d) => (d.results ?? []).map((x) => normalize(x as Record<string, unknown>, "movie"))),
    fetch(tmdbUrl("/trending/tv/week"), { next: { revalidate: 60 * 60 * 24 } })
      .then((r) => (r.ok ? (r.json() as Promise<{ results?: unknown[] }>) : { results: [] }))
      .then((d) => (d.results ?? []).map((x) => normalize(x as Record<string, unknown>, "tv"))),
  ]);
  return mergeByRank(movies, tvs, limit).slice(0, limit);
}

/** Fetch TMDB popular (movie+tv) as Content-compatible items. Returns [] if no key. */
export async function getTmdbPopular(limit = 20): Promise<TmdbItem[]> {
  if (!key) {
    console.warn("[tmdb] no TMDB_API_KEY set; skipping popular");
    return [];
  }
  const [movies, tvs] = await Promise.all([
    fetch(tmdbUrl("/movie/popular"), { next: { revalidate: 60 * 60 * 24 } })
      .then((r) => (r.ok ? (r.json() as Promise<{ results?: unknown[] }>) : { results: [] }))
      .then((d) => (d.results ?? []).map((x) => normalize(x as Record<string, unknown>, "movie"))),
    fetch(tmdbUrl("/tv/popular"), { next: { revalidate: 60 * 60 * 24 } })
      .then((r) => (r.ok ? (r.json() as Promise<{ results?: unknown[] }>) : { results: [] }))
      .then((d) => (d.results ?? []).map((x) => normalize(x as Record<string, unknown>, "tv"))),
  ]);
  return mergeByRank(movies, tvs, limit).slice(0, limit);
}

/** Search TMDB (movie + tv) for `query` as normalized items. Returns [] if no key. */
export async function searchTmdbResults(
  query: string,
  opts?: { includeAdult?: boolean; limit?: number },
): Promise<TmdbItem[]> {
  if (!key) {
    console.warn("[tmdb] no TMDB_API_KEY set; skipping search");
    return [];
  }
  const q = query.trim();
  if (!q) return [];
  const limit = opts?.limit ?? 12;
  const includeAdult = opts?.includeAdult ?? false;

  const [movies, tvs] = await Promise.all([
    fetch(
      tmdbUrl("/search/movie", {
        query: q,
        page: "1",
        include_adult: String(includeAdult),
      }),
      { next: { revalidate: 60 * 60 * 24 } },
    )
      .then((r) => (r.ok ? (r.json() as Promise<{ results?: unknown[] }>) : { results: [] }))
      .then((d) => (d.results ?? []).map((x) => normalize(x as Record<string, unknown>, "movie"))),
    fetch(
      tmdbUrl("/search/tv", {
        query: q,
        page: "1",
        include_adult: String(includeAdult),
      }),
      { next: { revalidate: 60 * 60 * 24 } },
    )
      .then((r) => (r.ok ? (r.json() as Promise<{ results?: unknown[] }>) : { results: [] }))
      .then((d) => (d.results ?? []).map((x) => normalize(x as Record<string, unknown>, "tv"))),
  ]);

  return mergeByRank(movies, tvs, limit).slice(0, limit);
}

/** Fetch full TMDB details (incl. genres, runtime, seasons). */
export async function getTmdbDetails(
  mediaType: "movie" | "tv",
  id: number,
): Promise<TmdbDetails | null> {
  if (!key) return null;
  try {
    const res = await fetch(
      tmdbUrl(`/${mediaType === "movie" ? `movie/${id}` : `tv/${id}`}`, {
        append_to_response: "credits",
      }),
      { next: { revalidate: 60 * 60 * 24 } },
    );
    if (!res.ok) return null;
    const d = await res.json();
    const base = normalize(d, mediaType);
    return {
      ...base,
      genres: (d.genres as Array<{ id: number; name: string }> | undefined ?? []).map((g) => ({
        id: g.id,
        name: g.name,
        slug: g.name.toLowerCase().replace(/\s+/g, "-"),
      })),
      runtime: (d.runtime as number | null | undefined) ?? null,
      number_of_seasons: (d.number_of_seasons as number | undefined) ?? (mediaType === "tv" ? 1 : 0),
      status: (d.status as string | null | undefined) ?? null,
      seasons:
        mediaType === "tv"
          ? ((d.seasons as Array<{ season_number: number; episode_count: number }> | undefined) ?? []).map((s) => ({
              season_number: s.season_number,
              episode_count: s.episode_count,
            }))
          : [],
    };
  } catch (e) {
    console.error("[tmdb] details error", e);
    return null;
  }
}

/** Fetch a TV season's episodes from TMDB. */
export async function getTmdbSeasonEpisodes(
  id: number,
  season: number,
): Promise<TmdbSeasonEpisode[]> {
  if (!key) return [];
  try {
    const res = await fetch(tmdbUrl(`/tv/${id}/season/${season}`), {
      next: { revalidate: 60 * 60 * 24 },
    });
    if (!res.ok) return [];
    const d = await res.json();
    const episodes = (d.episodes ?? []) as Array<{
      episode_number: number;
      name?: string;
      overview?: string;
      still_path?: string | null;
      air_date?: string | null;
      runtime?: number | null;
    }>;
    return episodes.map((e) => ({
      season,
      episode_number: e.episode_number,
      title: e.name ?? null,
      overview: e.overview ?? null,
      still_path: e.still_path ?? null,
      still_url: e.still_path ? `${TMDB_IMAGE_BASE}/w300${e.still_path}` : null,
      air_date: e.air_date ?? null,
      runtime: (e.runtime as number | null | undefined) ?? null,
    }));
  } catch (e) {
    console.error("[tmdb] season error", e);
    return [];
  }
}

/** Build a fake `Episode[]`-compatible record list from a TMDB tv series detail. */
export async function buildTmdbEpisodes(
  id: number,
  seasons: Array<{ season_number: number }>,
): Promise<TmdbSeasonEpisode[]> {
  const eps: TmdbSeasonEpisode[] = [];
  for (const s of seasons.filter((s) => s.season_number > 0)) {
    const se = await getTmdbSeasonEpisodes(id, s.season_number);
    eps.push(...se);
  }
  return eps.sort((a, b) => a.season - b.season || a.episode_number - b.episode_number);
}

export function tmdbSlug(mediaType: "movie" | "tv", id: number): string {
  return `tmdb-${mediaType}-${id}`;
}

export function parseTmdbSlug(slug: string): { mediaType: "movie" | "tv"; id: number } | null {
  const m = /^tmdb-(movie|tv)-(\d+)$/.exec(slug);
  if (!m) return null;
  return { mediaType: m[1] as "movie" | "tv", id: parseInt(m[2], 10) };
}

export interface TmdbSlugContent {
  id: string;
  slug: string;
  mediaType: "movie" | "tv";
  tmdbId: number;
}

/** Convert a TMDB item into a Content-shaped object usable by MovieCard/HeroBanner. */
export function tmdbToContent(item: TmdbItem | TmdbDetails): TmdbSlugContent & {
  title: string;
  poster_url: string | null;
  backdrop_url: string | null;
  logo_url: string | null;
  release_year: number | null;
  rating: number | null;
  type: "film" | "series";
  synopsis: string | null;
  release_date: string | null;
  genres: Array<{ id: number; name: string; slug: string }>;
} {
  const mt = item.media_type;
  const slug = tmdbSlug(mt, item.id);
  const type: "film" | "series" = mt === "movie" ? "film" : "series";
  const logoPath = item.logo_path
    ? `${TMDB_IMAGE_BASE}/original${item.logo_path}`
    : null;
  return {
    id: slug,
    slug,
    mediaType: mt,
    tmdbId: item.id,
    title: item.title,
    poster_url: posterUrl(item.poster_path),
    backdrop_url: backdropUrl(item.backdrop_path),
    logo_url: logoPath,
    release_year: item.release_year,
    rating: item.vote_average,
    type,
    synopsis: item.overview,
    release_date: item.release_date,
    genres: item.genres,
  };
}

/**
 * Convert a TMDB item into a full Content object compatible with the rest of the app.
 * Used by the watch page & detail endpoints for TMDB-backed slugs.
 */
export function tmdbToFullContent(
  item: TmdbItem | TmdbDetails,
  slug?: string,
): import("@/lib/types").Content & { _tmdbId?: number; _mediaType?: "movie" | "tv" } {
  const base = tmdbToContent(item);
  const s = slug ?? base.slug;
  return {
    id: s,
    slug: s,
    title: base.title,
    alt_title: null,
    synopsis: base.synopsis,
    type: base.type,
    poster_url: base.poster_url,
    backdrop_url: base.backdrop_url,
    logo_url: base.logo_url,
    release_year: base.release_year,
    rating: base.rating,
    duration: (item as TmdbDetails).runtime ?? null,
    status: (item as TmdbDetails).status ?? null,
    country: null,
    source_id: null,
    source_key: null,
    source_url: null,
    stream_data: null,
    stream_updated_at: null,
    featured: false,
    trending: false,
    release_date: base.release_date,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    genres: base.genres,
    _tmdbId: base.tmdbId,
    _mediaType: base.mediaType,
  } as import("@/lib/types").Content;
}

/**
 * Search TMDB for `title`. Prefers an exact case-insensitive title match so we don't
 * accidentally resolve to the wrong movie when the query is ambiguous (e.g. "Shazam!" vs "Shazam").
 */
export async function searchTMDB(
  title: string,
  year?: number | null,
  type?: string,
): Promise<TmdbIdentity | null> {
  if (!key) {
    console.warn("[tmdb] no TMDB_API_KEY set; skipping TMDB lookup");
    return null;
  }
  if (!title) return null;

  const mediaType = type === "film" ? "movie" : "tv";
  const endpoint =
    mediaType === "movie"
      ? `${TMDB_BASE}/search/movie?api_key=${encodeURIComponent(key)}&include_adult=false&language=en-US`
      : `${TMDB_BASE}/search/tv?api_key=${encodeURIComponent(key)}&language=en-US`;

  const params = new URLSearchParams({ query: title.trim(), page: "1" });
  if (year) params.set(mediaType === "movie" ? "primary_release_year" : "first_air_date_year", String(year));

  try {
    const res = await fetch(`${endpoint}&${params.toString()}`, {
      next: { revalidate: 60 * 60 * 24 }, // cache 24h
    });
    if (!res.ok) {
      console.error("[tmdb] search error", res.status);
      return null;
    }
    const data = (await res.json()) as { results?: Array<{ id: number; title?: string; name?: string; media_type?: string }> };
    const results = data.results?.filter(Boolean) ?? [];
    if (results.length === 0) return null;

    const normalized = title.trim().toLowerCase();
    const exact = results.find(
      (r) => (r.title || r.name || "").trim().toLowerCase() === normalized,
    );
    const r = exact ?? results[0];
    return { id: r.id, media_type: mediaType };
  } catch (e) {
    console.error("[tmdb] search throw", e);
    return null;
  }
}
