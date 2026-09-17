"use client";

import { useRouter } from "next/navigation";
import { useState, useEffect, useRef } from "react";

const PLACEHOLDERS = [
  "Cari film favoritmu…",
  "Mau nonton series apa?",
  "Cari anime yang lagi trending…",
  "Ketik judulnya disini…",
  "Nonton apa malem ini?",
];

export function SearchForm({ initialQuery }: { initialQuery: string }) {
  const router = useRouter();
  const [q, setQ] = useState(initialQuery);
  const [placeholderIdx, setPlaceholderIdx] = useState(0);
  const [placeholderText, setPlaceholderText] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

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

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setQ(e.target.value);
    setIsTyping(e.target.value.length > 0);
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const query = q.trim();
    router.push(query ? `/search?q=${encodeURIComponent(query)}` : "/search");
  }

  return (
    <div className="w-full max-w-xl">
      <form onSubmit={onSubmit} className="search-form">
        <i className="fa-solid fa-magnifying-glass search-form-icon" />
        <input
          ref={inputRef}
          name="q"
          value={q}
          onChange={handleChange}
          placeholder={q ? "" : placeholderText}
          className="search-form-input"
          autoComplete="off"
        />
        {q && (
          <button
            type="button"
            onClick={() => {
              setQ("");
              setIsTyping(false);
              inputRef.current?.focus();
            }}
            className="search-form-clear"
            aria-label="Hapus"
          >
            <i className="fa-solid fa-xmark" />
          </button>
        )}
      </form>
    </div>
  );
}
