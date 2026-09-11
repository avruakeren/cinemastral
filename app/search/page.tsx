import { Header } from "@/components/Header";
import { SearchForm } from "./SearchForm";
import { SearchResults } from "./SearchResults";
import { ShaderBackground } from "@/components/ui/adisyon-shader";
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
    <div className="relative min-h-screen">
      <div className="pointer-events-none absolute inset-0 z-0">
        <ShaderBackground className="h-full w-full" />
      </div>
      <Header
        user={headerUser}
        links={[
          { href: "/", label: "Home", active: false },
          { href: "/film", label: "Movies", active: false },
          { href: "/series", label: "Shows", active: false },
          { href: "/watchlist", label: "My List", active: false },
        ]}
      />
      <main className="relative z-10 flex flex-col items-center px-4 pt-28 pb-24 sm:px-6 md:px-12">
        <p className="mb-6 text-center text-sm text-white/50">
          ketik aja judulnya, walaupun gua tau selera lu ampas
        </p>
        <SearchForm initialQuery={query} />

        {query ? (
          <SearchResults query={query} />
        ) : (
          <div className="mt-12 flex flex-col items-center gap-4 text-center">
            <i className="fa-solid fa-clapperboard text-5xl text-white/10" />
            <p className="max-w-sm text-sm text-white/30">
              lu ketik itu judulnya diatas, search bar sengaja dibuat untuk dipake bukan cuma pajangan
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
