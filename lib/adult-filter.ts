const ADULT_TITLE_TERMS: Array<string> = [
  "porn",
  "porno",
  "bokep",
  "hentai",
  "jav",
  "xxx",
  "x-rated",
  "xrated",
  "sex",
  "sexy",
  "sexu",
  "sexual",
  "sensual",
  "erotic",
  "erotik",
  "nude",
  "nudity",
  "naked",
  "telanjang",
  "bugil",
  "lingerie",
  "bdsm",
  "kamasutra",
  "kaama sutra",
  "chaamsutra",
  "charm sukh",
  "milf",
  "fetish",
  "fetis",
  "masturbasi",
  "striptease",
  "blue film",
  "film biru",
  "dewasa",
  "adult",
  "boobs",
  "bokong",
  "pantat",
  "busty",
  "bbw",
  "orgasme",
  "orgasm",
  "penis",
  "vagina",
  "titjob",
  "creampie",
  "lesbian sex",
  "gay sex",
  "ayam kampus",
  "korban",
  "skandal",
  "lust",
  "bondage",
  "fuck",
  "fucking",
  "overfuck",
  "slut",
  "whore",
  "nympho",
  "breasts",
  "anal",
  "rape",
  "escort",
  "hooker",
  "prostitute",
  "voyeur",
  "swinger",
  "wife swap",
  "wife-swap",
  "hot wife",
  "hot mom",
  "young mother",
  "stepmom",
  "step-mom",
  "step sister",
  "step-sister",
  "stepsister",
  "stepson",
  "step-son",
  "girlfriend experience",
  "delivery lady",
  "cam girl",
  "onlyfans",
  "adult content",
  "for adults",
  "khusus dewasa",
  "umur 18",
  "18 +",
  "18+",
  "nsfw",
  "virgin",
  "illicit",
  "temptation",
  "masseuse",
  "koubi",
  "fantasies",
  "treacherous",
  "delicious flight",
  "killer tongue",
  "netorare",
  "netorareru",
  "the animation",
  "fujun",
  "inran",
  "sexfriend",
  "oppai",
  "ikaseru",
];

const ADULT_GENRE_TERMS = [
  "dewasa",
  "adult",
  "18+",
  "hentai",
  "erotic",
  "erotik",
  "sensual",
  "xxx",
  "for adults",
  "khusus dewasa",
  "umur 18",
  "bokep",
  "porn",
  "nsfw",
];

const ALLOWLIST = [
  "sex education",
  "sex and the city",
  "sex/life",
  "sex drive",
  "sex school",
  "sexual harassment",
  "sex offender",
  "sex tape",
  "sex and fury",
  "deadpool",
  "american pie",
  "sex is zero",
  "teach me how to have sex",
  "sexplanation",
  "sex trafficking",
  "sex, love",
  "sex love",
  "sex in the city",
  "friends with benefits",
  "no strings attached",
  "sisters",
  "step brothers",
  "she's the man",
  "17 again",
  "uchuu senkan tiramisu",
  "space battleship tiramisu",
];

const SHORT_TERMS = new Set(["sex", "jav", "xxx", "adult", "dewasa", "porn", "hentai"]);

function tokenize(text: string): string {
  return text.toLowerCase().replace(/\s+/g, " ").trim();
}

function titleMatches(haystack: string, term: string): boolean {
  if (term.includes(" ")) return haystack.includes(term);
  if (SHORT_TERMS.has(term)) return new RegExp(`\\b${term}\\b`).test(haystack);
  return haystack.includes(term);
}

function isAllowed(title: string): boolean {
  const t = tokenize(title);
  return ALLOWLIST.some((allow) => t.includes(allow));
}

export function isAdultContent(input: {
  title?: string | null;
  genres?: Array<string | { name?: string }> | null;
}): boolean {
  const title = tokenize(input.title ?? "");
  if (isAllowed(title)) return false;

  const genreNames = (input.genres ?? [])
    .map((g) => (typeof g === "string" ? g : g?.name ?? ""))
    .join(" ")
    .toLowerCase();

  return (
    ADULT_TITLE_TERMS.some((term) => titleMatches(title, term)) ||
    ADULT_GENRE_TERMS.some((term) => genreNames.includes(term))
  );
}
