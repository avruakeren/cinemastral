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

/** Translate a single subtitle track via our API */
async function fetchTranslatedSubtitle(originalUrl: string): Promise<string> {
  try {
    const res = await fetch(`/api/translate-subtitle?url=${encodeURIComponent(originalUrl)}`);
    if (!res.ok) {
      console.error("[translate] API returned", res.status, "for", originalUrl.slice(0, 120));
      return originalUrl;
    }
    const blob = await res.blob();
    const blobUrl = URL.createObjectURL(blob);
    console.log("[translate] success for", originalUrl.slice(0, 80));
    return blobUrl;
  } catch (e) {
    console.error("[translate] fetch failed:", e);
    return originalUrl;
  }
}

/** Preload and translate all captions, returning new CaptionTrack[] with translated versions */
async function preloadTranslatedCaptions(
  captions: CaptionTrack[],
): Promise<{ original: CaptionTrack[]; translated: CaptionTrack[] }> {
  const translated: CaptionTrack[] = [];

  for (const cap of captions) {
    const translatedSrc = await fetchTranslatedSubtitle(cap.src);
    translated.push({
      ...cap,
      src: translatedSrc,
      label: cap.label.includes("Indonesian") ? cap.label : `${cap.label} (Terjemahan)`,
      language: "id",
    });
  }

  return { original: captions, translated };
}

export function VideoPlayer({
  sources,
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

  const [autoTranslate, setAutoTranslate] = useState(false);
  const [translating, setTranslating] = useState(false);
  const [translatedCaptions, setTranslatedCaptions] = useState<CaptionTrack[] | null>(null);
  const [iframeError, setIframeError] = useState(false);
  const iframeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const controlled = activeSourceId !== undefined;
  const activeId = controlled ? activeSourceId : internalId;
  const setActiveId = (id: string) => {
    if (controlled) onSourceChange?.(id);
    else setInternalId(id);
  };

  // Sync autoTranslate from localStorage after hydration
  useEffect(() => {
    setAutoTranslate(localStorage.getItem("cinemastral:auto-translate") === "1");
  }, []);

  // Reset iframe error when source changes
  useEffect(() => {
    setIframeError(false);
    if (iframeTimerRef.current) clearTimeout(iframeTimerRef.current);
  }, [activeId]);

  const active = sources.find((s) => s.id === activeId) ?? sources[0];

  const handleToggleTranslate = useCallback((on: boolean) => {
    setAutoTranslate(on);
    localStorage.setItem("cinemastral:auto-translate", on ? "1" : "0");
    if (!on) setTranslatedCaptions(null);
  }, []);

  // Preload translated captions when auto-translate is ON
  useEffect(() => {
    if (!autoTranslate || !active || active.kind !== "hls" || !active.hls?.captions?.length) {
      setTranslatedCaptions(null);
      return;
    }

    console.log("[translate] starting for", active.hls.captions.length, "tracks");
    let cancelled = false;
    setTranslating(true);

    preloadTranslatedCaptions(active.hls.captions).then((result) => {
      if (!cancelled) {
        console.log("[translate] done, translated:", result.translated.length);
        setTranslatedCaptions(result.translated);
        setTranslating(false);
      }
    });

    return () => { cancelled = true; };
  }, [autoTranslate, active]);

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
  const captionsToShow = translatedCaptions ?? hls?.captions ?? [];

  return (
    <div className="relative flex flex-col gap-3">
      {/* Translating overlay */}
      {translating && (
        <div className="absolute inset-0 z-50 flex items-center justify-center rounded-lg bg-black/70">
          <div className="flex flex-col items-center gap-3">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-[var(--color-primary)]" />
            <p className="text-sm text-white/80">Menerjemahkan subtitle...</p>
          </div>
        </div>
      )}

      {/* Auto-translate toggle */}
      <div className="flex items-center gap-2 self-end">
        <button
          onClick={() => handleToggleTranslate(!autoTranslate)}
          className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
            autoTranslate
              ? "bg-[var(--color-primary)] text-black"
              : "bg-white/10 text-white/60 hover:bg-white/15"
          }`}
        >
          <i className={`fa-solid ${autoTranslate ? "fa-language" : "fa-globe"}`} />
          {autoTranslate ? "Translate ON" : "Translate EN → ID"}
        </button>
      </div>

      {iframe ? (
        <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-black">
          {iframeError && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-black/80">
              <i className="fa-solid fa-triangle-exclamation text-3xl text-yellow-500/80" />
              <p className="text-sm text-white/60">Server ini gagal dimuat.</p>
              {sources.length > 1 && (
                <button
                  onClick={() => {
                    const next = sources.find((s) => s.id !== active?.id);
                    if (next) {
                      setIframeError(false);
                      setActiveId(next.id);
                    }
                  }}
                  className="mt-2 rounded-lg bg-[var(--color-primary)] px-4 py-2 text-xs font-medium text-black hover:opacity-90"
                >
                  Coba Server Lain
                </button>
              )}
            </div>
          )}
          <iframe
            src={iframe}
            key={`${active?.id}-${iframe}`}
            title={title}
            className="absolute inset-0 h-full w-full border-0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
            allowFullScreen
            referrerPolicy="no-referrer-when-downgrade"
            onLoad={() => {
              if (iframeTimerRef.current) clearTimeout(iframeTimerRef.current);
              setIframeError(false);
            }}
            onError={() => {
              console.warn("[player] iframe load error, source:", active?.id);
              const next = sources.find((s) => s.id !== active?.id);
              if (next) {
                console.warn("[player] falling back to", next.label);
                setActiveId(next.id);
              } else {
                setIframeError(true);
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
            {captionsToShow.map((cap: CaptionTrack, i) => (
              <Track
                key={`track-${i}`}
                src={cap.src}
                kind="subtitles"
                label={cap.label}
                language={cap.language ?? "id"}
                type={cap.type ?? "vtt"}
                default={autoTranslate ? i === 0 : (cap.defaultTrack ?? i === 0)}
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
