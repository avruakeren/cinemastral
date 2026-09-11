import { notFound } from "next/navigation";
import { Header } from "@/components/Header";
import { WatchArea } from "./WatchArea";
import { getContentBySlug, getEpisodes } from "@/lib/data";
import { getCurrentProfile } from "@/lib/actions";
import { oflixDetailToEpisodes } from "@/lib/scrapers/oflix";
import { ensureContentSynced, fetchOflixDetail } from "@/lib/sync";
import { resolveVidcoreSource } from "@/lib/providers/vidcore";
import { resolveVidcoreByTmdbId } from "@/lib/providers/vidcore";
import { resolveMovieboxSource } from "@/lib/providers/moviebox";
import type { ResolvedSource } from "@/lib/providers/types";
import type { Episode } from "@/lib/types";
import {
  parseTmdbSlug,
  getTmdbDetails,
  tmdbToFullContent,
  buildTmdbEpisodes,
} from "@/lib/tmdb";

export const dynamic = "force-dynamic";

export default async function WatchPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ s?: string; e?: string; t?: string }>;
}) {
   const [{ slug }, sp] = await Promise.all([params, searchParams]);

  const { user } = await getCurrentProfile();
  const headerUser = user
    ? { id: user.id, email: user.email ?? null, username: user.username ?? null }
    : null;

  const tmdbSlugMatch = parseTmdbSlug(slug);
  const isTmdb = !!tmdbSlugMatch;

   const content = isTmdb
     ? await (async () => {
         if (!tmdbSlugMatch) return null;
         const d = await getTmdbDetails(tmdbSlugMatch.mediaType, tmdbSlugMatch.id);
         return d ? (tmdbToFullContent(d, undefined) as Awaited<ReturnType<typeof getContentBySlug>> | null) : null;
       })()
     : (await getContentBySlug(slug) ?? (await ensureContentSynced(slug)));
   if (!content) notFound();

  const isFilm = content.type === "film";
  const season = isFilm ? undefined : parseInt(sp.s ?? "1", 10) || 1;
  const episodeNo = isFilm ? undefined : parseInt(sp.e ?? "1", 10) || 1;
  const startTime = sp.t ? parseInt(sp.t, 10) || undefined : undefined;

  let episodes: Episode[] = [];
  let currentEpisode: Episode | null = null;

  if (!isFilm) {
    if (isTmdb && tmdbSlugMatch) {
      const d = await getTmdbDetails(tmdbSlugMatch.mediaType, tmdbSlugMatch.id);
      if (d) {
        const tmdbEps = await buildTmdbEpisodes(tmdbSlugMatch.id, d.seasons ?? []);
        episodes = tmdbEps.map((e) => ({
          id: `tmdb-ep-${tmdbSlugMatch.id}-${e.season}-${e.episode_number}`,
          content_id: content.id,
          season: e.season,
          episode_number: e.episode_number,
          title: e.title,
          thumbnail_url: e.still_url,
          stream_data: null,
          stream_updated_at: null,
          duration: e.runtime,
          created_at: new Date().toISOString(),
        }));
      }
    } else {
      try {
        episodes = await getEpisodes(content.id);
      } catch {
        episodes = [];
      }
      if (episodes.length === 0) {
        const d = await fetchOflixDetail(slug);
        if (d?.seasons) {
          episodes = oflixDetailToEpisodes(slug, d);
        }
      }
    }

    currentEpisode = episodes.find((e) => e.season === season && e.episode_number === episodeNo) ?? null;
  }

  const sources: ResolvedSource[] = [];
  try {
    if (isTmdb && tmdbSlugMatch) {
      const vc = resolveVidcoreByTmdbId(
        tmdbSlugMatch.id,
        tmdbSlugMatch.mediaType,
        content,
        isFilm ? undefined : String(season),
        isFilm ? undefined : String(episodeNo),
      );
      sources.push(vc);
    } else {
      const [moviebox, vidcore] = await Promise.all([
        resolveMovieboxSource(
          content,
          isFilm ? undefined : String(season),
          isFilm ? undefined : String(episodeNo),
        ),
        resolveVidcoreSource(
          content,
          isFilm ? undefined : String(season),
          isFilm ? undefined : String(episodeNo),
        ),
      ]);
      if (moviebox) sources.push(moviebox);
      if (vidcore) sources.push(vidcore);
    }
  } catch (e) {
    console.error("[watch:resolveSources]", slug, season, episodeNo, e);
  }

  const episodePicker =
    !isFilm && episodes.length > 0
      ? {
          slug: content.slug,
          seasons: [...new Set(episodes.map((e) => e.season))].sort((a, b) => a - b),
          episodes: episodes.map((e) => ({
            season: e.season,
            episode_number: e.episode_number,
            title: e.title,
          })),
          selectedSeason: season!,
          selectedEpisode: episodeNo!,
        }
      : null;

  return (
    <>
      <Header
        user={headerUser}
        links={[
          { href: "/", label: "Beranda", active: false },
          { href: "/film", label: "Film", active: content.type === "film" },
          { href: "/series", label: "Series", active: content.type === "series" },
          { href: "/anime", label: "Anime", active: content.type === "anime" },
        ]}
      />
      <main className="flex-1 px-6 pt-24 pb-6 md:px-12 md:pt-28">
        <h1 className="mb-4 text-xl font-bold">
          {content.title}
          {currentEpisode ? ` — Episode ${currentEpisode.episode_number}` : ""}
        </h1>
        <WatchArea
          sources={sources}
          preferredSource="moviebox"
          title={content.title}
          poster={content.backdrop_url ?? content.poster_url}
          contentId={content.id}
          episodeId={currentEpisode?.id ?? null}
          startTime={startTime}
          isFilm={isFilm}
          episodePicker={episodePicker}
        />
      </main>
    </>
  );
}
