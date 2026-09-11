/**
 * Cinemastral MovieBox byte-proxy worker.
 *
 * Cloudflare Worker egress IPs are blocked by the MovieBox CDN
 * (`bcdnxw.hakunaymatata.com`, 427) and play API (`h5-api.aoneroom.com`, 429),
 * so this worker does not fetch upstream directly. Instead it forwards every
 * request through the Oflix relay (`https://oflix.web.id/video/<token>`, token =
 * base64 JSON `{u: real url, r: referer}`), whose origin egress is whitelisted.
 *
 * The play API (`h5-api.aoneroom.com`) blocks datacenter egress too (Vercel
 * gets 403), but the relay forwards it fine, so resolve also goes through the
 * relay here instead of server-side.
 *
 * Routes:
 *   GET /stream?url=<enc>&domain=<enc>
 *     -> byte-proxies the signed CDN MP4 through the Oflix relay, passing
 *        through Range / CORS headers.
 *   GET /subtitle?url=<enc>
 *     -> byte-proxies SRT caption files through the Oflix relay.
 *   GET /resolve?subjectId=&se=&ep=&detailPath=
 *     -> resolves play streams from the h5-api through the relay.
 *   GET /caption?subjectId=&id=&detailPath=
 *     -> resolves caption tracks from the h5-api through the relay.
 */

const OFLIX_RELAY = "https://oflix.web.id/video/";
const DEFAULT_MEDIA_DOMAIN = "https://netfilm.world/";
const H5_API = "https://h5-api.aoneroom.com";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

const ALLOWED_PROXY_HOSTS = [".hakunaymatata.com"];

const CORS_EXPOSE = "Content-Range, Accept-Ranges, Content-Length, Content-Type";
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Range",
  "Access-Control-Expose-Headers": CORS_EXPOSE,
};

function json(res: unknown, status = 200): Response {
  return new Response(JSON.stringify(res), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

/** Build the Oflix relay token: base64 JSON `{u, r}` (standard base64, as atob). */
function oflixToken(url: string, referer: string): string {
  const raw = JSON.stringify({ u: url, r: referer });
  return btoa(raw);
}

function hostAllowed(host: string, suffixes: string[]): boolean {
  const clean = host.toLowerCase().replace(/^\[|\]$/g, "").split(":")[0];
  return suffixes.some((s) => clean.endsWith(s));
}

async function proxy(urlParam: string, domainParam: string | null, range: string | null): Promise<Response> {
  let target: URL;
  try {
    target = new URL(urlParam);
  } catch {
    return new Response("Invalid url", { status: 400 });
  }
  if (target.protocol !== "https:") return new Response("Only https URLs are allowed", { status: 400 });
  if (!hostAllowed(target.hostname, ALLOWED_PROXY_HOSTS)) {
    return new Response("Blocked host", { status: 403 });
  }

  const referer = domainParam || DEFAULT_MEDIA_DOMAIN;
  const relayUrl = `${OFLIX_RELAY}${oflixToken(target.toString(), referer)}`;

  const headers = new Headers({ "User-Agent": UA, Accept: "*/*" });
  if (range) headers.set("Range", range);

  const upstream = await fetch(relayUrl, { headers });
  if (!upstream.ok && upstream.status !== 206) {
    return new Response(`Upstream error ${upstream.status}`, { status: upstream.status });
  }

  const outHeaders = new Headers({
    ...CORS,
    "Accept-Ranges": "bytes",
    "Cache-Control": "public, max-age=3600",
  });
  const copy = ["Content-Type", "Content-Length", "Content-Range"];
  for (const key of copy) {
    const val = upstream.headers.get(key);
    if (val) outHeaders.set(key, val);
  }

  return new Response(upstream.body, { status: upstream.status, headers: outHeaders });
}

/** Fetch a URL through the Oflix relay and return the raw response body/status. */
async function relayFetch(target: string, referer: string): Promise<Response> {
  const relayUrl = `${OFLIX_RELAY}${oflixToken(target, referer)}`;
  return fetch(relayUrl, { headers: { "User-Agent": UA, Accept: "*/*" } });
}

/** Proxy an h5-api endpoint (play or caption) through the Oflix relay. */
async function proxyH5Api(path: string, params: URLSearchParams, detailPath: string): Promise<Response> {
  const apiUrl = new URL(path, H5_API);
  for (const [k, v] of params) apiUrl.searchParams.set(k, v);
  const referer = `${DEFAULT_MEDIA_DOMAIN}spa/videoPlayPage/movies/${detailPath}`;
  const upstream = await relayFetch(apiUrl.toString(), referer);
  if (!upstream.ok) {
    return new Response(`Upstream error ${upstream.status}`, { status: upstream.status });
  }
  const outHeaders = new Headers({ ...CORS, "Content-Type": "application/json" });
  return new Response(upstream.body, { status: upstream.status, headers: outHeaders });
}

export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS });
    }

    const route = url.pathname.replace(/\/+$/, "") || "/";
    const q = url.searchParams;
    const range = request.headers.get("Range");

    try {
      if (route === "/stream" || route === "/subtitle") {
        const urlParam = q.get("url") ?? "";
        if (!urlParam) return new Response("Missing url param", { status: 400 });
        return await proxy(urlParam, q.get("domain"), range);
      }

      if (route === "/resolve" || route === "/caption") {
        const subjectId = q.get("subjectId") ?? "";
        const detailPath = q.get("detailPath") ?? "";
        if (!subjectId || !detailPath) {
          return new Response("Missing subjectId/detailPath params", { status: 400 });
        }
        const apiPath =
          route === "/resolve"
            ? "/wefeed-h5api-bff/subject/play"
            : "/wefeed-h5api-bff/subject/caption";
        return await proxyH5Api(apiPath, q, detailPath);
      }

      return json({ ok: true, service: "cinemastral-moviebox-proxy" });
    } catch (e) {
      console.error("worker error:", e);
      return json({ error: String((e as Error).message ?? e) }, 500);
    }
  },
} satisfies ExportedHandler;
