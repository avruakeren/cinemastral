import { Header } from "@/components/Header";
import { HeroBanner } from "@/components/HeroBanner";
import { ContentRow } from "@/components/ContentRow";
import { InstallPrompt } from "@/components/InstallPrompt";
import { getContents, getTrending, getUpcoming, getRecentAdded } from "@/lib/data";
import { getCurrentProfile } from "@/lib/actions";
import { getContinueWatching, buildResumeHref } from "@/lib/user-data";
import { getTmdbTrending, getTmdbPopular, tmdbToFullContent } from "@/lib/tmdb";
import type { Content } from "@/lib/types";
import Link from "next/link";

export const dynamic = "force-dynamic";

async function tmdbTrendingOrDb(fallback: () => Promise<Content[]>): Promise<Content[]> {
  try {
    const items = await getTmdbTrending(20);
    if (items.length > 0) return items.map((i) => tmdbToFullContent(i) as unknown as Content);
  } catch (e) {
    console.warn("[home] tmdb trending failed:", (e as Error).message);
  }
  return fallback();
}

async function tmdbPopularOrDb(fallback: () => Promise<Content[]>): Promise<Content[]> {
  try {
    const items = await getTmdbPopular(20);
    if (items.length > 0) return items.map((i) => tmdbToFullContent(i) as unknown as Content);
  } catch (e) {
    console.warn("[home] tmdb popular failed:", (e as Error).message);
  }
  return fallback();
}

export default async function Home() {
  const { user } = await getCurrentProfile();
  const [trending, films, series, anime, recent, kdrama, dramaChina, seriesIndo, upcoming, continueItems] = await Promise.all([
    tmdbTrendingOrDb(() => getTrending(20)),
    getContents({ type: "film", limit: 20, orderBy: "rating", orderDirection: "desc" }),
    getContents({ type: "series", limit: 20, orderBy: "rating", orderDirection: "desc" }),
    getContents({ type: "anime", limit: 20, orderBy: "rating", orderDirection: "desc" }),
    getRecentAdded(20),
    getContents({ type: "series", country: "Korea", limit: 20, orderBy: "rating", orderDirection: "desc" }),
    getContents({ type: "series", country: "China", limit: 20, orderBy: "rating", orderDirection: "desc" }),
    getContents({ type: "series", country: "Indonesia", limit: 20, orderBy: "rating", orderDirection: "desc" }),
    getUpcoming(16),
    user ? getContinueWatching(user.id, 12) : Promise.resolve([]),
  ]);

  const heroItems = trending.length >= 3 ? trending : [...films, ...series, ...anime].slice(0, 8);
  const continueWithContent = user && continueItems ? continueItems.filter((c) => c.content) : [];

  const popular = await tmdbPopularOrDb(() => Promise.resolve(series));

  const rows = [
    { title: "Sedang Trending", items: trending, href: undefined },
    { title: "Film Terbaik", items: films, href: "/film" },
    { title: "Sedang Populer", items: popular, href: undefined },
    { title: "K-Drama", items: kdrama, href: "/series" },
    { title: "Drama China", items: dramaChina, href: "/series" },
    { title: "Series Indonesia", items: seriesIndo, href: "/series" },
    { title: "Anime & Donghua", items: anime, href: "/anime" },
    { title: "Akan Tayang", items: upcoming, href: undefined },
    { title: "Terbaru Ditambahkan", items: recent, href: undefined },
  ].filter((r) => r.items.length > 0);

  return (
    <>
      <Header
        user={user}
        links={[
          { href: "/", label: "Beranda", active: true },
          { href: "/film", label: "Film", active: false },
          { href: "/series", label: "Series", active: false },
          { href: "/anime", label: "Anime", active: false },
        ]}
      />
      <main className="flex-1">
        <HeroBanner items={heroItems} />
        <div className="home-content">
          {continueWithContent.length > 0 && (
            <section className="h-section">
              <div className="h-section-header">
                <h2 className="h-section-title">Lanjutkan Menonton</h2>
              </div>
              <div className="h-scroll">
                {continueWithContent.map((item) => {
                  const c = item.content!;
                  const href = buildResumeHref(item);
                  const pct = item.duration_seconds && item.duration_seconds > 0
                    ? Math.min(100, Math.round((item.progress_seconds / item.duration_seconds) * 100))
                    : null;
                  return (
                    <Link key={item.id} href={href} className="movie-card">
                      <div className="card-img-wrap">
                        {c.poster_url ? (
                          <img
                            src={c.poster_url}
                            alt={c.title}
                            loading="lazy"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <div className="card-img-fallback">
                            <i className="fa-solid fa-film text-2xl text-white/20" />
                          </div>
                        )}
                        <div className="card-scrim" />
                        <div className="card-play" aria-hidden>
                          <i className="fa-solid fa-play" />
                        </div>
                        {pct != null && (
                          <div className="absolute bottom-8 left-0 right-0 h-1 bg-white/20">
                            <div className="h-full bg-[var(--color-primary)]" style={{ width: `${pct}%` }} />
                          </div>
                        )}
                      </div>
                      <div className="card-label">{c.title}</div>
                    </Link>
                  );
                })}
              </div>
            </section>
          )}
          {rows.map((row) => (
            <div key={row.title} className="home-section-divider">
              <ContentRow title={row.title} items={row.items} href={row.href} />
            </div>
          ))}
        </div>
      </main>
      <footer className="relative mt-12 overflow-hidden border-t border-white/5">
        <img
          src="/gojo.jpg"
          alt="Cinemastral"
          width={1920}
          height={1080}
          loading="lazy"
          className="w-full object-cover"
        />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[var(--color-background)] via-transparent to-[var(--color-background)]" />
        <div className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-[var(--color-background)] to-transparent" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-64 bg-gradient-to-t from-[var(--color-background)] via-[var(--color-background)]/80 to-transparent" />
        <div className="relative z-10 -mt-40 flex flex-col items-center gap-4 px-6 pb-12 text-center">
          <img src="/logo.png" alt="Cinemastral" width={400} height={225} className="h-8 w-auto" loading="lazy" />
          <p className="text-sm text-white/40">
            only watches what's trending, zero personality lol
          </p>
          <p className="text-xs text-white/30">
            &copy; {new Date().getFullYear()} Cinemastral. Made with hate and passion 😘
          </p>
        </div>
      </footer>
      <InstallPrompt />
    </>
  );
}
