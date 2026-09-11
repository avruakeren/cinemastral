import { NextRequest } from "next/server";
import { getEpisodes, getContents } from "@/lib/data";
import { createInsForgeServerClient } from "@/lib/insforge/server";
import { ensureContentSynced, fetchOflixDetail } from "@/lib/sync";
import { isInWatchlist } from "@/lib/user-data";
import { parseTmdbSlug, getTmdbDetails, tmdbToFullContent, buildTmdbEpisodes } from "@/lib/tmdb";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
   const { slug } = await params;

   // TMDB-backed titles (not in the DB catalog).
   const tmdbMatch = parseTmdbSlug(slug);
   if (tmdbMatch) {
     const d = await getTmdbDetails(tmdbMatch.mediaType, tmdbMatch.id);
     if (!d) return Response.json({ error: "Content not found" }, { status: 404 });
      const content = tmdbToFullContent(d);

       const sb = await createInsForgeServerClient();
      const { data: { user } } = await sb.auth.getCurrentUser();

      let episodes: Array<{ season: number; episode_number: number; title: string | null }> = [];
      const seasons: number[] = [];
      if (content.type === "series") {
        const season = parseInt(request.nextUrl.searchParams.get("s") ?? "1", 10) || 1;
        const episodeNo = parseInt(request.nextUrl.searchParams.get("e") ?? "1", 10) || 1;
        const tmdbEps = await buildTmdbEpisodes(tmdbMatch.id, d.seasons ?? []);
        for (const e of tmdbEps) {
          if (!seasons.includes(e.season)) seasons.push(e.season);
        }
        episodes = tmdbEps
          .filter((e) => e.season === season)
          .map((e) => ({ season: e.season, episode_number: e.episode_number, title: e.title ?? null }));
        void episodeNo;
      }
      const playHref =
        content.type === "film"
          ? `/watch/${content.slug}`
          : `/watch/${content.slug}?s=${seasons[0] ?? 1}&e=1`;
      return Response.json({
        content,
        episodes,
        related: [],
        inList: false,
        playHref,
        seasons,
        trailerUrl: null,
      });
    }

   // Ensure the content exists locally with a real UUID id (auto-registers
   // missing content from Oflix so bookmark/progress inserts don't fail on a
   // non-UUID source_key).
   const content = await ensureContentSynced(slug);

  if (!content) {
    return Response.json({ error: "Content not found" }, { status: 404 });
  }

  const sb = await createInsForgeServerClient();
  const { data: { user } } = await sb.auth.getCurrentUser();
  const inList = user ? await isInWatchlist(user.id, content.id) : false;

  const episodes = content.type === "series" || content.type === "anime" ? await getEpisodes(content.id) : [];
  const related = content.genres?.[0]
    ? await getContents({ genreSlug: content.genres[0].slug, limit: 8, orderBy: "rating", orderDirection: "desc" })
    : [];

  const seasons = [...new Set(episodes.map((e) => e.season))];
  const defaultSeason = seasons[0] ?? 1;
  const firstEpisode = episodes.find((e) => e.season === defaultSeason);
  const playHref =
    content.type === "film"
      ? `/watch/${content.slug}`
      : `/watch/${content.slug}?s=${defaultSeason}&e=${firstEpisode?.episode_number ?? 1}`;

  // Get trailerUrl from stream_data, fallback to Oflixt
  let trailerUrl: string | null = (content.stream_data as { trailerUrl?: string } | null)?.trailerUrl ?? null;
  if (!trailerUrl && content.source_id) {
    try {
      const d = await fetchOflixDetail(content.source_id ?? slug);
      if (d?.trailerUrl) {
        trailerUrl = d.trailerUrl;
      }
    } catch {
      // ignore
    }
  }

  return Response.json({
    content,
    episodes,
    related,
    inList,
    playHref,
    seasons,
    trailerUrl,
  });
}
