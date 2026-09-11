"use client";

import Link from "next/link";
import { useRef } from "react";
import type { Content } from "@/lib/types";
import { MovieCard, MovieCardSkeleton } from "./MovieCard";
import { Reveal } from "./Reveal";

interface ContentRowProps {
  title: string;
  items: Content[];
  href?: string;
  loading?: boolean;
  show?: number;
}

export function ContentRow({ title, items, href, loading, show = 10 }: ContentRowProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const scrollBy = (dir: 1 | -1) => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * el.clientWidth * 0.8, behavior: "smooth" });
  };

  return (
    <Reveal as="section" className="h-section">
      <div className="h-section-header">
        <h2 className="h-section-title">{title}</h2>
        {href && (
          <Link href={href} className="see-more-btn">
            Lihat Semua
          </Link>
        )}
      </div>
      <div className="h-scroll-wrap">
        <button
          onClick={() => scrollBy(-1)}
          className="h-scroll-btn h-scroll-btn-left"
          aria-label="Scroll left"
        >
          <i className="fa-solid fa-chevron-left" />
        </button>
        <button
          onClick={() => scrollBy(1)}
          className="h-scroll-btn h-scroll-btn-right"
          aria-label="Scroll right"
        >
          <i className="fa-solid fa-chevron-right" />
        </button>
        <div className="h-scroll" ref={scrollRef}>
          {loading
            ? Array.from({ length: show }).map((_, i) => <MovieCardSkeleton key={i} />)
            : items.slice(0, show).map((item) => <MovieCard key={item.id} content={item} />)}
        </div>
      </div>
    </Reveal>
  );
}
