import CategoryPage from "@/app/[type]/page";

export const dynamic = "force-dynamic";

export default function FilmPage({ searchParams }: { searchParams: Promise<{ page?: string; genre?: string; q?: string }> }) {
  return CategoryPage({ params: Promise.resolve({ type: "film" }), searchParams });
}
