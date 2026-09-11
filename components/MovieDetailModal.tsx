"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { useMovieDetailModal } from "@/lib/hooks/use-movie-detail-modal";
import { WatchlistButton } from "./WatchlistButton";
import { MovieCard } from "./MovieCard";
import { LoadingSpinner } from "./LoadingSpinner";
import { EpisodePicker } from "./EpisodePicker";
import type { Content } from "@/lib/types";

interface DetailData {
  content: Content & { genres?: Array<{ id: string; name: string; slug: string }> };
  episodes: Array<{ id: string; season: number; episode_number: number; title: string | null; thumbnail_url: string | null }>;
  related: Content[];
  inList: boolean;
  playHref: string;
  seasons: number[];
  trailerUrl?: string | null;
}

export function MovieDetailModal() {
  const { isOpen, slug, close } = useMovieDetailModal();
  const router = useRouter();
  const [data, setData] = useState<DetailData | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedSeason, setSelectedSeason] = useState(1);
  const [showTrailer, setShowTrailer] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  const lastFocusedRef = useRef<HTMLElement | null>(null);

  const navigateTo = (href: string) => {
    close();
    router.push(href);
  };

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = 0;
    }
  }, [slug]);

  const [prevSlug, setPrevSlug] = useState(slug);
  if (prevSlug !== slug) {
    setPrevSlug(slug);
    setLoading(true);
    setData(null);
    setShowTrailer(false);
  }

  useEffect(() => {
    if (!slug) return;

    fetch(`/api/detail-data/${slug}`)
      .then((res) => {
        if (!res.ok) throw new Error("Not found");
        return res.json();
      })
      .then((d) => {
        setData(d);
        setSelectedSeason(d.seasons?.[0] ?? 1);
        setLoading(false);
      })
      .catch(() => {
        setData(null);
        setLoading(false);
      });
  }, [slug]);

  useEffect(() => {
    if (isOpen) {
      lastFocusedRef.current = document.activeElement as HTMLElement | null;
      const t = setTimeout(() => closeBtnRef.current?.focus(), 30);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleTab = (e: KeyboardEvent) => {
      const container = containerRef.current;
      if (!container || e.key !== "Tab") return;
      const focusables = container.querySelectorAll<HTMLElement>(
        'button:not([disabled]), a[href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", handleTab);
    return () => document.removeEventListener("keydown", handleTab);
  }, [isOpen, data, loading]);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        close();
        lastFocusedRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [isOpen, close]);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  useEffect(() => {
    if (data?.trailerUrl && !showTrailer) {
      const timer = setTimeout(() => setShowTrailer(true), 1500);
      return () => clearTimeout(timer);
    }
  }, [data, showTrailer]);

  if (!isOpen) return null;

  const content = data?.content;

  return (
    <div className="modal-overlay" onClick={close}>
      <div
        className="modal-container"
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-label={content?.title ?? "Detail"}
        onClick={(e) => e.stopPropagation()}
      >
        <button className="modal-close" ref={closeBtnRef} onClick={close} aria-label="Close">
          <i className="fa-solid fa-xmark" />
        </button>

        {loading && (
          <div className="flex items-center justify-center py-20">
            <LoadingSpinner label="Memuat detail" />
          </div>
        )}

        {!loading && !content && (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <i className="fa-solid fa-face-frown text-4xl text-white/30" />
            <p className="text-sm text-white/50">Gagal memuat detail. Coba lagi nanti.</p>
          </div>
        )}

        {!loading && content && (
          <>
            {/* Backdrop Banner with Trailer */}
            <div className="modal-banner">
              {showTrailer && data?.trailerUrl ? (
                <video
                  className="modal-banner-img"
                  src={data.trailerUrl}
                  autoPlay
                  muted
                  loop
                  playsInline
                />
              ) : (
                content.backdrop_url && (
                  <img
                    src={content.backdrop_url}
                    alt=""
                    className="modal-banner-img"
                    referrerPolicy="no-referrer"
                  />
                )
              )}
              <div className="modal-banner-overlay" />
            </div>

            {/* Content */}
            <div className="modal-content">
              <div className="flex flex-col gap-6 md:flex-row">
                {/* Poster */}
                <div className="modal-poster-wrap">
                  {content.poster_url ? (
                    <img
                      src={content.poster_url}
                      alt={content.title}
                      className="modal-poster"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="modal-poster flex items-center justify-center bg-[var(--color-surface-2)]">
                      <i className="fa-solid fa-film text-3xl text-white/20" />
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1">
                  <h2 className="modal-title">{content.title}</h2>
                  
                  {/* Meta Info Row */}
                  <div className="flex flex-wrap items-center gap-3 mb-4">
                    {content.release_year && (
                      <span className="modal-badge">{content.release_year}</span>
                    )}
                    {content.rating != null && (
                      <div className="flex items-center gap-1.5">
                        <i className="fa-solid fa-star text-yellow-400 text-sm" />
                        <span className="font-bold text-white">{content.rating}</span>
                      </div>
                    )}
                    {content.type && (
                      <span className="modal-badge-type">{content.type.toUpperCase()}</span>
                    )}
                    {content.duration && (
                      <span className="text-sm text-white/60">{content.duration} menit</span>
                    )}
                  </div>

                  {/* Genres */}
                  {content.genres && content.genres.length > 0 && (
                    <div className="modal-genres">
                      {content.genres.map((g) => (
                        <span key={g.id} className="genre-chip">
                          {g.name}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Actions */}
                  <div className="modal-actions">
                    <button onClick={() => navigateTo(data.playHref)} className="hero-play-btn">
                      <i className="fa-solid fa-play" />
                      Tonton Sekarang
                    </button>
                    {!String(data.content?.id ?? "").startsWith("tmdb-") && (
                      <WatchlistButton contentId={data.content!.id} initialInList={data.inList} />
                    )}
                  </div>

                  {/* Synopsis */}
                  {content.synopsis && (
                    <p className="modal-synopsis">{content.synopsis}</p>
                  )}
                </div>
              </div>

              {/* Episodes */}
              {data.episodes.length > 0 && (
                <div className="modal-section">
                  <h3 className="modal-section-title">Episode</h3>
                  <EpisodePicker
                    slug={content.slug}
                    seasons={data.seasons}
                    episodes={data.episodes.map((e) => ({
                      season: e.season,
                      episode_number: e.episode_number,
                      title: e.title,
                    }))}
                    selectedSeason={selectedSeason}
                    selectedEpisode={1}
                    onNavigate={(slug, season, episode) =>
                      navigateTo(`/watch/${slug}?s=${season}&e=${episode}`)
                    }
                  />
                </div>
              )}

              {/* Related */}
              {data.related.length > 0 && (
                <div className="modal-section">
                  <h3 className="modal-section-title">Serupa Lainnya</h3>
                  <div className="h-scroll">
                    {data.related
                      .filter((r) => r.id !== content.id)
                      .slice(0, 10)
                      .map((r) => (
                        <MovieCard key={r.id} content={r} />
                      ))}
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
