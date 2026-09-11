import { Header } from "@/components/Header";
import { MovieCard } from "@/components/MovieCard";
import { getContents } from "@/lib/data";
import { getCurrentProfile } from "@/lib/actions";
import { createInsForgeServerClient } from "@/lib/insforge/server";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function GenrePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const sb = await createInsForgeServerClient();
  const { data: genre } = await sb.database
    .from("genres")
    .select("id, name, slug")
    .eq("slug", slug)
    .maybeSingle();

  if (!genre) notFound();

  const items = await getContents({ genreSlug: slug, limit: 48, orderBy: "rating", orderDirection: "desc" });

  const { user } = await getCurrentProfile();
  const headerUser = user
    ? { id: user.id, email: user.email ?? null, username: user.username ?? null }
    : null;

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
      <main className="flex-1 px-6 py-8 md:px-12">
        <h1 className="mb-6 text-2xl font-extrabold">{genre.name}</h1>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {items.map((item) => (
            <MovieCard key={item.id} content={item} />
          ))}
        </div>
        {items.length === 0 && (
          <div className="py-20 text-center text-white/50">Belum ada konten untuk genre ini.</div>
        )}
      </main>
    </>
  );
}
