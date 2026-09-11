import { Header } from "@/components/Header";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createInsForgeServerClient } from "@/lib/insforge/server";
import { getWatchlist, getContinueWatching, buildResumeHref } from "@/lib/user-data";
import { MovieCard } from "@/components/MovieCard";

export const dynamic = "force-dynamic";

export default async function WatchlistPage() {
  const sb = await createInsForgeServerClient();
  const { data: { user } } = await sb.auth.getCurrentUser();
  if (!user) redirect("/login");

  const [watchlist, continueItems] = await Promise.all([
    getWatchlist(user.id),
    getContinueWatching(user.id),
  ]);

  const continueWithContent = continueItems.filter((c) => c.content && c.content.id);

  return (
    <>
      <Header
        user={user ? { id: user.id, email: user.email ?? null, username: null } : null}
        links={[
          { href: "/", label: "Beranda", active: false },
          { href: "/film", label: "Film", active: false },
          { href: "/series", label: "Series", active: false },
          { href: "/anime", label: "Anime", active: false },
        ]}
      />
      <main className="flex-1 px-6 py-8 md:px-12">
        <h1 className="mb-6 text-2xl font-extrabold">Daftar Tonton</h1>

        {continueWithContent.length > 0 && (
          <section className="mb-10">
            <h2 className="mb-4 text-lg font-bold">Lanjutkan Menonton</h2>
            <div className="h-scroll">
              {continueWithContent.map((item) => {
                const c = item.content!;
                const href = buildResumeHref(item);
                const pct = item.duration_seconds && item.duration_seconds > 0
                  ? Math.min(100, Math.round((item.progress_seconds / item.duration_seconds) * 100))
                  : null;
                return (
                  <Link key={item.id} href={href} className="movie-card">
                    {c.poster_url ? (
                      <img src={c.poster_url} alt={c.title} loading="lazy" referrerPolicy="no-referrer" />
                    ) : (
                      <div className="card-img-fallback">
                        <i className="fa-solid fa-film text-2xl text-white/20" />
                      </div>
                    )}
                    {pct != null && (
                      <div className="absolute bottom-8 left-0 right-0 h-1 bg-white/20">
                        <div className="h-full bg-[var(--color-primary)]" style={{ width: `${pct}%` }} />
                      </div>
                    )}
                    <div className="card-label">{c.title}</div>
                  </Link>
                );
              })}
            </div>
          </section>
        )}

        {watchlist.length > 0 ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
            {watchlist.map((w) => w.content && <MovieCard key={w.id} content={w.content} />)}
          </div>
        ) : (
          <div className="py-16 text-center">
            <i className="fa-solid fa-bookmark mb-4 text-5xl text-white/20" />
            <p className="text-white/60">Belum ada judul di daftar tontonmu.</p>
            <Link
              href="/"
              className="mt-4 inline-block rounded-lg bg-[var(--color-primary)] px-6 py-2.5 text-sm font-bold text-white transition hover:bg-[var(--color-primary-hover)]"
            >
              Jelajahi Katalog
            </Link>
          </div>
        )}
      </main>
    </>
  );
}
