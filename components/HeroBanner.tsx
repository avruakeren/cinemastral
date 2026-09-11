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

  useEffect(() => {
    if (current) {
      const imgUrl = current.backdrop_url ?? current.poster_url ?? "";
      document.documentElement.style.setProperty("--hero-bg-url", `url(${imgUrl})`);
    }
  }, [current]);

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

  const meta = [current.rating ? `${Number(current.rating).toFixed(1)}/10` : null, current.release_year, current.type?.toUpperCase()]
    .filter(Boolean)
    .join(" • ");

  const genres = Array.isArray(current.genres)
    ? (current.genres as { name?: string[] | string }[])
        .map((g) => (Array.isArray(g.name) ? g.name[0] : g.name))
        .filter(Boolean)
        .slice(0, 3)
    : [];

  const logoUrl = current.logo_url
    ? `${current.logo_url}`
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
      </div>
      <div className="hero-overlay" />
      <div className="hero-content" key={`content-${index}`}>
        <h1 className="hero-title">{current.title}</h1>
        <div className="hero-meta">
          {current.rating ? (
            <span className="hero-rating">
              <i className="fa-solid fa-star" />
              {Number(current.rating).toFixed(1)}/10
            </span>
          ) : null}
          {current.release_year && <span>{current.release_year}</span>}
          {genres.length > 0 && <span>{genres[0]}</span>}
        </div>
        {current.synopsis && (
          <p className="hero-overview">{current.synopsis}</p>
        )}
        <div className="hero-actions">
          <Link href={`/watch/${current.slug}`} className="hero-play-btn">
            <i className="fa-solid fa-play" />
            Play
          </Link>
          <Link href={`/detail/${current.slug}`} className="hero-action-circle">
            <i className="fa-solid fa-plus" />
          </Link>
          <Link href={`/detail/${current.slug}`} className="hero-action-circle">
            <i className="fa-solid fa-circle-info" />
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