"use client";

import { useState, ReactNode } from "react";
import { VideoPlayer } from "./VideoPlayer";
import { Dropdown, EpisodePicker, type EpisodePickerItem } from "@/components/EpisodePicker";
import type { ResolvedSource } from "@/lib/providers/types";

const SERVER_LABELS = ["Server Utama", "Server Alternatif"];

function ServerSelector({
  sources,
  activeId,
  onSourceChange,
}: {
  sources: ResolvedSource[];
  activeId: string | undefined;
  onSourceChange: (id: string) => void;
}) {
  if (sources.length <= 1) return null;

  const items = sources.map((s, i) => ({
    key: s.id,
    label: SERVER_LABELS[i] ?? `Server ${i + 1}`,
  }));
  const value = activeId ?? sources[0]?.id ?? "";

  return (
    <Dropdown label="Server" value={value} items={items} onSelect={onSourceChange} />
  );
}

interface WatchAreaProps {
  sources: ResolvedSource[];
  preferredSource?: string;
  title: string;
  poster?: string | null;
  contentId?: string;
  episodeId?: string | null;
  startTime?: number;
  isFilm: boolean;
  episodePicker: {
    slug: string;
    seasons: number[];
    episodes: EpisodePickerItem[];
    selectedSeason: number;
    selectedEpisode: number;
  } | null;
}

export function WatchArea(props: WatchAreaProps) {
  const {
    sources,
    preferredSource,
    title,
    poster,
    contentId,
    episodeId,
    startTime,
    isFilm,
  episodePicker,
  } = props;

  const initialId =
    preferredSource && sources.find((s) => s.id === preferredSource)
      ? preferredSource
      : sources[0]?.id;
  const [activeSourceId, setActiveSourceId] = useState<string | undefined>(initialId);

  const serverSelector: ReactNode = (
    <ServerSelector
      sources={sources}
      activeId={activeSourceId}
      onSourceChange={setActiveSourceId}
    />
  );

  return (
    <>
      <VideoPlayer
        sources={sources}
        preferredSource={preferredSource}
        title={title}
        poster={poster}
        contentId={contentId}
        episodeId={episodeId}
        startTime={startTime}
        activeSourceId={activeSourceId}
        onSourceChange={setActiveSourceId}
        key={activeSourceId ?? "no-source"}
      />

      {isFilm && <div className="mt-3">{serverSelector}</div>}

      {!isFilm && episodePicker && (
        <div className="mt-6">
          <h2 className="mb-3 text-base font-semibold text-white/80">Episode</h2>
          <EpisodePicker
            slug={episodePicker.slug}
            seasons={episodePicker.seasons}
            episodes={episodePicker.episodes}
            selectedSeason={episodePicker.selectedSeason}
            selectedEpisode={episodePicker.selectedEpisode}
            trailing={serverSelector}
          />
        </div>
      )}

      {!isFilm && !episodePicker && serverSelector}
    </>
  );
}
