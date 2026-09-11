import Link from "next/link";
import { notFound } from "next/navigation";
import { Header } from "@/components/Header";
import { MovieCard } from "@/components/MovieCard";
import { getContents } from "@/lib/data";
import { createInsForgeServerClient } from "@/lib/insforge/server";
import type { Content } from "@/lib/types";

export const dynamic = "force-dynamic";

interface CategoryPageProps {
  params: Promise<{ type: string }>;
  searchParams: Promise<{ page?: string }>;
}

const VALID_TYPES = ["film", "series", "anime"] as const;
const TITLES: Record<string, string> = {
  film: "Film",
  series: "Series",
  anime: "Anime & Donghua",
};

export default async function CategoryPage({ params, searchParams }: CategoryPageProps) {
  const [{ type }, sp] = await Promise.all([params, searchParams]);

  if (!VALID_TYPES.includes(type as (typeof VALID_TYPES)[number])) {
    notFound();
  }

  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);
  const limit = 24;
  const offset = (page - 1) * limit;

  const isAnime = type === "anime";
  const contentType: Content["type"] = isAnime ? "anime" : (type as Content["type"]);

  const items = await getContents({
    type: contentType,
    limit,
    offset,
    orderBy: "created_at",
    orderDirection: "desc",
  });

  const title = TITLES[type];

  const sb = await createInsForgeServerClient();
  const { data: { user } } = await sb.auth.getCurrentUser();
  const headerUser = user ? { id: user.id, email: user.email ?? null, username: null } : null;

  return (
    <>
      <Header
        user={headerUser}
        links={[
          { href: "/", label: "Beranda", active: false },
          { href: "/film", label: "Film", active: type === "film" },
          { href: "/series", label: "Series", active: type === "series" },
          { href: "/anime", label: "Anime", active: isAnime },
        ]}
      />
      <main className="flex-1 px-6 py-8 md:px-12">
        <h1 className="mb-6 text-2xl font-extrabold">{title}</h1>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {items.map((item) => (
            <MovieCard key={item.id} content={item} />
          ))}
        </div>
        {items.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20">
            <i className="fa-solid fa-film mb-4 text-4xl text-white/20" />
            <p className="text-white/50">Belum ada konten pada kategori ini.</p>
          </div>
        )}

        <div className="mt-8 flex items-center justify-center gap-4">
          {page > 1 && (
            <Link
              href={`/${type}?page=${page - 1}`}
              className="rounded-md bg-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/20"
            >
              Sebelumnya
            </Link>
          )}
          <span className="text-sm text-white/50">Halaman {page}</span>
          {items.length >= limit && (
            <Link
              href={`/${type}?page=${page + 1}`}
              className="rounded-md bg-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/20"
            >
              Berikutnya
            </Link>
          )}
        </div>
      </main>
    </>
  );
}
