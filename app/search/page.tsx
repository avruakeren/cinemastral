import { Header } from "@/components/Header";
import { SearchForm } from "./SearchForm";
import { SearchResults } from "./SearchResults";
import { AdultModeToggle } from "@/components/AdultModeToggle";
import { createInsForgeServerClient } from "@/lib/insforge/server";

export const dynamic = "force-dynamic";

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const query = (q ?? "").trim();

  const sb = await createInsForgeServerClient();
  const { data: { user } } = await sb.auth.getCurrentUser();
  const headerUser = user ? { id: user.id, email: user.email ?? null, username: null } : null;

  return (
    <>
      <Header
        user={headerUser}
        links={[
          { href: "/", label: "Beranda", active: false },
          { href: "/film", label: "Film", active: false },
          { href: "/series", label: "Series", active: false },
          { href: "/anime", label: "Anime", active: false },
        ]}
      />
      <main className="flex-1 px-4 py-6 sm:px-6 md:px-12 md:py-8">
        <div className="search-page-header">
          <h1 className="search-page-title">
            <i className="fa-solid fa-magnifying-glass" />
            Pencarian
          </h1>
          <p className="search-page-subtitle">
            ketik aja judulnya, walaupun gua tau selera lu ampas
          </p>
        </div>
        <SearchForm initialQuery={query} />
        <div className="search-adult-row">
          <AdultModeToggle />
        </div>

        {query ? (
          <SearchResults query={query} />
        ) : (
          <div className="search-empty-state">
            <i className="fa-solid fa-clapperboard" />
            <p>lu ketik itu judulnya diatas, search bar sengaja dibuat untuk dipake bukan cuma pajangan</p>
          </div>
        )}
      </main>
    </>
  );
}
