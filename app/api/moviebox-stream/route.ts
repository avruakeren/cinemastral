import { NextRequest } from "next/server";
import { lookup } from "dns/promises";

export const dynamic = "force-dynamic";

const DEFAULT_DOMAIN = "https://netfilm.world/";

const ALLOWED_SUFFIXES = [".hakunaymatata.com", ".aoneroom.com"];

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
  const clean = host.replace(/^\[|\]$/g, "").split(":")[0];
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
  const domainParam = searchParams.get("domain") ?? "";

  if (!urlParam) {
    return new Response("Missing url param", { status: 400 });
  }

  let target: URL;
  try {
    target = new URL(urlParam);
  } catch {
    return new Response("Invalid url", { status: 400 });
  }

  if (target.protocol !== "https:") {
    return new Response("Only https URLs are allowed", { status: 400 });
  }

  const host = target.hostname.toLowerCase();
  if (!host || !ALLOWED_SUFFIXES.some((s) => host.endsWith(s))) {
    return new Response("Blocked host", { status: 403 });
  }

  const isIpLiteral = /^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.includes(":");
  if (isIpLiteral && isPrivateIp(host)) {
    return new Response("Blocked address", { status: 403 });
  }

  const safeHost = await hostIsSafe(host);
  if (!safeHost) {
    return new Response("Blocked address", { status: 403 });
  }

  const referer = domainParam || DEFAULT_DOMAIN;
  const range = request.headers.get("Range") || "";

  const headers: Record<string, string> = {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    Referer: referer,
    Accept: "*/*",
  };
  if (range) headers["Range"] = range;

  try {
    const upstream = await fetch(urlParam, { headers, cache: "no-store" });

    if (!upstream.ok && upstream.status !== 206) {
      return new Response(`Upstream error ${upstream.status}`, { status: upstream.status });
    }

    const outHeaders = new Headers({
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Range",
      "Access-Control-Expose-Headers": "Content-Range, Accept-Ranges, Content-Length, Content-Type",
      "Cache-Control": "public, max-age=3600",
      "Accept-Ranges": "bytes",
    });

    const ct = upstream.headers.get("Content-Type");
    if (ct) outHeaders.set("Content-Type", ct);
    const cl = upstream.headers.get("Content-Length");
    if (cl) outHeaders.set("Content-Length", cl);
    const cr = upstream.headers.get("Content-Range");
    if (cr) outHeaders.set("Content-Range", cr);

    return new Response(upstream.body, { status: upstream.status, headers: outHeaders });
  } catch {
    return new Response("Upstream fetch failed", { status: 502 });
  }
}
