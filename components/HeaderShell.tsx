"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

export function HeaderShell({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const lastScroll = useRef(0);
  const [hidden, setHidden] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const onScroll = () => {
      const y = window.scrollY;
      if (y > lastScroll.current + 6 && y > 60) {
        setHidden(true);
      } else if (y < lastScroll.current - 6) {
        setHidden(false);
      }
      lastScroll.current = y;

      if (y > 8) {
        el.classList.add("is-scrolled");
        setScrolled(true);
      } else {
        el.classList.remove("is-scrolled");
        setScrolled(false);
      }
    };

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      ref={ref}
      className={`app-header${hidden ? " is-hidden" : ""}${scrolled ? " is-scrolled" : ""}`}
    >
      <div className="header-inner">{children}</div>
    </header>
  );
}
