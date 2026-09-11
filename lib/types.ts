export type ContentType = "film" | "series" | "anime" | "donghua";

export type ContentBadge = "BARU" | "TOP" | null;

export interface Content {
  id: string;
  slug: string;
  title: string;
  alt_title: string | null;
  synopsis: string | null;
  type: ContentType;
  poster_url: string | null;
  backdrop_url: string | null;
  logo_url?: string | null;
  release_year: number | null;
  rating: number | null;
  duration: number | null;
  status: string | null;
  country: string | null;
  source_id: string | null;
  source_key: string | null;
  source_url: string | null;
  stream_data: StreamData | null;
  stream_updated_at: string | null;
  featured: boolean;
  trending: boolean;
  release_date?: string | null;
  created_at: string;
  updated_at: string;
  genres?: Genre[];
}

export interface StreamData {
  streamUrl?: string;
  trailerUrl?: string;
  sources?: StreamSource[];
  subtitles?: Subtitle[];
  qualities?: string[];
  raw?: unknown;
}

export interface StreamSource {
  url: string;
  quality?: string;
  type?: "hls" | "mp4" | "embed";
  label?: string;
}

export interface Subtitle {
  url: string;
  label: string;
  language?: string;
  default?: boolean;
}

export interface Genre {
  id: number;
  name: string;
  slug: string;
}

export interface Episode {
  id: string;
  content_id: string;
  season: number;
  episode_number: number;
  title: string | null;
  thumbnail_url: string | null;
  stream_data: StreamData | null;
  stream_updated_at: string | null;
  duration: number | null;
  created_at: string;
}

export interface Profile {
  id: string;
  username: string | null;
  avatar_url: string | null;
  created_at: string;
}

export type WatchlistStatus = "planned" | "watching" | "completed" | "dropped";

export interface Watchlist {
  id: string;
  user_id: string;
  content_id: string;
  status: WatchlistStatus;
  created_at: string;
  content?: Content;
}

export interface WatchProgress {
  id: string;
  user_id: string;
  content_id: string;
  episode_id: string | null;
  progress_seconds: number;
  duration_seconds: number | null;
  completed: boolean;
  updated_at: string;
  content?: Content;
  episode?: Episode;
}

export interface ContentListItem {
  title?: string;
  name?: string;
  poster?: string;
  thumbnail?: string;
  image?: string;
  detailPath?: string;
  slug?: string;
  badge?: ContentBadge;
  rawReleaseDate?: string;
  type?: ContentType;
}

export const CONTENT_CATEGORIES = [
  { action: "recently-add", title: "Recently Added", section: "film" },
  { action: "trending", title: "Trending", section: "film" },
  { action: "upcoming", title: "Upcoming Calendar", section: "film" },
  { action: "indo-dub", title: "Dubbing Indonesia", section: "film" },
  { action: "indonesian-movies", title: "Film Indonesia", section: "film" },
  { action: "indonesian-drama", title: "Series Indonesia", section: "series" },
  { action: "kdrama", title: "Korean Drama", section: "series" },
  { action: "drama-comedy", title: "Drama Komedi", section: "series" },
  { action: "anime", title: "Anime", section: "anichin" },
  { action: "animation", title: "Animasi Seru", section: "series" },
  { action: "western-tv", title: "Series Barat", section: "series" },
  { action: "titan", title: "Titan", section: "series" },
  { action: "cyberpunk", title: "Cyberpunk", section: "series" },
  { action: "short-tv", title: "Drama Pendek", section: "series" },
  { action: "horror", title: "Film Horror", section: "film" },
  { action: "thailand-drama", title: "Drama Thailand", section: "series" },
  { action: "film", title: "Top Movies", section: "film" },
] as const;

export type ContentCategoryAction = (typeof CONTENT_CATEGORIES)[number]["action"];
