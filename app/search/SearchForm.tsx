"use client";

import { useRouter } from "next/navigation";
import { useState, useEffect, useRef, useCallback } from "react";

const PLACEHOLDERS = [
  "Cari film favoritmu…",
  "Mau nonton series apa?",
  "Cari anime yang lagi trending…",
  "Ketik judulnya disini…",
  "Nonton apa malem ini?",
];

interface Suggestion {
  id: string;
  slug: string;
  title: string;
  type: string;
  posterUrl: string | null;
  year: number | null;
}

export function SearchForm({ initialQuery }: { initialQuery: string }) {
  const router = useRouter();
  const [q, setQ] = useState(initialQuery);
  const [placeholderIdx, setPlaceholderIdx] = useState(0);
  const [placeholderText, setPlaceholderText] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (window.innerWidth >= 768) {
      inputRef.current?.focus();
    }
  }, []);

  // Animated placeholder typing effect
  useEffect(() => {
    if (q || isTyping) return;

    const target = PLACEHOLDERS[placeholderIdx];
    let charIdx = 0;
    let timeout: ReturnType<typeof setTimeout>;

    const typeChar = () => {
      if (charIdx <= target.length) {
        setPlaceholderText(target.slice(0, charIdx));
        charIdx++;
        timeout = setTimeout(typeChar, 60 + Math.random() * 40);
      } else {
        timeout = setTimeout(() => {
          let delIdx = target.length;
          const deleteChar = () => {
            if (delIdx >= 0) {
              setPlaceholderText(target.slice(0, delIdx));
              delIdx--;
              timeout = setTimeout(deleteChar, 30);
            } else {
              setPlaceholderIdx((i) => (i + 1) % PLACEHOLDERS.length);
            }
          };
          deleteChar();
        }, 2000);
      }
    };

    timeout = setTimeout(typeChar, 300);
    return () => clearTimeout(timeout);
  }, [placeholderIdx, q, isTyping]);

  // Debounced suggestions fetch
  const fetchSuggestions = useCallback((query: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (abortRef.current) abortRef.current.abort();

    if (!query.trim()) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    debounceRef.current = setTimeout(() => {
      const controller = new AbortController();
      abortRef.current = controller;

      fetch(`/api/search-oflix?q=${encodeURIComponent(query)}`, {
        signal: controller.signal,
      })
        .then((res) => res.json())
        .then((data) => {
          const items = (data.results ?? []).slice(0, 5).map((r: Record<string, unknown>) => ({
            id: r.id as string,
            slug: r.slug as string,
            title: r.title as string,
            type: r.type as string,
            posterUrl: r.posterUrl as string | null,
            year: r.releaseYear as number | null,
          }));
          setSuggestions(items);
          setShowSuggestions(items.length > 0);
          setActiveIdx(-1);
        })
        .catch(() => {});
    }, 300);
  }, []);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    setQ(val);
    setIsTyping(val.length > 0);
    fetchSuggestions(val);
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const query = q.trim();
    setShowSuggestions(false);
    router.push(query ? `/search?q=${encodeURIComponent(query)}` : "/search");
  }

  function selectSuggestion(s: Suggestion) {
    setShowSuggestions(false);
    router.push(`/detail/${s.slug}`);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!showSuggestions || suggestions.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => (i + 1) % suggestions.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => (i <= 0 ? suggestions.length - 1 : i - 1));
    } else if (e.key === "Escape") {
      setShowSuggestions(false);
    } else if (e.key === "Enter" && activeIdx >= 0) {
      e.preventDefault();
      selectSuggestion(suggestions[activeIdx]);
    }
  }

  // Close suggestions on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (formRef.current && !formRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div className="search-hero search-hero-enter">
      <form ref={formRef} onSubmit={onSubmit} className="search-form" onKeyDown={handleKeyDown}>
        <i className="fa-solid fa-magnifying-glass search-form-icon" />
        <input
          ref={inputRef}
          name="q"
          value={q}
          onChange={handleChange}
          onFocus={() => { if (suggestions.length > 0) setShowSuggestions(true); }}
          placeholder={q ? "" : placeholderText}
          className="search-form-input text-center"
          autoComplete="off"
          role="combobox"
          aria-expanded={showSuggestions}
          aria-haspopup="listbox"
        />
        {q && (
          <button
            type="button"
            onClick={() => {
              setQ("");
              setIsTyping(false);
              setSuggestions([]);
              setShowSuggestions(false);
              inputRef.current?.focus();
            }}
            className="search-form-clear"
            aria-label="Hapus"
          >
            <i className="fa-solid fa-xmark" />
          </button>
        )}
        <button type="submit" className="search-form-btn" aria-label="Cari">
          <i className="fa-solid fa-arrow-right" />
        </button>
      </form>

      {showSuggestions && suggestions.length > 0 && (
        <div className="search-suggestions" role="listbox">
          {suggestions.map((s, i) => (
            <button
              key={s.id}
              type="button"
              className={`search-suggestion-item${i === activeIdx ? " active" : ""}`}
              onClick={() => selectSuggestion(s)}
              role="option"
              aria-selected={i === activeIdx}
            >
              {s.posterUrl ? (
                <img src={s.posterUrl} alt="" className="search-suggestion-poster" loading="lazy" />
              ) : (
                <div className="search-suggestion-poster search-suggestion-poster-fallback">
                  <i className="fa-solid fa-film" />
                </div>
              )}
              <div className="search-suggestion-info">
                <span className="search-suggestion-title">{s.title}</span>
                <span className="search-suggestion-meta">
                  {s.type === "film" ? "Film" : s.type === "series" ? "Series" : "Anime"}
                  {s.year ? ` · ${s.year}` : ""}
                </span>
              </div>
              <i className="fa-solid fa-arrow-up-left search-suggestion-arrow" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
