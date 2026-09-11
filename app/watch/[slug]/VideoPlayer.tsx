"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { MediaPlayer, MediaProvider, Track, useMediaPlayer } from "@vidstack/react";
import {
  DefaultMenuCheckbox,
  DefaultMenuItem,
  DefaultMenuSection,
  DefaultVideoLayout,
  defaultLayoutIcons,
} from "@vidstack/react/player/layouts/default";
import "@vidstack/react/player/styles/base.css";
import "@vidstack/react/player/styles/default/theme.css";
import "@vidstack/react/player/styles/default/layouts/video.css";
import { saveProgress } from "@/lib/actions";
import { resolveMovieboxClient, type MovieboxStream, type MovieboxCaption } from "@/lib/providers/moviebox-client";
import type { ResolvedSource, StreamOption, CaptionTrack } from "@/lib/providers/types";

function detectVideoType(url: string): "application/x-mpegurl" | "application/dash+xml" | "video/webm" | "video/mp4" {
  const clean = url.split("?")[0].toLowerCase();
  if (clean.endsWith(".m3u8")) return "application/x-mpegurl";
  if (clean.endsWith(".mpd")) return "application/dash+xml";
  if (clean.endsWith(".webm")) return "video/webm";
  return "video/mp4";
}

function ProgressTracker({
  contentId,
  episodeId,
  disabled,
}: {
  contentId: string;
  episodeId: string | null;
  disabled: boolean;
}) {
  const player = useMediaPlayer();
  const lastSave = useRef(0);

  useEffect(() => {
    if (!player || disabled) return;

    const onTime = () => {
      const now = Date.now();
      if (now - lastSave.current < 10_000) return;
      lastSave.current = now;
      const currentTime = player.currentTime;
      const duration = player.duration;
      const completed = duration > 0 && currentTime > 0 && currentTime / duration > 0.95;
      void saveProgress({
        contentId,
        episodeId,
        progressSeconds: currentTime,
        durationSeconds: duration || null,
        completed,
      });
    };

    const onEnded = () => {
      void saveProgress({
        contentId,
        episodeId,
        progressSeconds: player.duration,
        durationSeconds: player.duration || null,
        completed: true,
      });
    };

    player.addEventListener("time-update", onTime);
    player.addEventListener("ended", onEnded);
    return () => {
      player.removeEventListener("time-update", onTime);
      player.removeEventListener("ended", onEnded);
    };
  }, [player, contentId, episodeId, disabled]);

  return null;
}

function applyCaptionTransparent(el: HTMLElement | null | undefined, transparent: boolean) {
  if (!el) return;
  // Toggle a data attribute on <media-player>. A CSS rule in globals.css then
  // targets it with !important so the caption background/blur disappear
  // regardless of VidStack's theme or any of its font CSS-vars (no conflicts).
  el.toggleAttribute("data-caption-transparent", transparent);
}

function TransparentCaptionToggle() {
  const player = useMediaPlayer();

  function applyTransparent(transparent: boolean) {
    applyCaptionTransparent(player?.el, transparent);
  }

  return (
    <DefaultMenuSection label="Text Background">
      <DefaultMenuItem label="Transparent">
        <DefaultMenuCheckbox
          label="Transparent"
          storageKey="cinemastral:caption-bg-transparent"
          defaultChecked={true}
          onChange={applyTransparent}
        />
      </DefaultMenuItem>
    </DefaultMenuSection>
  );
}

function CaptionTransparencyInit() {
  const player = useMediaPlayer();

  useEffect(() => {
    const stored = localStorage.getItem("cinemastral:caption-bg-transparent");
    const transparent = stored === null ? true : stored === "1";
    applyCaptionTransparent(player?.el, transparent);
    if (transparent) localStorage.setItem("cinemastral:caption-bg-transparent", "1");
  }, [player]);

  return null;
}

function SeekToStart({ startTime }: { startTime?: number }) {
  const player = useMediaPlayer();
  const seeked = useRef(false);

  useEffect(() => {
    if (!player || !startTime || seeked.current) return;
    const onLoaded = () => {
      if (seeked.current || !startTime) return;
      if (startTime > 0 && startTime < (player.duration || Infinity) - 5) {
        seeked.current = true;
        player.currentTime = startTime;
      }
    };
    player.addEventListener("loaded-metadata", onLoaded);
    return () => {
      player.removeEventListener("loaded-metadata", onLoaded);
    };
  }, [player, startTime]);

  return null;
}

export function VideoPlayer({
  sources,
  movieboxParams,
  preferredSource,
  title,
  poster,
  contentId,
  episodeId,
  startTime,
  activeSourceId,
  onSourceChange,
}: {
  sources: ResolvedSource[];
  movieboxParams?: {
    subjectId: string | null;
    detailPath: string;
    season?: string;
    episode?: string;
  } | null;
  preferredSource?: string;
  title: string;
  poster?: string | null;
  contentId?: string;
  episodeId?: string | null;
  startTime?: number;
  activeSourceId?: string;
  onSourceChange?: (id: string) => void;
}) {
  const [internalId, setInternalId] = useState<string>(
    preferredSource && sources.find((s) => s.id === preferredSource)
      ? preferredSource
      : sources[0]?.id ?? "",
  );

  const [movieboxSource, setMovieboxSource] = useState<ResolvedSource | null>(null);
  const [movieboxLoading, setMovieboxLoading] = useState(false);

  // Resolve MovieBox client-side on mount
  useEffect(() => {
    if (!movieboxParams?.subjectId) return;
    setMovieboxLoading(true);
    resolveMovieboxClient(
      movieboxParams.subjectId,
      movieboxParams.detailPath,
      movieboxParams.season,
      movieboxParams.episode,
    ).then((result) => {
      if (result) {
        setMovieboxSource({
          id: "moviebox",
          label: "MovieBox",
          kind: "hls",
          hls: {
            streams: result.streams.map((s) => ({
              quality: s.quality,
              url: s.url,
            })),
            captions: result.captions.map((c) => ({
              src: c.src,
              label: c.label,
              language: c.language,
              type: c.type,
              defaultTrack: c.defaultTrack,
            })),
          },
        });
        setInternalId("moviebox");
      }
    }).finally(() => setMovieboxLoading(false));
  }, [movieboxParams?.subjectId, movieboxParams?.detailPath, movieboxParams?.season, movieboxParams?.episode]);

  const controlled = activeSourceId !== undefined;
  const activeId = controlled ? activeSourceId : internalId;
  const setActiveId = (id: string) => {
    if (controlled) onSourceChange?.(id);
    else setInternalId(id);
  };

  // Merge movieboxSource into sources list
  const allSources = movieboxSource
    ? [movieboxSource, ...sources.filter((s) => s.id !== "moviebox")]
    : sources;
  const active = allSources.find((s) => s.id === activeId) ?? allSources[0];

  if (movieboxLoading && !active) {
    return (
      <div className="flex aspect-video w-full items-center justify-center rounded-lg bg-[var(--color-surface-2)]">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-white" />
          <p className="text-sm text-white/60">Memuat stream...</p>
        </div>
      </div>
    );
  }

  if (!active) {
    return (
      <div className="flex aspect-video w-full items-center justify-center rounded-lg bg-[var(--color-surface-2)]">
        <p className="text-sm text-white/60">
          Streaming gagal dimuat. Coba lagi nanti atau pilih episode lain.
        </p>
      </div>
    );
  }

  const iframe = active.kind === "iframe" ? active.iframe : undefined;
  const hls = active.kind === "hls" ? active.hls : undefined;

  return (
    <div className="relative flex flex-col gap-3">
      {iframe ? (
        <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-black">
          <iframe
            src={iframe}
            title={title}
            className="absolute inset-0 h-full w-full border-0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
            allowFullScreen
            referrerPolicy="no-referrer-when-downgrade"
            sandbox="allow-scripts allow-same-origin allow-presentation"
            onError={() => {
              const alt = sources.find((s) => s.id !== active.id);
              if (alt) {
                console.warn("[player] iframe failed, falling back to", alt.label);
                setActiveId(alt.id);
              }
            }}
          />
        </div>
      ) : (
        <MediaPlayer
          className="w-full overflow-hidden rounded-lg bg-black"
          title={title}
          src={{
            src: (hls?.streams?.[0] as StreamOption | undefined)?.url ?? "",
            type: detectVideoType((hls?.streams?.[0] as StreamOption | undefined)?.url ?? ""),
          }}
          streamType="on-demand"
          aspectRatio="16/9"
          playsInline
        >
          <MediaProvider>
            {(hls?.captions ?? []).map((cap: CaptionTrack, i) => (
              <Track
                key={`track-${i}`}
                src={cap.src}
                kind="subtitles"
                label={cap.label}
                language={cap.language ?? "id"}
                type={cap.type ?? "vtt"}
                default={cap.defaultTrack ?? i === 0}
              />
            ))}
          </MediaProvider>
          {contentId && (
            <ProgressTracker
              contentId={contentId}
              episodeId={episodeId ?? null}
              disabled={active.id !== "moviebox"}
            />
          )}
          {startTime ? <SeekToStart startTime={startTime} /> : null}
          <CaptionTransparencyInit />
          <DefaultVideoLayout
            icons={defaultLayoutIcons}
            thumbnails=""
            showTooltipDelay={500}
            slots={{ settingsMenuItemsEnd: <TransparentCaptionToggle /> }}
          />
        </MediaPlayer>
      )}
    </div>
  );
}
