import { createInsForgeServerClient } from "@/lib/insforge/server";
import type { Content, Watchlist, WatchProgress } from "@/lib/types";

const CONTENT_EMBED =
  "content!inner(id, slug, title, type, poster_url, backdrop_url, release_year, rating, created_at)";

export interface WatchlistItem extends Omit<Watchlist, "content"> {
  content?: Content | null;
}

export interface ContinueItem extends Omit<WatchProgress, "content" | "episode"> {
  content?: Content | null;
  episode?: { season: number; episode_number: number } | null;
}

function mapEmbedContent(raw: unknown): Content | null {
  const c = raw as Partial<Content> | null;
  if (!c?.id) return null;
  return c as Content;
}

function buildResumeHref(item: ContinueItem): string {
  const c = item.content;
  if (!c) return "#";
  const t = item.progress_seconds ? `&t=${item.progress_seconds}` : "";
  if (c.type === "film" || !item.episode_id) {
    return `/watch/${c.slug}${t ? `?${t.slice(1)}` : ""}`;
  }
  const season = item.episode?.season ?? 1;
  const ep = item.episode?.episode_number ?? 1;
  return `/watch/${c.slug}?s=${season}&e=${ep}${t}`;
}

export { buildResumeHref };

export async function getWatchlist(userId: string, limit = 24): Promise<WatchlistItem[]> {
  const sb = (await createInsForgeServerClient()).database;
  const { data, error } = await sb
    .from("watchlist")
    .select(`*, ${CONTENT_EMBED}`)
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .range(0, limit - 1);
  if (error) throw new Error(error.message);
  return (data ?? []).map((w: Record<string, unknown>) => {
    const { content, ...rest } = w;
    return { ...rest, content: mapEmbedContent(content) } as WatchlistItem;
  });
}

export async function isInWatchlist(userId: string, contentId: string): Promise<boolean> {
  const sb = (await createInsForgeServerClient()).database;
  const { data } = await sb
    .from("watchlist")
    .select("id")
    .eq("user_id", userId)
    .eq("content_id", contentId)
    .maybeSingle();
  return !!data;
}

export async function getContinueWatching(userId: string, limit = 12): Promise<ContinueItem[]> {
  const sb = (await createInsForgeServerClient()).database;
  const { data, error } = await sb
    .from("watch_progress")
    .select(`*, ${CONTENT_EMBED}, episode:episodes!left(season, episode_number)`)
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .range(0, limit - 1);
  if (error) throw new Error(error.message);
  return (data ?? []).map((w: Record<string, unknown>) => {
    const { content, episode, ...rest } = w;
    return { ...rest, content: mapEmbedContent(content), episode: episode as ContinueItem["episode"] } as ContinueItem;
  });
}
