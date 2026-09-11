import type { Content } from "@/lib/types";

export interface StreamOption {
  quality: string;
  url: string;
  type?: string;
}

export interface CaptionTrack {
  src: string;
  label: string;
  language?: string;
  defaultTrack?: boolean;
  type?: "srt" | "vtt";
}

/** A resolved playback source a player can render. */
export interface ResolvedSource {
  id: string; // 'moviebox' | 'oflix' | 'vidcore'
  label: string;
  kind: "iframe" | "hls";
  iframe?: string;
  hls?: {
    streams: StreamOption[];
    captions: CaptionTrack[];
  };
}

export type ContentType = Content["type"];
