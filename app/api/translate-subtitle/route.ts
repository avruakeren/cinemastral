import { NextRequest } from "next/server";
import { lookup } from "dns/promises";

export const dynamic = "force-dynamic";

const MAX_SUBTITLE_BYTES = 1_000_000;
const MAX_TRANSLATE_CHARS = 4500;
const ALLOWED_SCHEMES = new Set(["https:"]);

function isPrivateIp(ip: string): boolean {
  const low = ip.toLowerCase();
  if (ip.includes(":")) {
    if (low === "::1" || low === "::") return true;
    if (low.startsWith("fe80") || low.startsWith("fc") || low.startsWith("fd")) return true;
    return false;
  }
  const n = ip.split(".").map((p) => parseInt(p, 10));
  if (n.length !== 4 || n.some((p) => Number.isNaN(p))) return false;
  if (n[0] === 10) return true;
  if (n[0] === 127) return true;
  if (n[0] === 0) return true;
  if (n[0] === 169 && n[1] === 254) return true;
  if (n[0] === 172 && n[1] >= 16 && n[1] <= 31) return true;
  if (n[0] === 192 && n[1] === 168) return true;
  if (n[0] >= 224) return true;
  return false;
}

async function hostIsSafe(host: string): Promise<boolean> {
  if (host.includes(":") && !host.startsWith("[")) {
    const bracket = host.slice(host.indexOf("[") + 1, host.indexOf("]"));
    if (bracket) host = bracket;
  }
  const clean = host.replace(/^\[|\]$/g, "");
  try {
    const addresses = await lookup(clean, { all: true });
    if (!addresses.length) return false;
    return addresses.every((a) => !isPrivateIp(a.address));
  } catch {
    return false;
  }
}

/** Parse VTT content into structured cues */
function parseVtt(vtt: string): Array<{ time: string; text: string }> {
  const lines = vtt.split("\n");
  const cues: Array<{ time: string; text: string }> = [];
  let i = 0;

  // Skip WEBVTT header
  while (i < lines.length && !lines[i].includes("-->")) i++;

  while (i < lines.length) {
    const line = lines[i];
    if (line.includes("-->")) {
      const time = line.trim();
      i++;
      const textLines: string[] = [];
      while (i < lines.length && lines[i].trim() !== "") {
        textLines.push(lines[i]);
        i++;
      }
      if (textLines.length > 0) {
        cues.push({ time, text: textLines.join("\n") });
      }
    }
    i++;
  }
  return cues;
}

/** Batch translate text via Google Translate free endpoint */
async function translateBatch(texts: string[]): Promise<string[]> {
  if (texts.length === 0) return [];

  const joined = texts.map((t, i) => `<<${i}>>${t}`).join("\n");
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=id&dt=t&q=${encodeURIComponent(joined)}`;

  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0 Safari/537.36",
      },
    });

    if (!res.ok) {
      console.error("[translate] Google translate failed:", res.status);
      return texts;
    }

    const data = await res.json();
    
    // Google Translate returns array of arrays, each item is [translated_text, original_text, ...]
    if (!data || !data[0] || !Array.isArray(data[0])) {
      console.error("[translate] Unexpected response format:", JSON.stringify(data).slice(0, 200));
      return texts;
    }
    
    const translated = data[0].map((item: [string, string, string, string]) => item[0]).join("");

    // Parse translated text back, splitting by <<N>> markers
    const results: string[] = [];
    for (let i = 0; i < texts.length; i++) {
      const marker = `<<${i}>>`;
      const start = translated.indexOf(marker);
      if (start === -1) {
        results.push(texts[i]);
        continue;
      }
      const afterMarker = translated.substring(start + marker.length);
      const nextMarkerMatch = afterMarker.match(/<<\d+>>/);
      const nextMarkerIdx = nextMarkerMatch ? afterMarker.indexOf(nextMarkerMatch[0]) : -1;
      const chunk = nextMarkerIdx === -1 ? afterMarker.trim() : afterMarker.substring(0, nextMarkerIdx).trim();
      results.push(chunk || texts[i]);
    }

    return results;
  } catch (e) {
    console.error("[translate] translateBatch error:", e);
    return texts;
  }
}

/** Translate VTT content from English to Indonesian */
async function translateVtt(vtt: string): Promise<string> {
  const cues = parseVtt(vtt);
  if (cues.length === 0) return vtt;

  const translatedCues: string[] = [`WEBVTT\n`];
  const batchSize = 30;

  for (let i = 0; i < cues.length; i += batchSize) {
    const batch = cues.slice(i, i + batchSize);
    const texts = batch.map((c) => c.text.replace(/<[^>]+>/g, "").trim());
    const translated = await translateBatch(texts);

    for (let j = 0; j < batch.length; j++) {
      translatedCues.push(batch[j].time);
      translatedCues.push(translated[j] || batch[j].text);
      translatedCues.push("");
    }

    // Small delay between batches to avoid rate limiting
    if (i + batchSize < cues.length) {
      await new Promise((r) => setTimeout(r, 50));
    }
  }

  return translatedCues.join("\n");
}

/** If the URL is a proxied /api/moviebox-stream or /api/subtitle URL, extract the original URL */
function extractOriginalUrl(proxyUrl: string): string {
  try {
    const u = new URL(proxyUrl, "http://localhost");
    const realUrl = u.searchParams.get("url");
    if (realUrl && (u.pathname.includes("/api/moviebox-stream") || u.pathname.includes("/api/subtitle"))) {
      return realUrl;
    }
  } catch { /* not a proxy URL */ }
  return proxyUrl;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const urlParam = searchParams.get("url") ?? "";

  if (!urlParam) {
    return new Response("Missing url param", { status: 400 });
  }

  // Extract original CDN URL if it's a proxy URL
  const originalUrl = extractOriginalUrl(urlParam);
  console.log("[translate-subtitle] received:", urlParam.slice(0, 100));
  console.log("[translate-subtitle] extracted:", originalUrl.slice(0, 100));

  let target: URL;
  try {
    target = new URL(originalUrl);
  } catch {
    return new Response("Invalid url", { status: 400 });
  }

  if (!ALLOWED_SCHEMES.has(target.protocol)) {
    return new Response("Only https URLs are allowed", { status: 400 });
  }

  const host = target.hostname;
  if (!host) {
    return new Response("Invalid url", { status: 400 });
  }

  const isIpLiteral = /^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.includes(":");
  if (isIpLiteral && isPrivateIp(host)) {
    return new Response("Blocked address", { status: 403 });
  }

  const safeHost = await hostIsSafe(host);
  if (!safeHost) {
    return new Response("Blocked address", { status: 403 });
  }

  try {
    const res = await fetch(target.toString(), {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0 Safari/537.36",
        Referer: "https://netfilm.world/",
      },
      cache: "no-store",
    });

    if (!res.ok) {
      return new Response("Failed to fetch subtitle", { status: res.status });
    }

    const contentType = res.headers.get("Content-Type") ?? "";
    if (contentType.includes("text/html") || contentType.includes("application/json")) {
      return new Response("Unexpected subtitle content", { status: 502 });
    }

    const text = await res.text();
    if (Buffer.byteLength(text, "utf8") > MAX_SUBTITLE_BYTES) {
      return new Response("Subtitle too large", { status: 502 });
    }

    const isVtt = target.pathname.includes(".vtt") || contentType.includes("vtt");
    let vtt = text;
    if (!isVtt && !vtt.startsWith("WEBVTT")) {
      vtt = "WEBVTT\n\n" + vtt.replace(/^\d+\s*\n/, "").replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, "$1.$2");
    }

    const translated = await translateVtt(vtt);

    return new Response(translated, {
      status: 200,
      headers: {
        "Content-Type": "text/vtt; charset=utf-8",
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch {
    return new Response("Failed to translate subtitle", { status: 502 });
  }
}
