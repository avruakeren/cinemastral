import { NextRequest } from "next/server";
import { lookup } from "dns/promises";

export const dynamic = "force-dynamic";

const MAX_SUBTITLE_BYTES = 1_000_000;

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

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const urlParam = searchParams.get("url") ?? "";

  if (!urlParam) {
    return new Response("Missing url param", { status: 400 });
  }

  let target: URL;
  try {
    target = new URL(urlParam);
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
    const res = await fetch(urlParam, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0 Safari/537.36",
        Referer: "https://oflix.web.id/",
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

    const isVtt = urlParam.includes(".vtt") || contentType.includes("vtt");

    let vtt = text;
    if (!isVtt && !vtt.startsWith("WEBVTT")) {
      vtt = "WEBVTT\n\n" + vtt.replace(/^\d+\s*\n/, "").replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, "$1.$2");
    }

    return new Response(vtt, {
      status: 200,
      headers: {
        "Content-Type": "text/vtt; charset=utf-8",
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch {
    return new Response("Failed to fetch subtitle", { status: 502 });
  }
}
