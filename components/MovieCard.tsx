"use client";

import { useMovieDetailModal } from "@/lib/hooks/use-movie-detail-modal";
import { formatReleaseDate } from "@/lib/date-utils";
import type { Content } from "@/lib/types";

export function MovieCard({ content }: { content: Content }) {
  const year = content.release_year;
  const rating = content.rating;
  const rilis = formatReleaseDate(content.release_date);
  const { open } = useMovieDetailModal();

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      open(content.slug);
    }
  };

  const badge = rilis ? rilis : year ? `${year}` : rating ? `${rating}` : null;
  const badgeClass = rilis ? "top" : year ? "top" : rating ? "new" : "";

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
      </div>
      {badge ? (
        <span className={`card-badge ${badgeClass}`}>{badge}</span>
      ) : null}
      <div className="card-label">{content.title}</div>
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
