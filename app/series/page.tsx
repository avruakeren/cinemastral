import CategoryPage from "@/app/[type]/page";

export const dynamic = "force-dynamic";

export default function SeriesPage({ searchParams }: { searchParams: Promise<{ page?: string; genre?: string; q?: string }> }) {
  return CategoryPage({ params: Promise.resolve({ type: "series" }), searchParams });
}
