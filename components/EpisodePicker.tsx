"use client";

import { useEffect, useRef, useState, ReactNode } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";

export interface EpisodePickerItem {
  season: number;
  episode_number: number;
  title?: string | null;
}

interface DropdownProps {
  label: string;
  value: string;
  items: Array<{ key: string; label: string; hint?: string }>;
  onSelect: (key: string) => void;
}

export function Dropdown({ label, value, items, onSelect }: DropdownProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const [highlighted, setHighlighted] = useState(0);

  const currentIndex = items.findIndex((i) => i.key === value);

  const openDropdown = () => {
    setHighlighted(currentIndex >= 0 ? currentIndex : 0);
    setOpen(true);
  };

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        rootRef.current?.querySelector<HTMLButtonElement>(".ep-dropdown-trigger")?.focus();
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open) {
      if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        openDropdown();
      }
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlighted((h) => Math.min(h + 1, items.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlighted((h) => Math.max(h - 1, 0));
    } else if (e.key === "Home") {
      e.preventDefault();
      setHighlighted(0);
    } else if (e.key === "End") {
      e.preventDefault();
      setHighlighted(items.length - 1);
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      const item = items[highlighted];
      if (item) {
        onSelect(item.key);
        setOpen(false);
      }
    }
  };

  const selected = items.find((i) => i.key === value);

  return (
    <div ref={rootRef} className="ep-dropdown">
      <button
        type="button"
        className="ep-dropdown-trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={label}
        onClick={() => (open ? setOpen(false) : openDropdown())}
        onKeyDown={handleKeyDown}
      >
        <span className="ep-dropdown-value">{selected ? selected.label : label}</span>
        <i
          className={clsx(
            "fa-solid fa-chevron-down ep-dropdown-chevron",
            open && "ep-dropdown-chevron-open",
          )}
        />
      </button>

      {open && (
        <ul className="ep-dropdown-menu" role="listbox" aria-label={label}>
          {items.map((item, i) => (
            <li key={item.key}>
              <button
                type="button"
                role="option"
                aria-selected={item.key === value}
                className={clsx(
                  "ep-dropdown-item",
                  i === highlighted && "ep-dropdown-item-hl",
                  item.key === value && "ep-dropdown-item-active",
                )}
                onMouseEnter={() => setHighlighted(i)}
                onClick={() => {
                  onSelect(item.key);
                  setOpen(false);
                }}
              >
                <span className="ep-dropdown-item-label">{item.label}</span>
                {item.hint && <span className="ep-dropdown-item-hint">{item.hint}</span>}
                {item.key === value && <i className="fa-solid fa-check ep-dropdown-item-check" />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function EpisodePicker({
  slug,
  seasons,
  episodes,
  selectedSeason,
  selectedEpisode,
  onNavigate,
  trailing,
}: {
  slug: string;
  seasons: number[];
  episodes: EpisodePickerItem[];
  selectedSeason: number;
  selectedEpisode: number;
  onNavigate?: (slug: string, season: number, episode: number) => void;
  /** Rendered in the same row, after the season/episode dropdowns (e.g. server selector). */
  trailing?: ReactNode;
}) {
  const router = useRouter();

  const seasonItems = seasons.map((s) => ({ key: String(s), label: `Season ${s}` }));

  const currentSeasonEpisodes = episodes
    .filter((e) => e.season === selectedSeason)
    .sort((a, b) => a.episode_number - b.episode_number);

  const episodeItems = currentSeasonEpisodes.map((e) => ({
    key: String(e.episode_number),
    label: `E${e.episode_number}`,
    hint: e.title ?? undefined,
  }));

  const go = (season: number, episode: number) => {
    if (onNavigate) {
      onNavigate(slug, season, episode);
      return;
    }
    router.push(`/watch/${slug}?s=${season}&e=${episode}`);
  };

  return (
    <div className="ep-picker">
      <Dropdown
        label="Season"
        value={String(selectedSeason)}
        items={seasonItems}
        onSelect={(key) => go(parseInt(key, 10), 1)}
      />
      <Dropdown
        label="Episode"
        value={String(selectedEpisode)}
        items={episodeItems}
        onSelect={(key) => go(selectedSeason, parseInt(key, 10))}
      />
      {trailing}
    </div>
  );
}
