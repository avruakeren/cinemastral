import Link from "next/link";
import { notFound } from "next/navigation";
import { Header } from "@/components/Header";
import { MovieCard } from "@/components/MovieCard";
import { WatchlistButton } from "@/components/WatchlistButton";
import { Reveal } from "@/components/Reveal";
import { EpisodePicker } from "@/components/EpisodePicker";
import { getContentBySlug, getEpisodes, getContents } from "@/lib/data";
import { getCurrentProfile } from "@/lib/actions";
import { ensureContentSynced, fetchOflixDetail } from "@/lib/sync";
import { isInWatchlist } from "@/lib/user-data";
import { oflixDetailToEpisodes } from "@/lib/scrapers/oflix";
import { parseTmdbSlug, getTmdbDetails, tmdbToFullContent, buildTmdbEpisodes } from "@/lib/tmdb";
import type { Content, Episode } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function DetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { user } = await getCurrentProfile();
  const headerUser = user
    ? { id: user.id, email: user.email ?? null, username: user.username ?? null }
    : null;

  const tmdbMatch = parseTmdbSlug(slug);

  let content: Content | null = null;
  let episodes: Episode[] = [];
  let related: Content[] = [];
  let inList = false;

  if (tmdbMatch) {
    const d = await getTmdbDetails(tmdbMatch.mediaType, tmdbMatch.id);
    if (!d) notFound();
    content = tmdbToFullContent(d);
    related = [];
    if (content.type === "series") {
      const tmdbEps = await buildTmdbEpisodes(tmdbMatch.id, d.seasons ?? []);
      episodes = tmdbEps.map(
        (e) =>
          ({
            id: `tmdb-ep-${tmdbMatch.id}-${e.season}-${e.episode_number}`,
            content_id: content!.id,
            season: e.season,
            episode_number: e.episode_number,
            title: e.title,
            thumbnail_url: e.still_url,
            stream_data: null,
            stream_updated_at: null,
            duration: e.runtime,
            created_at: new Date().toISOString(),
          }) as Episode,
      );
    }
  } else {
    content = await getContentBySlug(slug);
    if (!content) content = await ensureContentSynced(slug);
    if (!content) notFound();
    inList = user ? await isInWatchlist(user.id, content.id) : false;

    if (content.type === "series" || content.type === "anime") {
      try {
        episodes = await getEpisodes(content.id);
      } catch {
        episodes = [];
      }
      if (episodes.length === 0) {
        const d = await fetchOflixDetail(slug);
        if (d?.seasons) episodes = oflixDetailToEpisodes(slug, d);
      }
    }

    related = content.genres?.[0]
      ? await getContents({ genreSlug: content.genres[0].slug, limit: 8, orderBy: "rating", orderDirection: "desc" })
      : [];
  }

  if (!content) notFound();

  const seasons = [...new Set(episodes.map((e) => e.season))];
  const defaultSeason = seasons[0] ?? 1;
  const firstEpisode = episodes.find((e) => e.season === defaultSeason);
  const playHref =
    content.type === "film"
      ? `/watch/${content.slug}`
      : `/watch/${content.slug}?s=${defaultSeason}&e=${firstEpisode?.episode_number ?? 1}`;

  const metaParts = [
    content.type?.toUpperCase(),
    content.release_year,
    content.duration ? `${content.duration} menit` : null,
    content.country,
    content.status,
  ].filter(Boolean);

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
      <main className="flex-1">
        <div className="relative w-full">
          {content.backdrop_url && (
            <>
              <img
                src={content.backdrop_url}
                alt=""
                className="h-[380px] w-full object-cover opacity-25"
                referrerPolicy="no-referrer"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[var(--color-background)] via-transparent to-transparent" />
            </>
          )}
        </div>

        <div className="relative -mt-40 px-6 md:px-12">
          <div className="flex flex-col gap-8 md:flex-row">
            <Reveal as="div" className="w-44 shrink-0">
              {content.poster_url ? (
                <img
                  src={content.poster_url}
                  alt={content.title}
                  className="detail-poster aspect-[2/3] w-full object-cover"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="detail-poster flex aspect-[2/3] w-full items-center justify-center bg-[var(--color-surface-2)]">
                  <i className="fa-solid fa-film text-3xl text-white/20" />
                </div>
              )}
            </Reveal>

            <Reveal delay={80} as="div" className="max-w-2xl">
              <h1 className="text-3xl font-extrabold text-white md:text-4xl">{content.title}</h1>
              {metaParts.length > 0 && (
                <p className="mt-2 text-sm font-medium text-white/60">{metaParts.join(" • ")}</p>
              )}
              {content.rating != null && (
                <div className="mt-3 flex items-center gap-2">
                  <i className="fa-solid fa-star text-yellow-400" />
                  <span className="font-bold">{content.rating}</span>
                  <span className="text-sm text-white/50">/ 10</span>
                </div>
              )}

              {content.genres && content.genres.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {content.genres.map((g) => (
                    <span key={g.id} className="genre-chip">
                      {g.name}
                    </span>
                  ))}
                </div>
              )}

              <div className="mt-6 flex items-center gap-3">
                <Link href={playHref} className="hero-play-btn">
                  <i className="fa-solid fa-play" />
                  Tonton Sekarang
                </Link>
                {!tmdbMatch && <WatchlistButton contentId={content.id} initialInList={inList} />}
              </div>

              {content.synopsis && (
                <p className="mt-6 text-sm leading-relaxed text-white/80">{content.synopsis}</p>
              )}
            </Reveal>
          </div>
        </div>

        {episodes.length > 0 && (
          <Reveal as="section" className="mt-12 px-6 md:px-12">
            <h2 className="mb-4 text-lg font-bold">Episode</h2>
            <EpisodePicker
              slug={content.slug}
              seasons={seasons}
              episodes={episodes.map((e) => ({
                season: e.season,
                episode_number: e.episode_number,
                title: e.title,
              }))}
              selectedSeason={defaultSeason}
              selectedEpisode={firstEpisode?.episode_number ?? 1}
            />
          </Reveal>
        )}

        {related.length > 0 && (
          <Reveal as="section" className="mt-12 px-6 pb-12 md:px-12">
            <h2 className="mb-4 text-lg font-bold">Serupa Lainnya</h2>
            <div className="h-scroll">
              {related
                .filter((r) => r.id !== content.id)
                .slice(0, 10)
                .map((r) => (
                  <MovieCard key={r.id} content={r} />
                ))}
            </div>
          </Reveal>
        )}
      </main>
    </>
  );
}
