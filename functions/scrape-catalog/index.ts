import { createAdminClient } from "npm:@insforge/sdk";

const OFLIX_BASE_URL = "https://oflix.web.id/";

const ACTIONS = {
  category: "60f406169c602e85ed9c1be184f932649ea75cc171",
  detail: "40c185519a0758814a96c7068ee7461412a8b994a6",
  search: "6094817552ca8bd8cd6c1fbd4d17ce250188487a08",
  play: "7848fa0daf1d1acb7a2efb7ac963e06f0cd618810d",
};

const CATEGORIES: Array<{ action: string; title: string; section: string }> = [
  { action: "recently-add", title: "Recently Added", section: "film" },
  { action: "trending", title: "Trending", section: "film" },
  { action: "upcoming", title: "Upcoming Calendar", section: "film" },
  { action: "indo-dub", title: "Dubbing Indonesia", section: "film" },
  { action: "indonesian-movies", title: "Film Indonesia", section: "film" },
  { action: "indonesian-drama", title: "Series Indonesia", section: "series" },
  { action: "kdrama", title: "Korean Drama", section: "series" },
  { action: "drama-comedy", title: "Drama Komedi", section: "series" },
  { action: "anime", title: "Anime", section: "anichin" },
  { action: "animation", title: "Animasi Seru", section: "series" },
  { action: "western-tv", title: "Series Barat", section: "series" },
  { action: "titan", title: "Titan", section: "series" },
  { action: "cyberpunk", title: "Cyberpunk", section: "series" },
  { action: "short-tv", title: "Drama Pendek", section: "series" },
  { action: "horror", title: "Film Horror", section: "film" },
  { action: "thailand-drama", title: "Drama Thailand", section: "series" },
  { action: "film", title: "Top Movies", section: "film" },
];

const MAX_PAGES_PER_CATEGORY = 5;

const ADULT_TITLE_TERMS = [
  "porn", "porno", "bokep", "hentai", "jav", "xxx", "x-rated", "xrated",
  "sex", "sexy", "sexu", "sexual", "sensual", "erotic", "erotik", "nude",
  "nudity", "naked", "telanjang", "bugil", "lingerie", "bdsm", "kamasutra",
  "kaama sutra", "chaamsutra", "charm sukh", "milf", "fetish", "fetis",
  "masturbasi", "striptease", "blue film", "film biru", "dewasa", "adult",
  "boobs", "bokong", "pantat", "busty", "bbw", "orgasme", "orgasm", "penis",
  "vagina", "titjob", "creampie", "lesbian sex", "gay sex", "ayam kampus",
  "korban", "skandal", "lust", "bondage", "fuck", "fucking", "overfuck",
  "slut", "whore", "nympho", "breasts", "anal", "rape", "escort", "hooker",
  "prostitute", "voyeur", "swinger", "wife swap", "wife-swap", "hot wife",
  "hot mom", "young mother", "stepmom", "step-mom", "step sister",
  "step-sister", "stepsister", "stepson", "step-son", "girlfriend experience",
  "delivery lady", "cam girl", "onlyfans", "adult content", "for adults",
  "khusus dewasa", "umur 18", "18 +", "18+", "nsfw", "virgin", "illicit",
  "temptation", "masseuse",   "koubi", "fantasies", "treacherous",
  "delicious flight", "killer tongue",
  "netorare", "netorareru", "the animation", "fujun", "inran", "sexfriend",
  "oppai", "ikaseru",
];
const ADULT_GENRE_TERMS = [
  "dewasa", "adult", "18+", "hentai", "erotic", "erotik", "sensual",
  "xxx", "for adults", "khusus dewasa", "umur 18", "bokep", "porn", "nsfw",
];
const ADULT_ALLOWLIST = [
  "sex education", "sex and the city", "sex/life", "sex drive", "sex school",
  "sexual harassment", "sex offender", "sex tape", "sex and fury", "deadpool",
  "american pie", "sex is zero", "teach me how to have sex", "sexplanation",
  "sex trafficking", "sex, love", "sex love", "sex in the city",
  "friends with benefits", "no strings attached", "sisters", "step brothers",
  "she's the man", "17 again",
  "uchuu senkan tiramisu", "space battleship tiramisu",
];
const ADULT_SHORT_TERMS = new Set(["sex", "jav", "xxx", "adult", "dewasa", "porn", "hentai"]);

function adultTitleMatches(haystack: string, term: string): boolean {
  if (term.includes(" ")) return haystack.includes(term);
  if (ADULT_SHORT_TERMS.has(term)) return new RegExp(`\\b${term}\\b`).test(haystack);
  return haystack.includes(term);
}

function isAdultTitle(title: string): boolean {
  const t = title.toLowerCase().replace(/\s+/g, " ").trim();
  if (ADULT_ALLOWLIST.some((allow) => t.includes(allow))) return false;
  return ADULT_TITLE_TERMS.some((term) => adultTitleMatches(t, term));
}

function isAdultItem(item: Record<string, unknown>): boolean {
  const title = String(item.title || item.name || item.slug || "");
  if (isAdultTitle(title)) return true;
  const genres = Array.isArray(item.genre)
    ? (item.genre as unknown[]).map((g) => String(g ?? "")).join(" ").toLowerCase()
    : "";
  return ADULT_GENRE_TERMS.some((term) => genres.includes(term));
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

async function oflixFetch<T>(action: string, args: unknown[]): Promise<T> {
  const res = await fetch(OFLIX_BASE_URL, {
    method: "POST",
    headers: {
      "Next-Action": action,
      "Content-Type": "text/plain;charset=UTF-8",
    },
    body: JSON.stringify(args),
  });
  if (!res.ok) throw new Error(`Oflix HTTP ${res.status}`);
  const text = await res.text();
  const dataLine = text.split("\n").find((l) => l.startsWith("1:"));
  if (!dataLine) throw new Error("Oflix flight response missing data line");
  return JSON.parse(dataLine.slice(2)) as T;
}

function normalizeItem(
  item: Record<string, unknown>,
  section: string
): {
  title: string;
  slug: string;
  type: "film" | "series" | "anime" | "donghua";
  posterUrl: string | null;
  releaseYear: number | null;
  releaseDate: string | null;
  rating: number | null;
  country: string | null;
  duration: number | null;
  sourceId: string | null;
  sourceKey: string | null;
  genres: string[];
} {
  const title = String(item.title || item.name || item.slug || "Untitled");
  const detailPath = String(item.detailPath || item.slug || "");
  const slug = detailPath || title.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const rawType = String(item.type || "");
  let type: "film" | "series" | "anime" | "donghua" = "film";
  if (section === "anichin" || rawType === "anime" || rawType === "donghua") {
    type = rawType === "donghua" ? "donghua" : "anime";
  } else if (rawType === "series") {
    type = "series";
  } else {
    type = "film";
  }
  const year = parseInt(String(item.year ?? ""), 10);
  const rating = parseFloat(String(item.rating ?? ""));
  const duration = parseInt(String(item.duration ?? ""), 10);
  let releaseDate: string | null = null;
  const raw = String(item.rawReleaseDate || "");
  if (raw) {
    const parsed = !Number.isNaN(Date.parse(raw)) ? new Date(raw) : null;
    if (parsed && !Number.isNaN(parsed.getTime())) {
      const y = parsed.getUTCFullYear();
      const mo = String(parsed.getUTCMonth() + 1).padStart(2, "0");
      const dd = String(parsed.getUTCDate()).padStart(2, "0");
      if (y >= 1900) releaseDate = `${y}-${mo}-${dd}`;
    } else {
      const ym = raw.match(/^(\d{4})/);
      if (ym && Number(ym[1]) >= 1900) releaseDate = `${ym[1]}-01-01`;
    }
  }
  return {
    title,
    slug,
    type,
    posterUrl: String(item.poster || item.thumbnail || item.image || "") || null,
    releaseYear: Number.isNaN(year) ? null : year,
    releaseDate,
    rating: Number.isNaN(rating) ? null : rating,
    country: String(item.country || "") || null,
    duration: Number.isNaN(duration) ? null : duration,
    sourceId: detailPath || null,
    sourceKey: String(item.subjectId || "") || null,
    genres: Array.isArray(item.genre) ? (item.genre as string[]) : [],
  };
}

export default async function (req: Request): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const baseUrl = Deno.env.get("INSFORGE_BASE_URL");
  const apiKey = Deno.env.get("API_KEY") || Deno.env.get("INSFORGE_API_KEY");

  if (!baseUrl || !apiKey) {
    return new Response(
      JSON.stringify({ success: false, error: "Missing INSFORGE_BASE_URL / API_KEY secrets" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const admin = createAdminClient({ baseUrl, apiKey });
  const report: Record<string, unknown> = { categories: 0, pages: 0, items: 0, upserted: 0, genres: 0, skipped: 0 };

  try {
    for (const cat of CATEGORIES) {
      report.categories = Number(report.categories) + 1;
      for (let page = 1; page <= MAX_PAGES_PER_CATEGORY; page++) {
        let items: Array<Record<string, unknown>> = [];
        try {
          const res = await oflixFetch<{ success: boolean; items: Array<Record<string, unknown>> }>(
            ACTIONS.category,
            [cat.action, page]
          );
          if (res.success && Array.isArray(res.items)) items = res.items;
        } catch (e) {
          console.error(`scrape ${cat.action} page ${page} failed:`, e);
          break;
        }
        if (items.length === 0) break;
        report.pages = Number(report.pages) + 1;
        report.items = Number(report.items) + items.length;

        const rows = items
          .filter((i) => !isAdultItem(i))
          .map((i) => normalizeItem(i, cat.section));
        const skipped = items.length - rows.length;
        if (skipped > 0) {
          report.skipped = Number(report.skipped ?? 0) + skipped;
        }
        if (rows.length === 0) continue;
        const contentRows = rows.map((r) => ({
          slug: r.slug,
          title: r.title,
          type: r.type,
          poster_url: r.posterUrl,
          release_year: r.releaseYear,
          rating: r.rating,
          country: r.country,
          duration: r.duration,
          source_id: r.sourceId,
          source_key: r.sourceKey,
          release_date: r.releaseDate,
          featured: cat.action === "recently-add",
          trending: cat.action === "trending",
        }));

        const { data: upserted, error: upsertError } = await admin.database
          .from("content")
          .upsert(contentRows, { onConflict: "slug" })
          .select("id, slug");

        if (upsertError) {
          console.error(`upsert content (${cat.action} p${page}):`, upsertError);
          continue;
        }
        report.upserted = Number(report.upserted) + (upserted?.length ?? 0);

        // link genres (batched per page)
        const slugToId = new Map<string, string>();
        for (const u of upserted ?? []) slugToId.set(u.slug, u.id);

        const genreRows = new Map<string, { name: string; slug: string }>();
        for (const r of rows) {
          for (const g of r.genres) {
            if (!g || !g.trim()) continue;
            const slug = g.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-");
            if (!genreRows.has(slug)) genreRows.set(slug, { name: g.trim(), slug });
          }
        }
        if (genreRows.size > 0) {
          const { data: genreResults, error: genreError } = await admin.database
            .from("genres")
            .upsert([...genreRows.values()], { onConflict: "slug" })
            .select("id, name, slug");
          if (genreError) {
            console.error(`upsert genres (${cat.action} p${page}):`, genreError);
          } else {
            report.genres = Number(report.genres) + (genreResults?.length ?? 0);
            const slugToGenreId = new Map<string, number>();
            for (const g of genreResults ?? []) slugToGenreId.set(g.slug, g.id);
            const links: Array<{ content_id: string; genre_id: number }> = [];
            for (const r of rows) {
              const cid = slugToId.get(r.slug);
              if (!cid) continue;
              for (const g of r.genres) {
                const gid = slugToGenreId.get(g.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-"));
                if (gid) links.push({ content_id: cid, genre_id: gid });
              }
            }
            if (links.length > 0) {
              const { error: linkError } = await admin.database
                .from("content_genres")
                .upsert(links, { onConflict: "content_id,genre_id" });
              if (linkError) {
                console.error(`link genres (${cat.action} p${page}):`, linkError);
              }
            }
          }
        }
      }
      await new Promise((res) => setTimeout(res, 300));
    }

    const { count } = await admin.database.from("content").select("id", { count: "exact", head: true });

    return new Response(
      JSON.stringify({ success: true, ...report, contentCount: count ?? 0 }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("scrape-catalog fatal:", e);
    return new Response(
      JSON.stringify({ success: false, error: String((e as Error).message ?? e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
}
