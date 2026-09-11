"use client";

import { useMovieDetailModal } from "@/lib/hooks/use-movie-detail-modal";
import type { Content } from "@/lib/types";

export function MovieCard({ content }: { content: Content }) {
  const year = content.release_year;
  const rating = content.rating;
  const { open } = useMovieDetailModal();

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      open(content.slug);
    }
  };

  return (
    <div
      className="movie-card"
      role="button"
      tabIndex={0}
      aria-label={`Lihat detail ${content.title}`}
      onClick={() => open(content.slug)}
      onKeyDown={handleKeyDown}
    >
      <div className="card-img-wrap">
        {content.poster_url ? (
          <img
            src={content.poster_url}
            alt={content.title}
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
        <div className="card-bottom-info">
          <div className="card-title">{content.title}</div>
          {(year || rating != null) && (
            <div className="card-meta">
              {year && <span>{year}</span>}
              {year && rating != null && <span className="card-meta-dot">★</span>}
              {rating != null && <span>★ {Number(rating).toFixed(1)}</span>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function MovieCardSkeleton() {
  return (
    <div className="movie-card pointer-events-none">
      <div className="card-img-wrap">
        <div className="skeleton-shimmer aspect-[2/3] rounded-none" />
      </div>
      <div className="card-label">
        <div className="skeleton-shimmer h-3 w-4/5" />
      </div>
    </div>
  );
}
