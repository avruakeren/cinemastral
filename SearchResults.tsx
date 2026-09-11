"use client";

import { useEffect, useState } from "react";
import { MovieCard } from "@/components/MovieCard";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import type { Content } from "@/lib/types";

interface SearchResultItem {
  id: string;
  slug: string;
  title: string;
  type: string;
  posterUrl: string | null;
  releaseYear: number | null;
  releaseDate: string | null;
  rating: number | null;
  sourceId: string | null;
}

interface SearchResponse {
  results: SearchResultItem[];
}

export function SearchResults({ query }: { query: string }) {
  const [data, setData] = useState<SearchResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [prevQuery, setPrevQuery] = useState(query);

  if (prevQuery !== query) {
    setPrevQuery(query);
    setLoading(true);
    setError(false);
    setData(null);
  }

  useEffect(() => {
    if (!query.trim()) return;

    const controller = new AbortController();

    fetch(
      `/api/search-oflix?q=${encodeURIComponent(query)}`,
      { signal: controller.signal },
    )
      .then((res) => {
        if (!res.ok) throw new Error("Search failed");
        return res.json();
      })
      .then((d) => {
        setData(d);
        setLoading(false);
      })
      .catch((e) => {
        if (e?.name === "AbortError") return;
        setError(true);
        setLoading(false);
      });

    return () => controller.abort();
  }, [query]);

  if (loading) {
    return (
      <LoadingSpinner label={`Mencari "${query}"…`} />
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center gap-4 py-16 text-center">
        <i className="fa-solid fa-triangle-exclamation text-5xl text-white/15" />
        <div>
          <p className="text-lg font-bold text-white/70">Pencarian gagal</p>
          <p className="text-sm text-white/40">
            Terjadi kesalahan saat mencari &quot;{query}&quot;. Coba lagi nanti.
          </p>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const total = data.results.length;

  if (total === 0) {
    return (
      <div className="flex flex-col items-center gap-4 py-16 text-center">
        <i className="fa-solid fa-magnifying-glass-minus text-5xl text-white/15" />
        <div>
          <p className="text-lg font-bold text-white/70">Tidak ada hasil</p>
          <p className="text-sm text-white/40">
            Coba kata kunci lain atau periksa ejaan untuk &quot;{query}&quot;
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="search-results-header">
        <span className="search-results-count">
          <strong>{total}</strong> hasil untuk &quot;{query}&quot;
        </span>
      </div>

      <div className="search-results-grid">
        {data.results.map((item) => (
          <MovieCard
            key={item.id}
            content={{
              id: item.id,
              slug: item.slug,
              title: item.title,
              type: item.type as Content["type"],
              poster_url: item.posterUrl,
              backdrop_url: null,
              release_year: item.releaseYear,
              release_date: item.releaseDate,
              rating: item.rating,
              duration: null,
              status: null,
              country: null,
              synopsis: null,
              alt_title: null,
              source_id: item.sourceId,
              source_key: null,
              source_url: null,
              stream_data: null,
              stream_updated_at: null,
              featured: false,
              trending: false,
              genres: [],
              created_at: "",
              updated_at: "",
            }}
          />
        ))}
      </div>
    </>
  );
}
