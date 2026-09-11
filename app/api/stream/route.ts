import { resolveStream } from "@/lib/stream";
import { rateLimit, clientIp } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const slug = searchParams.get("slug") ?? "";
  const season = searchParams.get("season") ?? "";
  const episode = searchParams.get("episode") ?? "";

  const limited = rateLimit(`stream:${clientIp(request)}`, 60);
  if (!limited.ok) {
    return Response.json({ error: "Too many requests" }, { status: 429 });
  }

  if (!slug) {
    return Response.json({ error: "Missing slug" }, { status: 400 });
  }

  try {
    const result = await resolveStream(slug, season || undefined, episode || undefined);
    const debug = searchParams.get("debug") === "1";
    if (!result) {
      return Response.json({ error: "Could not resolve source key" }, { status: 404 });
    }
    const payload = debug ? result : { streams: result.streams, captions: result.captions };
    return Response.json(payload);
  } catch (e) {
    console.error("stream error:", e);
    return Response.json({ error: String((e as Error).message ?? e) }, { status: 500 });
  }
}
