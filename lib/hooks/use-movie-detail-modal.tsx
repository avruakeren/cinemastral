"use client";

import { createContext, useContext, useState, ReactNode } from "react";

interface MovieDetailModalContextType {
  isOpen: boolean;
  slug: string | null;
  open: (slug: string) => void;
  close: () => void;
}

const MovieDetailModalContext = createContext<MovieDetailModalContextType | undefined>(undefined);

export function MovieDetailModalProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [slug, setSlug] = useState<string | null>(null);

  const open = (movieSlug: string) => {
    setSlug(movieSlug);
    setIsOpen(true);
  };

  const close = () => {
    setIsOpen(false);
    setTimeout(() => setSlug(null), 300); // delay clearing slug for exit animation
  };

  return (
    <MovieDetailModalContext.Provider value={{ isOpen, slug, open, close }}>
      {children}
    </MovieDetailModalContext.Provider>
  );
}

export function useMovieDetailModal() {
  const context = useContext(MovieDetailModalContext);
  if (!context) {
    throw new Error("useMovieDetailModal must be used within MovieDetailModalProvider");
  }
  return context;
}
