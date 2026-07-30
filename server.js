/* ===============================
   CARDGAUGE / TRACK THE MARKET
   AI SCANNER + EBAY CARD MARKET BACKEND
   server.js — eBay EPN Affiliate v2
   + median pricing + graded/raw split
   + TIERED PARALLEL-AWARE PRICING
================================ */

const express = require("express");
const cors = require("cors");
const multer = require("multer");
const fetch = require("node-fetch");

const app = express();

// ── CORS — allow all origins (fixes Wix iframe fetch) ──────────
app.use(cors({ origin: "*" }));
app.use(express.json({ limit: "25mb" }));
app.use(express.urlencoded({ extended: true }));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 }
});

// ── eBay Partner Network (EPN) Affiliate Config ────────────────
const EPN_CAMPAIGN_ID = "5339149252";
const EBAY_FETCH_LIMIT = 100;   // was 25 — too small to filter parallels out of

function ebayUrl(query, sold) {
  const base = "https://www.ebay.com/sch/i.html";
  const q = encodeURIComponent(normalizeCardQuery(query));
  const soldParams = sold ? "&LH_Sold=1&LH_Complete=1" : "";
  return `${base}?_nkw=${q}${soldParams}&mkcid=1&mkrid=711-53200-19255-0&siteid=0&campid=${EPN_CAMPAIGN_ID}&toolid=10001&mkevt=1`;
}

function addAffiliateToUrl(url) {
  if (!url) return "";
  try {
    const u = new URL(url);
    u.searchParams.set("mkcid",  "1");
    u.searchParams.set("mkrid",  "711-53200-19255-0");
    u.searchParams.set("siteid", "0");
    u.searchParams.set("campid", EPN_CAMPAIGN_ID);
    u.searchParams.set("toolid", "10001");
    u.searchParams.set("mkevt",  "1");
    return u.toString();
  } catch (e) {
    const sep = url.includes("?") ? "&" : "?";
    return `${url}${sep}mkcid=1&mkrid=711-53200-19255-0&siteid=0&campid=${EPN_CAMPAIGN_ID}&toolid=10001&mkevt=1`;
  }
}

// ── State ──────────────────────────────────────────────────────
let ebayToken = null;
let ebayTokenExpires = 0;

// ── Root & Health ──────────────────────────────────────────────
app.get("/", (req, res) => {
  res.json({
    success: true,
    app: "CardGauge / Track The Market Backend",
    status: "online",
    affiliate: `eBay EPN active — campid ${EPN_CAMPAIGN_ID}`
  });
});

app.get("/health", (req, res) => {
  res.json({
    success: true,
    status: "healthy",
    uptime: process.uptime(),
    affiliate: `eBay EPN active — campid ${EPN_CAMPAIGN_ID}`
  });
});

app.get("/api/affiliate-test", (req, res) => {
  const q = "Charizard PSA 10 Base Set";
  res.json({
    success: true,
    campid: EPN_CAMPAIGN_ID,
    sampleActiveUrl: ebayUrl(q, false),
    sampleSoldUrl:   ebayUrl(q, true),
    message: "If campid=5339149252 appears in both URLs above, affiliate tracking is working."
  });
});

// ── Helpers ────────────────────────────────────────────────────
function fileToDataUrl(file) {
  const mime = file.mimetype || "image/jpeg";
  const base64 = file.buffer.toString("base64");
  return `data:${mime};base64,${base64}`;
}

function cleanJsonText(text) {
  return String(text || "")
    .replace(/```json/gi, "")
    .replace(/```/g, "")
    .trim();
}

function safeNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function average(nums) {
  if (!nums.length) return 0;
  return Math.round(nums.reduce((a, b) => a + b, 0) / nums.length);
}

// Median — resistant to junk lots and mispriced whales.
function median(sortedNums) {
  if (!sortedNums.length) return 0;
  const n = sortedNums.length;
  const mid = Math.floor(n / 2);
  const m = (n % 2 === 0) ? ((sortedNums[mid - 1] + sortedNums[mid]) / 2) : sortedNums[mid];
  return Math.round(m);
}

// Trimmed range — drops the extreme ~10% on each end.
function trimmedRange(sortedNums) {
  if (!sortedNums.length) return { low: 0, high: 0 };
  const n = sortedNums.length;
  const cut = n >= 5 ? Math.floor(n * 0.1) : 0;
  return {
    low:  Math.round(sortedNums[cut]),
    high: Math.round(sortedNums[n - 1 - cut])
  };
}

// Detect a graded slab and pull the company + grade out of the title.
function detectGrade(title) {
  const t = " " + String(title || "").toLowerCase() + " ";
  const m = t.match(/\b(psa|bgs|bvg|cgc|sgc|hga|gma|csg)\s*\.?\s*(10|[1-9](?:\.5)?)\b/);
  if (m) return { graded: true, company: m[1].toUpperCase(), grade: parseFloat(m[2]) };
  if (/\b(psa|bgs|bvg|cgc|sgc|hga|gma|csg)\b/.test(t)) return { graded: true, company: null, grade: null };
  if (t.includes("graded") || t.includes("slab") || t.includes("encased")) return { graded: true, company: null, grade: null };
  return { graded: false, company: null, grade: null };
}

/* A median of one number is not a median. Below this many listings a
   group is reported but flagged thin, and per-grade medians are dropped
   entirely so the frontend falls back to an honest estimate. One junk
   $24,999 listing must never become "the PSA 10 price". */
const MIN_GROUP = 3;

function summarizeGroup(items) {
  const prices = items.map(x => x.price).sort((a, b) => a - b);
  const r = trimmedRange(prices);
  return {
    count:  items.length,
    median: median(prices),
    low:    r.low,
    high:   r.high,
    thin:   items.length > 0 && items.length < MIN_GROUP
  };
}

function gradeBreakdown(gradedItems) {
  const buckets = {};
  gradedItems.forEach(x => {
    if (!x.gradeCompany || x.gradeValue == null) return;
    const key = x.gradeCompany + " " + x.gradeValue;
    if (!buckets[key]) buckets[key] = [];
    buckets[key].push(x.price);
  });
  return Object.keys(buckets)
    .filter(k => buckets[k].length >= MIN_GROUP)   // <- the fix
    .sort()
    .map(k => ({
      grade:  k,
      count:  buckets[k].length,
      median: median(buckets[k].sort((a, b) => a - b))
    }));
}

/* How far apart are the listings? A typical ask of $19 with a high ask
   of $300 means the search is matching several different cards, not one.
   Worth telling the user rather than quietly reporting the median. */
/* 4x between the typical ask and the trimmed high is enough to mean the
   search is catching more than one card. Two real examples set this line:
   "topps finest ohtani" ran 15x, "topps chrome judge" ran 4.2x, and both
   were mixing base cards with autos and parallels. */
const WIDE_SPREAD_AT = 4;

function spreadRatio(sortedPrices) {
  if (sortedPrices.length < 4) return 0;
  const r = trimmedRange(sortedPrices);
  const m = median(sortedPrices);
  if (!m || !r.low) return 0;
  return r.high / m;
}

function normalizeCardQuery(query) {
  let q = String(query || "").replace(/\s+/g, " ").trim();
  if (!q) return "sports trading card";
  const lower = q.toLowerCase();
  const pokemonNames = [
    "charizard","pikachu","umbreon","rayquaza","mewtwo","gengar",
    "eevee","dragonite","lugia","blastoise","snorlax","mew",
    "gyarados","lucario","greninja"
  ];
  if (pokemonNames.includes(lower)) q = `${q} Pokemon card`;
  if (
    lower.includes("pokemon") &&
    !lower.includes("card") &&
    !lower.includes("booster") &&
    !lower.includes("box") &&
    !lower.includes("sealed")
  ) {
    q += " card";
  }
  return q;
}

function isLikelyCardListing(title) {
  const t = String(title || "").toLowerCase();
  const positive = [
    "card","cards","psa","bgs","cgc","sgc","rookie","rc",
    "topps","bowman","panini","prizm","select","optic",
    "pokemon","pokémon","holo","reverse holo","booster",
    "hobby box","sealed","chrome","refractor","auto","autograph",
    "patch","parallel","graded","slab"
  ];
  const negative = [
    "poster","plush","figure","toy","shirt","t-shirt","costume",
    "sticker only","keychain","funko","blanket","pillow","wallet",
    "phone case","digital","code card only"
  ];
  return positive.some(w => t.includes(w)) && !negative.some(w => t.includes(w));
}

/* ═══════════════════════════════════════════════════════════════
   PARALLEL-AWARE QUERY BUILDING + LISTING SELECTION

   The old buildCardQuery jammed every attribute into one eBay
   keyword search. eBay ANDs those words together, so a parallel
   card returned 0-2 listings and priced off noise. Three bugs:

     1. "Base Set" / "Base Rookie" leaked into the query and never
        matched a real listing title.
     2. Word-level dedupe turned "Panini Prizm ... Silver Prizm"
        into "... Silver", destroying the parallel.
     3. The serial COPY number (25/99) was searched instead of the
        denominator (/99), which almost never matches.

   New approach: search wide, then filter titles down to the exact
   parallel. Base cards also get parallels filtered OUT, which they
   never did before — that was inflating base prices badly.
═══════════════════════════════════════════════════════════════ */

const GENERIC_SET = /^(base|base set|base rookie|base series|base card|common|rookie|rookies|n\/a|none|unknown|-)$/i;
const JUNK_VALUE  = /^(unknown|n\/a|none|-|null|)$/i;

// Brand/product names are deliberately EXCLUDED (Prizm, Chrome, Select,
// Optic, Mosaic) — they appear in every title for the product and would
// flag base cards as parallels.
const COLOR_WORDS = [
  "silver","gold","red","blue","green","orange","purple","pink","black",
  "bronze","teal","aqua","yellow","white","rainbow","camo","sepia","neon",
  "tie-dye","tiedye","fuchsia","magenta","lime","navy"
];
const TEXTURE_WORDS = [
  "refractor","xfractor","x-fractor","superfractor","holo","holofoil","foil",
  "shimmer","wave","mojo","disco","hyper","ice","cracked","laser","scope",
  "velocity","pulsar","sparkle","atomic","negative","speckle","vinyl",
  "reactive","genesis","asia","choice","dragon","tiger","zebra"
];
const PARALLEL_WORDS = COLOR_WORDS.concat(TEXTURE_WORDS);

function cleanVal(v) {
  const s = String(v == null ? "" : v).trim();
  return JUNK_VALUE.test(s) ? "" : s;
}

// Dedupe WHOLE phrases, not individual words.
function joinParts(parts) {
  const seen = {}, out = [];
  parts.forEach(p => {
    const s = String(p || "").trim();
    if (!s) return;
    const k = s.toLowerCase();
    if (seen[k]) return;
    seen[k] = 1;
    out.push(s);
  });
  return out.join(" ").replace(/\s+/g, " ").trim();
}

// "Topps Update" + set "Update Series" -> keep only the new word(s).
function trimOverlap(setName, brandName) {
  if (!setName || !brandName) return setName;
  const brandWords = {};
  String(brandName).toLowerCase().split(/\s+/).forEach(w => { brandWords[w] = 1; });
  return String(setName).split(/\s+/)
    .filter(w => !brandWords[w.toLowerCase()])
    .join(" ").trim();
}

function cardNumberToken(ai) {
  const n = cleanVal(ai.cardNumber);
  if (!n) return "";
  return "#" + n.replace(/^#/, "");
}

// The serial DENOMINATOR is searchable ("/99"). The copy number is not.
// "/1" is excluded because it substring-matches /10, /15, /199 etc.
function serialDenominator(ai) {
  const s = cleanVal(ai.serialNumber);
  const m = s.match(/(\d+)\s*\/\s*(\d+)/);
  if (!m) return "";
  const denom = m[2];
  if (denom === "1") return m[1] === "1" ? "1/1" : "";
  return "/" + denom;
}

function buildQueryTiers(ai) {
  const year   = cleanVal(ai.year);
  const brand  = cleanVal(ai.brand);
  const player = cleanVal(ai.player);
  const setRaw = cleanVal(ai.set);
  const set    = GENERIC_SET.test(setRaw) ? "" : trimOverlap(setRaw, brand);
  const parRaw = cleanVal(ai.parallel);
  const par    = GENERIC_SET.test(parRaw) ? "" : parRaw;
  const num    = cardNumberToken(ai);
  const grade  = (cleanVal(ai.gradeCompany) && cleanVal(ai.gradeValue))
                 ? cleanVal(ai.gradeCompany) + " " + cleanVal(ai.gradeValue) : "";

  const tight = joinParts([year, brand, set, player, par, num, grade]);
  const core  = joinParts([year, brand, player, num, grade]);
  const loose = joinParts([year, brand, player]);

  const tiers = [];
  if (tight) tiers.push({ tier: "tight", query: tight });
  if (core && core !== tight) tiers.push({ tier: "core", query: core });
  if (loose && loose !== core && loose !== tight) tiers.push({ tier: "loose", query: loose });
  return tiers;
}

function parallelTerms(ai) {
  const par = cleanVal(ai.parallel);
  if (!par || GENERIC_SET.test(par)) return [];
  return par.toLowerCase()
    .replace(/[^a-z0-9\- ]/g, " ")
    .split(/\s+/)
    .filter(w => w.length > 2 && w !== "parallel");
}

function titleHasParallel(title, terms) {
  if (!terms.length) return false;
  const t = " " + String(title || "").toLowerCase() + " ";
  return terms.every(term => t.includes(term));
}

function titleHasSerial(title, denom) {
  if (!denom) return false;
  return String(title || "").replace(/\s+/g, "").toLowerCase().includes(denom);
}

function titleLooksParallel(title, brandName) {
  let t = " " + String(title || "").toLowerCase() + " ";
  String(brandName || "").toLowerCase().split(/\s+/).forEach(w => {
    if (w.length > 2) t = t.split(w).join(" ");
  });
  if (/\/\s*\d{1,4}\b/.test(t)) return true;
  return PARALLEL_WORDS.some(w => t.includes(" " + w));
}

function selectListings(ai, byTier) {
  const terms = parallelTerms(ai);
  const denom = serialDenominator(ai);
  const brand = cleanVal(ai.brand);
  const isParallel = terms.length > 0 || !!denom;
  const MIN = 4;

  const tight = byTier.tight || [];

  // For a BASE card the tight query is identical to the core query, so it
  // returns parallels too. Strip them before trusting the sample, or a base
  // card gets priced off refractors sitting in the same results.
  if (tight.length >= MIN) {
    if (!isParallel) {
      const tightBase = tight.filter(l => !titleLooksParallel(l.title, brand));
      if (tightBase.length >= 3) {
        return { listings: tightBase, matchQuality: "exact", tierUsed: "tight-base",
                 note: "Priced from base-card listings; parallels excluded." };
      }
    }
    return { listings: tight, matchQuality: "exact", tierUsed: "tight",
             note: isParallel ? "Priced from listings for this exact parallel."
                              : "Priced from listings for this exact card." };
  }

  const wide = (byTier.core && byTier.core.length ? byTier.core : (byTier.loose || []));

  if (isParallel && wide.length) {
    let matched = wide.filter(l => titleHasParallel(l.title, terms));
    if (denom) {
      const ids = {};
      matched.concat(wide.filter(l => titleHasSerial(l.title, denom)))
             .forEach(l => { ids[l.title] = l; });
      matched = Object.keys(ids).map(k => ids[k]);
    }
    if (matched.length >= 2) {
      const thin = matched.length < 4;
      return { listings: matched,
               matchQuality: thin ? "thin" : "exact",
               tierUsed: "core+filter",
               note: thin
                 ? "Only " + matched.length + " listings found for this parallel — treat this as a rough guide."
                 : "Priced from listings matching this parallel." };
    }
    if (tight.length) {
      return { listings: tight, matchQuality: "thin", tierUsed: "tight",
               note: "Only " + tight.length + " listing" + (tight.length === 1 ? "" : "s") +
                     " found for this parallel — treat this price as a rough guide." };
    }
    const base = wide.filter(l => !titleLooksParallel(l.title, brand));
    if (base.length >= 3) {
      return { listings: base, matchQuality: "base_fallback", tierUsed: "core-base",
               note: "No listings found for this parallel. Showing BASE card prices — a parallel is usually worth more." };
    }
    return { listings: wide, matchQuality: "base_fallback", tierUsed: "core",
             note: "No listings found for this parallel. Showing prices for the card generally." };
  }

  if (!isParallel && wide.length) {
    const base = wide.filter(l => !titleLooksParallel(l.title, brand));
    if (base.length >= 3) {
      return { listings: base, matchQuality: "exact", tierUsed: "core-base",
               note: "Priced from base-card listings; parallels excluded." };
    }
  }

  if (tight.length) {
    return { listings: tight, matchQuality: "thin", tierUsed: "tight",
             note: "Very few listings found — treat this price as a rough guide." };
  }
  return { listings: wide, matchQuality: wide.length ? "loose" : "none", tierUsed: "loose",
           note: wide.length ? "Priced from a broad search — verify the exact version."
                             : "No clean card listings found." };
}

// Human-readable card name for display, including the parallel.
function buildDisplayName(ai) {
  const brand  = cleanVal(ai.brand);
  const setRaw = cleanVal(ai.set);
  const set    = GENERIC_SET.test(setRaw) ? "" : trimOverlap(setRaw, brand);
  let n = joinParts([cleanVal(ai.year), brand, set, cleanVal(ai.player)]);
  const par = cleanVal(ai.parallel);
  if (par && !GENERIC_SET.test(par)) n += " " + par;
  const s = cleanVal(ai.serialNumber);
  if (s && /\d+\s*\/\s*\d+/.test(s)) n += " " + s.replace(/\s+/g, "");
  if (ai.isRookie) n += " RC";
  return n.trim() || cleanVal(ai.cardName) || "Unknown Trading Card";
}

// Kept for backward compatibility — returns the tightest query.
function buildCardQuery(ai) {
  const tiers = buildQueryTiers(ai);
  return tiers.length ? tiers[0].query : "";
}

// ── eBay fetching ──────────────────────────────────────────────
async function getEbayToken() {
  if (ebayToken && Date.now() < ebayTokenExpires) return ebayToken;
  if (!process.env.EBAY_CLIENT_ID || !process.env.EBAY_CLIENT_SECRET) {
    console.log("Missing eBay credentials");
    return null;
  }
  const auth = Buffer.from(
    process.env.EBAY_CLIENT_ID + ":" + process.env.EBAY_CLIENT_SECRET
  ).toString("base64");
  const response = await fetch(
    "https://api.ebay.com/identity/v1/oauth2/token",
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: "grant_type=client_credentials&scope=https://api.ebay.com/oauth/api_scope"
    }
  );
  const data = await response.json();
  if (!data.access_token) {
    console.log("eBay token failed:", data);
    return null;
  }
  ebayToken = data.access_token;
  ebayTokenExpires = Date.now() + ((data.expires_in || 7200) - 60) * 1000;
  return ebayToken;
}

// Raw listing fetch for a single query string.
async function fetchEbayListings(query, limit) {
  try {
    const token = await getEbayToken();
    const cleanQuery = normalizeCardQuery(query);
    if (!token || !cleanQuery) return [];

    const url =
      "https://api.ebay.com/buy/browse/v1/item_summary/search?q=" +
      encodeURIComponent(cleanQuery) + "&limit=" + (limit || EBAY_FETCH_LIMIT);

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        "X-EBAY-C-MARKETPLACE-ID": "EBAY_US",
        "Content-Type": "application/json"
      }
    });

    const data = await response.json();
    const rawItems = Array.isArray(data.itemSummaries) ? data.itemSummaries : [];

    return rawItems
      .filter(item => isLikelyCardListing(item.title))
      .map(item => {
        const g = detectGrade(item.title);
        return {
          title:        item.title || "",
          price:        safeNumber(item.price && item.price.value, 0),
          currency:     item.price && item.price.currency ? item.price.currency : "USD",
          image:        item.image && item.image.imageUrl ? item.image.imageUrl : "",
          url:          addAffiliateToUrl(item.itemWebUrl || ""),
          graded:       g.graded,
          gradeCompany: g.company,
          gradeValue:   g.grade
        };
      })
      .filter(item => item.price > 0);
  } catch (error) {
    console.log("eBay fetch error:", error.message);
    return [];
  }
}

// Turn a listing array into the market summary shape the frontends expect.
function summarizeListings(listings, cleanQuery, extra) {
  const prices = listings.map(item => item.price).sort((a, b) => a - b);
  const range  = trimmedRange(prices);
  const rawGroup    = listings.filter(x => !x.graded);
  const gradedGroup = listings.filter(x =>  x.graded);
  const spread = spreadRatio(prices);

  const base = {
    query:          cleanQuery,
    avgPrice:       median(prices),
    lowPrice:       range.low,
    highPrice:      range.high,
    listingCount:   listings.length,
    spreadRatio:    Number(spread.toFixed(1)),
    wideSpread:     spread >= WIDE_SPREAD_AT,
    image:          (listings.find(x => x.image) || {}).image || "",
    priceSource:    listings.length ? "eBay active card listings (median)" : "No clean card listings found",
    raw:            summarizeGroup(rawGroup),
    graded:         summarizeGroup(gradedGroup),
    gradeBreakdown: gradeBreakdown(gradedGroup),
    listings
  };

  // Only set a note if the caller hasn't already written a better one.
  if (base.wideSpread && !(extra && extra.priceNote)) {
    base.matchQuality = "loose";
    base.priceNote =
      "These listings vary a lot — the search is probably matching several " +
      "different cards. Edit the search below to narrow it down.";
  }

  return Object.assign(base, extra || {});
}

const EMPTY_MARKET = (q, source) => ({
  query: q, avgPrice: 0, lowPrice: 0, highPrice: 0,
  listingCount: 0, image: "", priceSource: source,
  raw: { count:0, median:0, low:0, high:0, thin:false },
  graded: { count:0, median:0, low:0, high:0, thin:false },
  gradeBreakdown: [], listings: [],
  spreadRatio: 0, wideSpread: false
});

// Plain text-query lookup (used by /api/card-market, /api/card-price,
// vs-market and the watchlist refresh).
async function getEbayCardMarket(query) {
  try {
    const cleanQuery = normalizeCardQuery(query);
    const listings = await fetchEbayListings(cleanQuery);
    if (!listings.length) return EMPTY_MARKET(cleanQuery, "No clean card listings found");
    return summarizeListings(listings, cleanQuery);
  } catch (error) {
    console.log("eBay card market error:", error.message);
    return EMPTY_MARKET(normalizeCardQuery(query), "eBay lookup failed");
  }
}

// Parallel-aware lookup for a scanned card. Searches tight first, widens
// only if needed, then filters titles down to the right version.
async function getCardMarketForCard(ai) {
  const tiers = buildQueryTiers(ai);
  if (!tiers.length) {
    const fallback = cleanVal(ai.cardName) || "sports trading card";
    const m = await getEbayCardMarket(fallback);
    return Object.assign(m, {
      searchQuery: fallback, matchQuality: "loose", tierUsed: "fallback",
      priceNote: "Card could not be identified precisely — verify the exact version."
    });
  }

  const byTier = {};
  const tightTier = tiers.find(t => t.tier === "tight");
  if (tightTier) byTier.tight = await fetchEbayListings(tightTier.query);

  // Only widen when the tight search came back thin.
  if (!byTier.tight || byTier.tight.length < 4) {
    const coreTier = tiers.find(t => t.tier === "core");
    if (coreTier) byTier.core = await fetchEbayListings(coreTier.query);
    if (!byTier.core || byTier.core.length < 4) {
      const looseTier = tiers.find(t => t.tier === "loose");
      if (looseTier) byTier.loose = await fetchEbayListings(looseTier.query);
    }
  }

  const picked = selectListings(ai, byTier);
  const usedQuery =
    picked.tierUsed.indexOf("tight") === 0 ? (tightTier ? tightTier.query : tiers[0].query)
    : picked.tierUsed.indexOf("loose") === 0 ? ((tiers.find(t => t.tier === "loose") || tiers[0]).query)
    : ((tiers.find(t => t.tier === "core") || tiers[0]).query);

  if (!picked.listings.length) {
    return Object.assign(EMPTY_MARKET(usedQuery, "No clean card listings found"), {
      searchQuery: (tightTier ? tightTier.query : tiers[0].query),
      matchQuality: "none", tierUsed: picked.tierUsed, priceNote: picked.note
    });
  }

  return summarizeListings(picked.listings, usedQuery, {
    searchQuery:  usedQuery,
    matchQuality: picked.matchQuality,
    tierUsed:     picked.tierUsed,
    priceNote:    picked.note,
    priceSource:  "eBay active card listings (median, " + picked.tierUsed + ")"
  });
}

// ══════════════════════════════════════════════════════════════
//  THE CARD API — REAL SOLD PRICES
//
//  eBay Browse gives asking prices. This gives what buyers actually
//  paid, including accepted Best Offers, which eBay's own API does
//  not expose. Starter plan: 10,000 records/day, 14-day lookback.
//
//  Budget discipline: ONE request per card, then split raw/graded
//  and per-grade locally from the returned records. Asking for
//  graded and raw separately would double the record spend for the
//  same information. 100 records per scan ≈ 100 uncached scans/day,
//  so the Supabase cache is what keeps this affordable.
// ══════════════════════════════════════════════════════════════

const CARDAPI_KEY      = process.env.CARDAPI_KEY || "";
const CARDAPI_BASE     = "https://thecardapi.com/api/v1/market";
const CARDAPI_LOOKBACK = Number(process.env.CARDAPI_LOOKBACK_DAYS || 14); // Starter = 14
const CARDAPI_LIMIT    = Number(process.env.CARDAPI_LIMIT || 100);
const CACHE_TTL_HOURS  = Number(process.env.SOLD_CACHE_TTL_HOURS || 12);

function cacheKeyFor(query) {
  return normalizeCardQuery(query).toLowerCase().replace(/\s+/g, " ").trim().slice(0, 300);
}

function daysAgoISO(n) {
  const d = new Date(Date.now() - n * 86400000);
  return d.toISOString().slice(0, 10);
}

// Grade buckets from the records themselves — no extra API calls.
function soldGradeBreakdown(records) {
  const buckets = {};
  records.forEach(r => {
    if (!r.grader || r.grade == null) return;
    const g = String(r.grade).trim();
    if (!/^(10|9\.5|9|8\.5|8|7\.5|7)$/.test(g)) return;
    const key = String(r.grader).toUpperCase() + " " + g;
    if (!buckets[key]) buckets[key] = [];
    buckets[key].push(r.price);
  });
  return Object.keys(buckets)
    .filter(k => buckets[k].length >= MIN_GROUP)
    .sort()
    .map(k => ({
      grade:  k,
      count:  buckets[k].length,
      median: median(buckets[k].sort((a, b) => a - b))
    }));
}

function summarizeSold(records, query) {
  const clean = records
    .map(r => ({
      price:       safeNumber(r.price, 0),
      title:       r.title || "",
      saleDate:    r.sale_date || null,
      listingType: r.listing_type || null,
      grader:      r.grader || null,
      grade:       r.grade != null ? String(r.grade) : null,
      printRun:    r.print_run != null ? Number(r.print_run) : null,
      platform:    r.platform || null,
      url:         r.listing_url || null,
      image:       r.thumbnail_url || r.image_url || null,
      confirmed:   r.price_confirmed !== false
    }))
    .filter(r => r.price > 0 && r.confirmed);

  if (!clean.length) {
    return {
      soldCount: 0, soldMedian: 0, soldLow: 0, soldHigh: 0,
      soldRaw: { count: 0, median: 0 }, soldGraded: { count: 0, median: 0 },
      soldGradeBreakdown: [], bestOfferCount: 0, lastSaleDate: null,
      sales: [], query: query, lookbackDays: CARDAPI_LOOKBACK
    };
  }

  const prices = clean.map(r => r.price).sort((a, b) => a - b);
  const graded = clean.filter(r => r.grader && r.grade);
  const raw    = clean.filter(r => !r.grader);
  const rawP   = raw.map(r => r.price).sort((a, b) => a - b);
  const grP    = graded.map(r => r.price).sort((a, b) => a - b);
  const dates  = clean.map(r => r.saleDate).filter(Boolean).sort();

  /* The headline number must describe ONE thing. A raw card is not worth
     the median of raw sales and PSA 10 slabs mixed together — that median
     drifts upward with every slab in the window. When there are enough raw
     sales, they are the headline; the graded side is reported separately. */
  const useRaw   = rawP.length >= MIN_GROUP;
  const headline = useRaw ? rawP : prices;
  const range    = trimmedRange(headline);

  return {
    soldCount:     clean.length,
    soldMedian:    median(headline),
    soldLow:       range.low,
    soldHigh:      range.high,
    soldBasis:     useRaw ? "raw" : "all",
    soldMedianAll: median(prices),
    soldCountUsed: headline.length,
    soldRaw:    { count: raw.length,    median: median(rawP) },
    soldGraded: { count: graded.length, median: median(grP) },
    soldGradeBreakdown: soldGradeBreakdown(clean),
    bestOfferCount: clean.filter(r => r.listingType === "best_offer").length,
    lastSaleDate:   dates.length ? dates[dates.length - 1] : null,
    sales:          clean.slice(0, 12),
    query:          query,
    lookbackDays:   CARDAPI_LOOKBACK
  };
}

async function readSoldCache(key) {
  if (!supabaseAdmin) return null;
  try {
    const { data, error } = await supabaseAdmin
      .from("sold_comps_cache")
      .select("payload,fetched_at")
      .eq("cache_key", key)
      .maybeSingle();
    if (error || !data) return null;
    const ageHours = (Date.now() - new Date(data.fetched_at).getTime()) / 3600000;
    if (ageHours > CACHE_TTL_HOURS) return null;
    return data.payload;
  } catch (e) { return null; }
}

async function writeSoldCache(key, query, payload) {
  if (!supabaseAdmin) return;
  try {
    await supabaseAdmin.from("sold_comps_cache").upsert({
      cache_key:    key,
      query:        query,
      payload:      payload,
      record_count: payload.soldCount || 0,
      fetched_at:   new Date().toISOString()
    }, { onConflict: "cache_key" });
  } catch (e) {}
}

// One row per card per day, kept permanently. This is how CardGauge
// builds its own price history without paying for deep lookback.
async function recordPriceHistory(key, query, sold, askMedian) {
  if (!supabaseAdmin || !sold || !sold.soldCount) return;
  try {
    await supabaseAdmin.from("card_price_history").upsert({
      cache_key:     key,
      card_query:    query,
      sale_date:     new Date().toISOString().slice(0, 10),
      sold_median:   sold.soldMedian || null,
      sold_low:      sold.soldLow || null,
      sold_high:     sold.soldHigh || null,
      sold_count:    sold.soldCount || 0,
      ask_median:    safeNumber(askMedian, 0) || null,
      raw_median:    (sold.soldRaw && sold.soldRaw.median) || null,
      graded_median: (sold.soldGraded && sold.soldGraded.median) || null
    }, { onConflict: "cache_key,sale_date" });
  } catch (e) {}
}

async function fetchSoldComps(query) {
  if (!CARDAPI_KEY) return null;
  const clean = normalizeCardQuery(query);
  if (!clean || clean.length < 4) return null;   // their q needs 4+ chars

  const params = new URLSearchParams({
    q:         clean,
    limit:     String(CARDAPI_LIMIT),
    sort:      "date_desc",
    date_from: daysAgoISO(CARDAPI_LOOKBACK)
  });

  try {
    const r = await fetch(CARDAPI_BASE + "/sales?" + params.toString(), {
      headers: { "x-market-api-key": CARDAPI_KEY }
    });

    if (r.status === 429) {
      console.log("[cardapi] daily record limit reached — serving asks only");
      return { rateLimited: true };
    }
    if (r.status === 401) { console.log("[cardapi] bad API key"); return null; }
    if (!r.ok) { console.log("[cardapi] HTTP " + r.status); return null; }

    const remaining = r.headers.get("x-ratelimit-remaining");
    const body = await r.json();
    const recs = Array.isArray(body.data) ? body.data : [];
    const out  = summarizeSold(recs, clean);
    out.recordsUsed = recs.length;
    out.budgetLeft  = remaining != null ? Number(remaining) : null;
    return out;
  } catch (e) {
    console.log("[cardapi] error:", e.message);
    return null;
  }
}

// Cache-first sold lookup. askMedian is passed in only so the history
// row can store the ask and the sold side from the same moment.
async function getSoldComps(query, askMedian) {
  if (!CARDAPI_KEY) return null;
  const key = cacheKeyFor(query);
  if (!key) return null;

  const hit = await readSoldCache(key);
  if (hit) { hit.cached = true; return hit; }

  const fresh = await fetchSoldComps(query);
  if (!fresh || fresh.rateLimited) return fresh;

  fresh.cached = false;
  await writeSoldCache(key, fresh.query, fresh);
  await recordPriceHistory(key, fresh.query, fresh, askMedian);
  return fresh;
}

/* Ask vs sold — the spread nobody else shows. Sellers ask one number,
   buyers pay another; the gap is the whole reason to check comps. */
function askVsSold(askMedian, sold) {
  const ask = safeNumber(askMedian, 0);
  if (!sold || !sold.soldCount || !ask) return null;
  const soldMed = safeNumber(sold.soldMedian, 0);
  if (!soldMed) return null;
  const diff = ask - soldMed;
  const pct  = Math.round((diff / soldMed) * 100);
  let note;
  if (pct >= 10)       note = "Sellers are asking " + pct + "% over what buyers actually pay. Don't pay list price.";
  else if (pct <= -10) note = "Asking prices are " + Math.abs(pct) + "% BELOW recent sales — there may be a deal listed right now.";
  else                 note = "Asking prices are close to what buyers actually pay.";
  return { ask: ask, sold: soldMed, diff: Math.round(diff), pct: pct, note: note };
}

// ── OpenAI scan ────────────────────────────────────────────────
const AI_FALLBACK = (summary) => ({
  cardName: "Unknown Trading Card", player: "Unknown", year: "Unknown",
  set: "Unknown", brand: "Unknown", cardNumber: "Unknown", sport: "Unknown",
  parallel: "", serialNumber: "", isRookie: false, isAutograph: false, isPatch: false,
  gradeCompany: "", gradeValue: "",
  signal: "VERIFY", confidence: "Low", summary
});

async function scanWithOpenAI(frontFile, backFile) {
  if (!process.env.OPENAI_API_KEY) return AI_FALLBACK("OpenAI API key missing.");

  const images = [{ type: "image_url", image_url: { url: fileToDataUrl(frontFile) } }];
  if (backFile) images.push({ type: "image_url", image_url: { url: fileToDataUrl(backFile) } });

  const payload = {
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: "You are an expert trading card identifier. You examine photos of sports cards, Pokemon cards, TCG cards, graded slabs, and sealed product. You return ONLY valid JSON with no markdown, no code fences, and no commentary. You never estimate dollar values." },
      { role: "user", content: [
        { type: "text", text: "Identify this card as precisely as possible. Return ONLY a JSON object with these exact keys: cardName, player, year, brand, set, cardNumber, sport, parallel, serialNumber, isRookie, isAutograph, isPatch, gradeCompany, gradeValue, signal, confidence, summary.\n\nCRITICAL — PARALLEL IDENTIFICATION. Parallels change a card's value by 10x or more, so look carefully before concluding a card is base:\n- Border color is the main tell. Panini Prizm/Select/Optic parallels are named by color: Silver, Red, Blue, Green, Orange, Purple, Gold, Black, Pink, Camo, Mojo, Wave, Hyper, Disco, Shimmer, Ice.\n- Topps Chrome parallels: Refractor, X-Fractor, Prism, Atomic, Sepia, Gold, Orange, Red, SuperFractor, Negative, Speckle.\n- Look for rainbow/foil sheen, cracked-ice texture, sparkle, or a colored border that differs from the base design.\n- Look for serial numbering printed on the front or back, usually small, formatted like 25/99 or /99. Report it exactly as printed in serialNumber.\n- '1/1' or 'One of One' is critical — always report it.\n- If you see a colored border or foil pattern but cannot name the exact parallel, use the color plus the word Parallel, e.g. 'Blue Parallel'.\n- Use an empty string for parallel ONLY if the card is clearly a plain base card.\n\nSET FIELD RULES — IMPORTANT:\n- The 'set' field must be the actual product/subset name as it would appear in an eBay listing title, for example 'Update Series', 'Draft Picks', 'Downtown', 'Kaboom'.\n- If the card is just the base set of the product, return an EMPTY STRING for set. Never return 'Base', 'Base Set', 'Base Rookie', or 'Common' — those words do not appear in listing titles and break the price search.\n\nOTHER RULES:\n- If a back image is provided, TRUST THE BACK for card number, set name, and copyright year — printed text beats inferring from the front design.\n- If the card is in a graded slab, read the label for company, grade, year, player, set, and card number.\n- isRookie, isAutograph, isPatch must be true or false booleans.\n- signal must be one of: GRADE, WATCH, SELL RAW, HOT, VERIFY.\n- confidence must be High, Medium, or Low. Use Low if the image is blurry or you are unsure about the parallel.\n- Never guess a dollar value. Never include price fields." },
        ...images
      ]}
    ],
    temperature: 0.1,
    max_tokens: 700
  };

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  const rawText = await response.text();
  if (!response.ok) {
    console.error("OpenAI error:", rawText);
    return AI_FALLBACK("AI could not identify this card.");
  }

  const apiData = JSON.parse(rawText);
  const content = apiData?.choices?.[0]?.message?.content || "";
  try {
    return JSON.parse(cleanJsonText(content));
  } catch (error) {
    console.log("AI parse error:", content);
    return AI_FALLBACK("AI result could not be parsed.");
  }
}

// ── /api/dollar-bin ───────────────────────────────────────────
let dollarBinPool = { cats: [], fetchedAt: 0, expires: 0 };
const DOLLAR_BIN_CACHE_HOURS = 6;

const DOLLAR_BIN_QUERIES = [
  { tag: "POKEMON",     query: "Pokemon card holo rare",                emoji: "⚡" },
  { tag: "NBA ROOKIES", query: "NBA rookie card Prizm",                 emoji: "🏀" },
  { tag: "NFL ROOKIES", query: "NFL rookie card Prizm Panini",          emoji: "🏈" },
  { tag: "MLB ROOKIES", query: "MLB rookie card Topps Chrome",          emoji: "⚾" },
  { tag: "VINTAGE",     query: "vintage baseball card 1980s",           emoji: "📜" },
  { tag: "REFRACTORS",  query: "Topps Chrome refractor rookie",         emoji: "✨" },
];

const REASONS_BY_CATEGORY = {
  "POKEMON": [
    "Holo rare under $5 — cheap PSA candidate",
    "Low-cost way into a popular set",
    "Collectors hunt these to finish a set",
    "Cheap now — older sets dry up fast"
  ],
  "NBA ROOKIES": [
    "Rookie card — real upside if he breaks out",
    "Cheap rookie, low risk, high ceiling",
    "Prospect card before the hype hits",
    "Rookie-year card at a throwaway price"
  ],
  "NFL ROOKIES": [
    "Rookie card — upside if he produces",
    "Cheap rookie, low downside",
    "Get in before a breakout season",
    "Rookie-year card priced like a common"
  ],
  "MLB ROOKIES": [
    "Rookie card — prospect upside",
    "Cheap now, before he fully arrives",
    "Low-cost shot on a future star",
    "Rookie-year card at a bargain"
  ],
  "VINTAGE": [
    "1980s vintage — clean copies appreciate",
    "Old stock, low price — long hold",
    "Vintage — condition can surprise you",
    "Pre-1990 card with collector demand"
  ],
  "REFRACTORS": [
    "Refractor parallel — scarcer than base",
    "Chrome shine collectors pay up for",
    "Parallel under $5 — undervalued",
    "Refractor RC — cheap parallel of a prospect"
  ]
};

const REASONS_FALLBACK = [
  "Low-cost card with collector demand",
  "Cheap entry — flip or hold",
  "Bargain-bin find with upside",
  "Underpriced for the category"
];

function pickReason(category, title) {
  const pool = REASONS_BY_CATEGORY[category] || REASONS_FALLBACK;
  const s = String(title || "");
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return pool[Math.abs(h) % pool.length];
}

function pickUpside(price) {
  if (price < 2)   return "WILD";
  if (price < 3.5) return "MID";
  return "LOW";
}

function dbIsGraded(title) {
  const t = " " + String(title || "").toLowerCase() + " ";
  if (t.includes("graded") || t.includes("slab") || t.includes("encased")) return true;
  return /\b(psa|bgs|bvg|cgc|sgc|hga|gma|csg)\b/.test(t);
}

function buildDollarBinResponse(cats, fetchedAt) {
  const queues = cats.map(arr => [...arr].sort(() => Math.random() - 0.5));
  const mixed = [];
  let progressed = true;
  while (mixed.length < 24 && progressed) {
    progressed = false;
    for (const q of queues) {
      if (q.length) {
        mixed.push(q.shift());
        progressed = true;
        if (mixed.length >= 24) break;
      }
    }
  }
  const cards = mixed.map(card => ({
    ...card,
    upside: pickUpside(card.price),
    reason: pickReason(card.category, card.title)
  }));
  return {
    success:     true,
    cards,
    count:       cards.length,
    refreshed:   new Date(fetchedAt).toISOString(),
    nextRefresh: new Date(fetchedAt + DOLLAR_BIN_CACHE_HOURS * 3600 * 1000).toISOString()
  };
}

async function fetchDollarBinCategory(category) {
  try {
    const token = await getEbayToken();
    if (!token) return [];

    const params = new URLSearchParams({
      q: category.query,
      filter: "price:[..5],priceCurrency:USD",
      limit: "30",
      sort: "newlyListed"
    });
    const url = `https://api.ebay.com/buy/browse/v1/item_summary/search?${params.toString()}`;

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        "X-EBAY-C-MARKETPLACE-ID": "EBAY_US",
        "Content-Type": "application/json"
      }
    });

    const data = await response.json();
    const rawItems = Array.isArray(data.itemSummaries) ? data.itemSummaries : [];

    return rawItems
      .filter(item => isLikelyCardListing(item.title))
      .filter(item => !dbIsGraded(item.title))
      .filter(item => item.image && item.image.imageUrl)
      .map(item => ({
        title:    item.title || "",
        price:    safeNumber(item.price && item.price.value, 0),
        image:    item.image.imageUrl,
        url:      addAffiliateToUrl(item.itemWebUrl || ""),
        category: category.tag,
        emoji:    category.emoji
      }))
      .filter(item => item.price > 0 && item.price <= 5);
  } catch (error) {
    console.log(`Dollar bin fetch error for ${category.tag}:`, error.message);
    return [];
  }
}

app.get("/api/dollar-bin", async (req, res) => {
  try {
    if (dollarBinPool.cats.length && Date.now() < dollarBinPool.expires) {
      return res.json(buildDollarBinResponse(dollarBinPool.cats, dollarBinPool.fetchedAt));
    }

    const results = await Promise.all(
      DOLLAR_BIN_QUERIES.map(cat => fetchDollarBinCategory(cat))
    );

    const cats = results.map(items => items.slice(0, 20)).filter(arr => arr.length);

    if (!cats.length) {
      return res.status(503).json({ success: false, error: "No cards available right now", cards: [] });
    }

    const now = Date.now();
    dollarBinPool = {
      cats,
      fetchedAt: now,
      expires:   now + DOLLAR_BIN_CACHE_HOURS * 3600 * 1000
    };

    res.json(buildDollarBinResponse(cats, now));
  } catch (error) {
    console.error("Dollar bin error:", error);
    res.status(500).json({
      success: false,
      error:   "Dollar bin lookup failed",
      details: error.message
    });
  }
});

// ── /api/card-market ───────────────────────────────────────────
app.get("/api/card-market", async (req, res) => {
  try {
    const query = req.query.query || req.query.cardName;
    if (!query) return res.status(400).json({ success: false, error: "Query required" });

    const market = await getEbayCardMarket(query);
    const clean  = normalizeCardQuery(query);
    const sold   = await getSoldComps(clean, market.avgPrice);

    res.json({
      success:           true,
      cardName:          clean,
      searchQuery:       clean,
      sold:              sold || null,
      askVsSold:         askVsSold(market.avgPrice, sold),
      avgPrice:          market.avgPrice,
      avgSoldPrice:      market.avgPrice,
      lowPrice:          market.lowPrice,
      highPrice:         market.highPrice,
      listingCount:      market.listingCount,
      soldCount:         0,
      image:             market.image,
      priceSource:       market.priceSource,
      spreadRatio:       market.spreadRatio,
      wideSpread:        market.wideSpread,
      matchQuality:      market.matchQuality || (market.listingCount ? "exact" : "none"),
      priceNote:         market.priceNote  || (market.listingCount ? "" : "No clean card listings found."),
      raw:               market.raw,
      graded:            market.graded,
      gradeBreakdown:    market.gradeBreakdown,
      listings:          market.listings,
      soldCompsUrl:      ebayUrl(clean, true),
      activeListingsUrl: ebayUrl(clean, false)
    });
  } catch (error) {
    res.status(500).json({ success: false, error: "Card market lookup failed", details: error.message });
  }
});

// ── /api/card-price ────────────────────────────────────────────
app.get("/api/card-price", async (req, res) => {
  try {
    const cardName = req.query.cardName;
    if (!cardName) return res.status(400).json({ success: false, error: "Card name required" });

    const market = await getEbayCardMarket(cardName);
    const clean  = normalizeCardQuery(cardName);

    res.json({
      success:           true,
      cardName:          clean,
      searchQuery:       clean,
      avgSoldPrice:      market.avgPrice,
      avgPrice:          market.avgPrice,
      lowPrice:          market.lowPrice,
      highPrice:         market.highPrice,
      listingCount:      market.listingCount,
      soldCount:         0,
      image:             market.image,
      priceSource:       market.priceSource,
      spreadRatio:       market.spreadRatio,
      wideSpread:        market.wideSpread,
      matchQuality:      market.matchQuality || (market.listingCount ? "exact" : "none"),
      priceNote:         market.priceNote || "",
      raw:               market.raw,
      graded:            market.graded,
      gradeBreakdown:    market.gradeBreakdown,
      listings:          market.listings,
      soldCompsUrl:      ebayUrl(clean, true),
      activeListingsUrl: ebayUrl(clean, false)
    });
  } catch (error) {
    res.status(500).json({ success: false, error: "Price lookup failed", details: error.message });
  }
});

// ── /api/scan-card ─────────────────────────────────────────────
app.post(
  "/api/scan-card",
  upload.fields([{ name: "front", maxCount: 1 }, { name: "back", maxCount: 1 }]),
  async (req, res) => {
    try {
      const front = req.files?.front?.[0] || null;
      const back  = req.files?.back?.[0]  || null;

      if (!front) return res.status(400).json({ success: false, error: "Front image required" });

      const ai = await scanWithOpenAI(front, back);

      const cleanCardName = buildDisplayName(ai);
      const market        = await getCardMarketForCard(ai);
      const searchQuery   = market.searchQuery || buildCardQuery(ai) || cleanCardName;
      const sold          = await getSoldComps(searchQuery, market.avgPrice);

      console.log(
        "[scan] " + cleanCardName +
        " | parallel=" + (ai.parallel || "-") +
        " | serial=" + (ai.serialNumber || "-") +
        " | q=" + searchQuery +
        " | tier=" + (market.tierUsed || "-") +
        " | match=" + (market.matchQuality || "-") +
        " | n=" + market.listingCount +
        " | ask=$" + market.avgPrice +
        " | sold=$" + (sold && sold.soldMedian ? sold.soldMedian : "-") +
        " (" + (sold ? sold.soldCount : 0) + " sales" + (sold && sold.cached ? ", cached" : "") + ")"
      );

      return res.json({
        success:           true,
        cardName:          cleanCardName || "Unknown Trading Card",
        player:            ai.player     || "Unknown",
        year:              ai.year       || "Unknown",
        set:               ai.set        || "Unknown",
        brand:             ai.brand      || "Unknown",
        cardNumber:        ai.cardNumber || "Unknown",
        sport:             ai.sport      || "Unknown",
        parallel:          ai.parallel      || "",
        serialNumber:      ai.serialNumber  || "",
        isRookie:          !!ai.isRookie,
        isAutograph:       !!ai.isAutograph,
        isPatch:           !!ai.isPatch,
        searchQuery:       searchQuery,
        sold:              sold || null,
        askVsSold:         askVsSold(market.avgPrice, sold),
        matchQuality:      market.matchQuality || "exact",
        tierUsed:          market.tierUsed     || "",
        priceNote:         market.priceNote    || "",
        signal:            ai.signal     || "VERIFY",
        confidence:        ai.confidence || "Medium",
        summary:           ai.summary    || "AI scan complete. Verify exact version, condition, and comps.",
        avgSoldPrice:      market.avgPrice,
        avgPrice:          market.avgPrice,
        lowPrice:          market.lowPrice,
        highPrice:         market.highPrice,
        listingCount:      market.listingCount,
        soldCount:         0,
        image:             market.image,
        priceSource:       market.priceSource,
        spreadRatio:       market.spreadRatio,
        wideSpread:        market.wideSpread,
        raw:               market.raw,
        graded:            market.graded,
        gradeBreakdown:    market.gradeBreakdown,
        listings:          market.listings,
        soldCompsUrl:      ebayUrl(searchQuery, true),
        activeListingsUrl: ebayUrl(searchQuery, false),
        timestamp:         Date.now()
      });
    } catch (error) {
      console.error("Scan server error:", error);
      return res.status(500).json({ success: false, error: "Scanner failed on server", details: error.message });
    }
  }
);

// ── /api/sold-comps ────────────────────────────────────────────
// Sold prices on their own, for the frontends to call after a manual
// search correction without re-running the whole scan.
app.get("/api/sold-comps", async (req, res) => {
  try {
    const query = req.query.query || req.query.cardName;
    if (!query) return res.status(400).json({ success: false, error: "Query required" });
    if (!CARDAPI_KEY) {
      return res.json({ success: true, available: false,
        error: "Sold data not configured", sold: null, askVsSold: null });
    }
    const market = await getEbayCardMarket(query);
    const sold   = await getSoldComps(query, market.avgPrice);
    res.json({
      success:   true,
      available: !!(sold && !sold.rateLimited),
      query:     normalizeCardQuery(query),
      cacheKey:  cacheKeyFor(query),
      askMedian: market.avgPrice,
      sold:      sold || null,
      askVsSold: askVsSold(market.avgPrice, sold)
    });
  } catch (error) {
    res.status(500).json({ success: false, error: "Sold comps lookup failed", details: error.message });
  }
});

// ── /api/price-history ─────────────────────────────────────────
// Reads back the daily rollups CardGauge has been storing itself.
app.get("/api/price-history", async (req, res) => {
  try {
    const query = req.query.query || req.query.cardName;
    if (!query) return res.status(400).json({ success: false, error: "Query required" });
    if (!supabaseAdmin) return res.json({ success: true, points: [], note: "History not configured" });

    const key  = cacheKeyFor(query);
    const days = Math.max(1, Math.min(Number(req.query.days || 90), 3650));
    const { data, error } = await supabaseAdmin
      .from("card_price_history")
      .select("sale_date,sold_median,sold_count,ask_median,raw_median,graded_median")
      .eq("cache_key", key)
      .gte("sale_date", daysAgoISO(days))
      .order("sale_date", { ascending: true });

    if (error) throw new Error(error.message);
    res.json({ success: true, cacheKey: key, query: normalizeCardQuery(query),
               days: days, points: data || [] });
  } catch (error) {
    res.status(500).json({ success: false, error: "History lookup failed", details: error.message });
  }
});

// ── /api/cardapi-status ────────────────────────────────────────
app.get("/api/cardapi-status", async (req, res) => {
  if (!CARDAPI_KEY) return res.json({ success: true, configured: false });
  try {
    const r = await fetch(CARDAPI_BASE + "/sales?q=topps+chrome&limit=1", {
      headers: { "x-market-api-key": CARDAPI_KEY }
    });
    res.json({
      success:    true,
      configured: true,
      ok:         r.ok,
      status:     r.status,
      limit:      r.headers.get("x-ratelimit-limit"),
      remaining:  r.headers.get("x-ratelimit-remaining"),
      lookbackDays: CARDAPI_LOOKBACK,
      cacheTtlHours: CACHE_TTL_HOURS
    });
  } catch (e) {
    res.json({ success: false, configured: true, error: e.message });
  }
});

// ── /api/vs-market ─────────────────────────────────────────────
const VS_MARKET_DOLLARS    = 100;
const VS_MARKET_START_DATE = "2026-05-17";
const VS_MARKET_CACHE_MIN  = 15;

const VS_MARKET_MATCHUPS = [
  {
    id: "aapl-ohtani",
    stockSymbol: "AAPL", stockLabel: "Apple",
    cardLabel: "2018 Topps Update Shohei Ohtani RC",
    cardQuery: "2018 Topps Update Shohei Ohtani rookie RC US285",
    stockStart: 300.23, cardStart: 565
  },
  {
    id: "nke-luka",
    stockSymbol: "NKE", stockLabel: "Nike",
    cardLabel: "2018-19 Panini Prizm Luka Doncic RC",
    cardQuery: "2018-19 Panini Prizm Luka Doncic rookie RC 280",
    stockStart: 41.88, cardStart: 367
  },
  {
    id: "dis-charizard",
    stockSymbol: "DIS", stockLabel: "Disney",
    cardLabel: "Pokemon Charizard VMAX Champion's Path",
    cardQuery: "Pokemon Charizard VMAX Champions Path 074/073",
    stockStart: 102.72, cardStart: 156
  },
  {
    id: "nvda-mahomes",
    stockSymbol: "NVDA", stockLabel: "Nvidia",
    cardLabel: "2017 Panini Prizm Patrick Mahomes RC",
    cardQuery: "2017 Panini Prizm Patrick Mahomes rookie RC 269",
    stockStart: 225.32, cardStart: 2579
  },
  {
    id: "spy-griffey",
    stockSymbol: "SPY", stockLabel: "S&P 500 (SPY)",
    cardLabel: "1989 Upper Deck Ken Griffey Jr RC",
    cardQuery: "1989 Upper Deck Ken Griffey Jr rookie RC 1",
    stockStart: 739.17, cardStart: 447
  }
];

let vsMarketCache = { data: null, expires: 0 };

async function getStockQuote(symbol) {
  try {
    const key = process.env.FINNHUB_API_KEY;
    if (!key) return { symbol, price: 0, ok: false, note: "Missing FINNHUB_API_KEY in Render" };
    const r = await fetch(
      `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(symbol)}&token=${key}`
    );
    const d = await r.json();
    const price = safeNumber(d && d.c, 0);
    if (!price) return { symbol, price: 0, ok: false, note: "No price (check symbol / key / rate limit)" };
    return { symbol, price, ok: true, note: "" };
  } catch (e) {
    return { symbol, price: 0, ok: false, note: e.message };
  }
}

app.get("/api/vs-market", async (req, res) => {
  try {
    if (vsMarketCache.data && Date.now() < vsMarketCache.expires) {
      return res.json(vsMarketCache.data);
    }

    const rows = await Promise.all(
      VS_MARKET_MATCHUPS.map(async (m) => {
        const [stockQ, cardM] = await Promise.all([
          getStockQuote(m.stockSymbol),
          getEbayCardMarket(m.cardQuery)
        ]);
        const stockNow = stockQ.price;
        const cardNow  = safeNumber(cardM.avgPrice, 0);

        const row = {
          id: m.id,
          stock: {
            symbol: m.stockSymbol, label: m.stockLabel,
            priceNow: stockNow, ok: stockQ.ok, note: stockQ.note || ""
          },
          card: {
            label: m.cardLabel, query: cardM.query,
            priceNow: cardNow, listings: cardM.listingCount, image: cardM.image
          }
        };

        if (m.stockStart && m.cardStart) {
          const stockPct = stockNow ? +(((stockNow / m.stockStart) - 1) * 100).toFixed(1) : 0;
          const cardPct  = cardNow  ? +(((cardNow  / m.cardStart ) - 1) * 100).toFixed(1) : 0;
          row.stock.start = m.stockStart;
          row.card.start  = m.cardStart;
          row.stock.pct   = stockPct;
          row.card.pct    = cardPct;
          row.stock.value = +(VS_MARKET_DOLLARS * (stockNow / m.stockStart)).toFixed(2);
          row.card.value  = +(VS_MARKET_DOLLARS * (cardNow  / m.cardStart )).toFixed(2);
          row.leader = cardPct > stockPct ? "card" : stockPct > cardPct ? "stock" : "tie";
        }
        return row;
      })
    );

    const anchored = VS_MARKET_MATCHUPS.every(m => m.stockStart && m.cardStart);
    let payload;

    if (anchored) {
      let cardWins = 0, stockWins = 0;
      rows.forEach(r => {
        if (r.leader === "card") cardWins++;
        else if (r.leader === "stock") stockWins++;
      });
      payload = {
        success: true,
        mode: "SCOREBOARD",
        dollars: VS_MARKET_DOLLARS,
        startDate: VS_MARKET_START_DATE,
        tally: {
          cardWins, stockWins,
          leader: cardWins > stockWins ? "Cards"
                : stockWins > cardWins ? "Wall Street" : "Tied"
        },
        matchups: rows,
        updated: new Date().toISOString()
      };
    } else {
      payload = {
        success: true,
        mode: "CAPTURE",
        note: "Anchors not set yet. These are today's live prices.",
        captureBlock: rows.map(r => ({
          id: r.id,
          stockStart: r.stock.priceNow,
          cardStart:  r.card.priceNow
        })),
        matchups: rows,
        updated: new Date().toISOString()
      };
    }

    vsMarketCache = { data: payload, expires: Date.now() + VS_MARKET_CACHE_MIN * 60 * 1000 };
    res.json(payload);
  } catch (error) {
    console.error("vs-market error:", error);
    res.status(500).json({ success: false, error: "vs-market failed", details: error.message });
  }
});

// ── WATCHLIST DAILY PRICE REFRESH ──────────────────────────────
const cron = require("node-cron");
const { createClient } = require("@supabase/supabase-js");

let supabaseAdmin = null;
if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
  supabaseAdmin = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
  );
  console.log("Supabase admin client ready for watchlist refresh");
} else {
  console.log("Supabase env vars missing — watchlist refresh disabled");
}

async function refreshWatchlistPrices() {
  if (!supabaseAdmin) {
    console.log("[watchlist-refresh] skipped — no Supabase client");
    return;
  }

  const startTime = Date.now();
  console.log("[watchlist-refresh] starting…");

  try {
    const { data: items, error } = await supabaseAdmin
      .from("watchlist_items")
      .select("id, card_name");

    if (error) {
      console.error("[watchlist-refresh] fetch error:", error.message);
      return;
    }

    if (!items || !items.length) {
      console.log("[watchlist-refresh] no cards to refresh");
      return;
    }

    console.log(`[watchlist-refresh] refreshing ${items.length} cards…`);

    let updated = 0;
    let failed = 0;

    for (const item of items) {
      try {
        const market = await getEbayCardMarket(item.card_name);
        const newPrice = safeNumber(market.avgPrice, 0);

        const { error: updateError } = await supabaseAdmin
          .from("watchlist_items")
          .update({
            current_price: newPrice,
            last_checked_at: new Date().toISOString()
          })
          .eq("id", item.id);

        if (updateError) {
          console.error(`[watchlist-refresh] update failed for ${item.id}:`, updateError.message);
          failed++;
        } else {
          updated++;
        }

        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (e) {
        console.error(`[watchlist-refresh] error on card ${item.id}:`, e.message);
        failed++;
      }
    }

    const elapsed = Math.round((Date.now() - startTime) / 1000);
    console.log(`[watchlist-refresh] done. updated=${updated} failed=${failed} elapsed=${elapsed}s`);
  } catch (e) {
    console.error("[watchlist-refresh] fatal error:", e.message);
  }
}

cron.schedule("0 4 * * *", refreshWatchlistPrices, {
  timezone: "America/New_York"
});
console.log("Watchlist daily refresh scheduled for 4:00 AM ET");

app.get("/api/refresh-watchlist", async (req, res) => {
  if (!process.env.REFRESH_SECRET || req.query.key !== process.env.REFRESH_SECRET) {
    return res.status(403).json({ success: false, error: "Forbidden" });
  }
  res.json({ success: true, message: "Refresh started — check server logs" });
  refreshWatchlistPrices();
});

app.use((req, res) => {
  res.status(404).json({ success: false, error: "Endpoint not found" });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`CardGauge backend running on port ${PORT}`);
  console.log(`eBay EPN affiliate active — campid: ${EPN_CAMPAIGN_ID}`);
});
