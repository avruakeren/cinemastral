"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { Content } from "@/lib/types";

const INTERVAL = 7000;

export function HeroBanner({ items }: { items: Content[] }) {
  const featured = items.filter((i) => i.backdrop_url || i.poster_url || i.logo_url).slice(0, 8);
  const [index, setIndex] = useState(0);
  const [prev, setPrev] = useState<number | null>(null);
  const [tick, setTick] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const current = featured[index] ?? featured[0];
  const outgoing = prev !== null ? featured[prev] ?? featured[0] : null;
  const indexRef = useRef(index);

  useEffect(() => {
    indexRef.current = index;
  }, [index]);

  function goTo(i: number) {
    if (!featured.length) return;
    setPrev(index);
    setTick((t) => t + 1);
    setIndex(i);
  }

  function goNext() {
    if (!featured.length) return;
    goTo((index + 1) % featured.length);
  }

  function goPrev() {
    if (!featured.length) return;
    goTo((index - 1 + featured.length) % featured.length);
  }

  useEffect(() => {
    if (featured.length <= 1) return;
    timerRef.current = setInterval(() => {
      setTick((t) => t + 1);
      const cur = indexRef.current;
      setPrev(cur);
      setIndex((cur + 1) % featured.length);
    }, INTERVAL);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [featured.length]);

  if (!current) return null;

  const meta = [current.type?.toUpperCase(), current.release_year, current.country]
    .filter(Boolean)
    .join(" • ");

  // Build logo URL from TMDB logo_path (similar to how poster/backdrop URLs are built)
  const logoUrl = current.logo_url
    ? `${current.logo_url}` // already full URL from tmdbToContent
    : null;

  return (
    <div className="hero-banner">
      <div className="hero-media">
        {outgoing && outgoing.id !== current.id && (outgoing.backdrop_url || outgoing.poster_url) && (
          <img
            key={`out-${outgoing.id}-${tick}`}
            src={outgoing.backdrop_url ?? outgoing.poster_url!}
            alt=""
            aria-hidden
            referrerPolicy="no-referrer"
            className="hero-img hero-img-exit"
            loading="eager"
          />
        )}
        {(current.backdrop_url || current.poster_url) && (
          <img
            key={`in-${current.id}-${tick}`}
            src={current.backdrop_url ?? current.poster_url!}
            alt={current.title}
            referrerPolicy="no-referrer"
            className="hero-img kenburns hero-img-enter"
            fetchPriority="high"
          />
        )}
        {logoUrl && (
          <img
            key="logo"
            src={logoUrl}
            alt={current.title}
            referrerPolicy="no-referrer"
            className="hero-logo"
            loading="lazy"
          />
        )}
        {!logoUrl && (
          <h1 className="hero-title">{current.title}</h1>
        )}
      </div>
      <div className="hero-overlay" />
      <div className="hero-content" key={`content-${index}`}>
        {current.type && <span className="hero-kicker">{current.type}</span>}
        <div className="hero-meta">
          {current.rating ? (
            <span className="hero-rating">
              <i className="fa-solid fa-star" />
              {Number(current.rating).toFixed(1)}
            </span>
          ) : null}
          <span>{meta}</span>
        </div>
        {Array.isArray(current.genres) && current.genres.length > 0 && (
          <div className="hero-genres mb-4">
            {(current.genres as { name?: string[] | string }[])
              .map((g) => (Array.isArray(g.name) ? g.name[0] : g.name))
              .filter(Boolean)
              .slice(0, 3)
              .map((name) => (
                <span key={name}>{name}</span>
              ))}
          </div>
        )}
        <div className="flex items-center gap-3">
          <Link href={`/watch/${current.slug}`} className="hero-play-btn">
            <i className="fa-solid fa-play" />
            Tonton Sekarang
          </Link>
          <Link
            href={`/detail/${current.slug}`}
            className="inline-flex items-center gap-2 rounded-lg bg-white/10 px-5 py-2.5 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/20"
          >
            <i className="fa-solid fa-circle-info" />
            Detail
          </Link>
        </div>
      </div>
      {featured.length > 1 && (
        <>
          {/* Navigation Arrows */}
          <button
            onClick={goPrev}
            className="hero-nav-arrow hero-nav-prev"
            aria-label="Previous slide"
          >
            <i className="fa-solid fa-chevron-left" />
          </button>
          <button
            onClick={goNext}
            className="hero-nav-arrow hero-nav-next"
            aria-label="Next slide"
          >
            <i className="fa-solid fa-chevron-right" />
          </button>

          {/* Progress bars */}
          <div className="hero-progress">
            {featured.map((_, i) => (
              <button
                key={i}
                className="hero-progress-bar"
                aria-label={`Go to slide ${i + 1}`}
                onClick={() => goTo(i)}
              >
                <span
                  key={`${i}-${tick}`}
                  className="hero-progress-fill"
                  style={{
                    animation:
                      i === index ? `heroProgress ${INTERVAL}ms linear forwards` : "none",
                  }}
                />
              </button>
            ))}
          </div>

          {/* Dots */}
          <div className="hero-dots" aria-label="Featured carousel">
            {featured.map((_, i) => (
              <button
                key={i}
                aria-label={`Slide ${i + 1}`}
                aria-current={i === index}
                onClick={() => goTo(i)}
                className={`hero-dot ${i === index ? "active" : ""}`}
                style={{ width: i === index ? 24 : 8 }}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}