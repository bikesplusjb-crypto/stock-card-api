/* ===============================
   CARDGAUGE / TRACK THE MARKET
   AI SCANNER + EBAY CARD MARKET BACKEND
   server.js — eBay EPN Affiliate v2
   v2026.06.02 — 15 matchups + hot/cold + pokemon auto-refresh
   v2026.06.12 — hot/cold refresh now auto-updates direction from price movement
================================ */

const express = require("express");
const cors = require("cors");
const multer = require("multer");
const fetch = require("node-fetch");

const app = express();

app.use(cors({ origin: "*" }));
app.use(express.json({ limit: "25mb" }));
app.use(express.urlencoded({ extended: true }));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 }
});

const EPN_CAMPAIGN_ID = "5339149252";

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

let ebayToken = null;
let ebayTokenExpires = 0;

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

async function getEbayCardMarket(query) {
  try {
    const token = await getEbayToken();
    const cleanQuery = normalizeCardQuery(query);

    if (!token || !cleanQuery) {
      return {
        query: cleanQuery, avgPrice: 0, lowPrice: 0, highPrice: 0,
        listingCount: 0, image: "", priceSource: "Missing eBay token or query", listings: []
      };
    }

    const url =
      "https://api.ebay.com/buy/browse/v1/item_summary/search?q=" +
      encodeURIComponent(cleanQuery) + "&limit=25";

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        "X-EBAY-C-MARKETPLACE-ID": "EBAY_US",
        "Content-Type": "application/json"
      }
    });

    const data = await response.json();
    const rawItems = Array.isArray(data.itemSummaries) ? data.itemSummaries : [];

    const listings = rawItems
      .filter(item => isLikelyCardListing(item.title))
      .map(item => ({
        title:    item.title || "",
        price:    safeNumber(item.price && item.price.value, 0),
        currency: item.price && item.price.currency ? item.price.currency : "USD",
        image:    item.image && item.image.imageUrl ? item.image.imageUrl : "",
        url:      addAffiliateToUrl(item.itemWebUrl || "")
      }))
      .filter(item => item.price > 0);

    const prices = listings.map(item => item.price).sort((a, b) => a - b);

    return {
      query:        cleanQuery,
      avgPrice:     average(prices),
      lowPrice:     prices.length ? Math.round(prices[0]) : 0,
      highPrice:    prices.length ? Math.round(prices[prices.length - 1]) : 0,
      listingCount: listings.length,
      image:        listings.find(x => x.image)?.image || "",
      priceSource:  listings.length ? "eBay active card listings" : "No clean card listings found",
      listings
    };
  } catch (error) {
    console.log("eBay card market error:", error.message);
    return {
      query, avgPrice: 0, lowPrice: 0, highPrice: 0,
      listingCount: 0, image: "", priceSource: "eBay lookup failed", listings: []
    };
  }
}

async function scanWithOpenAI(frontFile, backFile) {
  if (!process.env.OPENAI_API_KEY) {
    return {
      cardName: "Unknown Trading Card", player: "Unknown", year: "Unknown",
      set: "Unknown", brand: "Unknown", cardNumber: "Unknown", sport: "Unknown",
      signal: "VERIFY", confidence: "Low", summary: "OpenAI API key missing."
    };
  }

  const images = [
    { type: "image_url", image_url: { url: fileToDataUrl(frontFile), detail: "high" } }
  ];
  if (backFile) {
    images.push({ type: "image_url", image_url: { url: fileToDataUrl(backFile), detail: "high" } });
  }

  const systemPrompt = `You are an expert trading card identifier. You analyze photos of sports cards, Pokemon cards, Magic: The Gathering cards, Disney Lorcana cards, and other collectible cards.

YOUR JOB: Read the text and visual elements on the card and extract structured information. Be precise. NEVER guess.

HONESTY RULE — THIS IS CRITICAL:
If you cannot clearly read a piece of information from the card image, you MUST return "Unknown" for that field. Do NOT invent, guess, or fill in plausible-sounding values. Returning "Unknown" is correct and expected when text is unreadable, blurry, obscured, or missing. A confident wrong answer is worse than admitting you don't know.

INSPECTION METHODOLOGY — examine the card in this order:
1. Card type: Is this a sports card (baseball/basketball/football/soccer/hockey), Pokemon card, Magic card, Lorcana card, or other?
2. Brand/manufacturer: Look at the logo, usually in a corner. Common brands:
   - Sports: Topps, Panini, Bowman, Upper Deck, Fleer, Donruss, Score, Stadium Club, Select, Prizm, Optic, Chrome, Heritage, Allen & Ginter
   - Pokemon: "Pokemon" + set symbol (Base Set, Jungle, Fossil, Sword & Shield, Scarlet & Violet, etc.)
   - MTG: Wizards of the Coast / mana symbols in top right
   - Lorcana: Disney Lorcana logo + chapter name
3. Year: Look for copyright text (©2023, ©2024), set release year, or season notation (e.g., "2023-24"). Vintage cards often show year prominently.
4. Player/character name: Usually printed prominently on the card front. For Pokemon, this is the Pokemon name. For Lorcana, the character name + version.
5. Card number: Usually small text at the bottom of the card or back. Format examples: "1 of 100", "#45", "045/204", "RC-12"
6. Set name: Often printed near the card number or in a banner (e.g., "Topps Chrome", "Prizm Premier League", "Sword & Shield: Brilliant Stars")
7. Parallel/variant: If visible, note "refractor", "holo", "rainbow", "gold", "rookie card / RC", "alt art", etc.

OUTPUT REQUIREMENTS:
Return ONLY valid JSON. No markdown, no code fences, no preamble. Just the JSON object.

Required fields:
- cardName: Full descriptive name combining year + brand + player + parallel (or "Unknown Trading Card" if you cannot identify)
- player: Player or character name, or "Unknown"
- year: 4-digit year as a string (e.g., "2017", "1999"), or "Unknown"
- set: Set name (e.g., "Prizm", "Base Set Shadowless"), or "Unknown"
- brand: Manufacturer (e.g., "Topps", "Panini", "Pokemon"), or "Unknown"
- cardNumber: Card number as printed, or "Unknown"
- sport: One of "Baseball", "Basketball", "Football", "Soccer", "Hockey", "Pokemon", "Magic", "Lorcana", "Other", or "Unknown"
- signal: One of "GRADE", "WATCH", "SELL RAW", "HOT", "VERIFY". Default to "VERIFY" for low-confidence identifications.
- confidence: One of "High", "Medium", "Low" — based on YOUR ability to read the card clearly
- summary: One sentence describing what you see. Be honest about uncertainty.

NEVER include price estimates in any field. Pricing is handled separately.`;

  const userPrompt = `Identify this trading card following the inspection methodology in your instructions. Read the text carefully. If something is unclear, return "Unknown" for that field rather than guessing. Return ONLY the JSON object.`;

  const payload = {
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: [
        { type: "text", text: userPrompt },
        ...images
      ]}
    ],
    temperature: 0.1,
    max_tokens: 900,
    response_format: { type: "json_object" }
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
    return {
      cardName: "Unknown Trading Card", player: "Unknown", year: "Unknown",
      set: "Unknown", brand: "Unknown", cardNumber: "Unknown", sport: "Unknown",
      signal: "VERIFY", confidence: "Low", summary: "AI could not identify this card."
    };
  }

  const apiData = JSON.parse(rawText);
  const content = apiData?.choices?.[0]?.message?.content || "";
  try {
    return JSON.parse(cleanJsonText(content));
  } catch (error) {
    console.log("AI parse error:", content);
    return {
      cardName: "Unknown Trading Card", player: "Unknown", year: "Unknown",
      set: "Unknown", brand: "Unknown", cardNumber: "Unknown", sport: "Unknown",
      signal: "VERIFY", confidence: "Low", summary: "AI result could not be parsed."
    };
  }
}

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

app.get("/api/card-market", async (req, res) => {
  try {
    const query = req.query.query || req.query.cardName;
    if (!query) return res.status(400).json({ success: false, error: "Query required" });

    const market = await getEbayCardMarket(query);
    const clean  = normalizeCardQuery(query);

    res.json({
      success:           true,
      cardName:          clean,
      avgPrice:          market.avgPrice,
      avgSoldPrice:      market.avgPrice,
      lowPrice:          market.lowPrice,
      highPrice:         market.highPrice,
      listingCount:      market.listingCount,
      soldCount:         0,
      image:             market.image,
      priceSource:       market.priceSource,
      listings:          market.listings,
      soldCompsUrl:      ebayUrl(clean, true),
      activeListingsUrl: ebayUrl(clean, false)
    });
  } catch (error) {
    res.status(500).json({ success: false, error: "Card market lookup failed", details: error.message });
  }
});

app.get("/api/card-price", async (req, res) => {
  try {
    const cardName = req.query.cardName;
    if (!cardName) return res.status(400).json({ success: false, error: "Card name required" });

    const market = await getEbayCardMarket(cardName);
    const clean  = normalizeCardQuery(cardName);

    res.json({
      success:           true,
      cardName:          clean,
      avgSoldPrice:      market.avgPrice,
      avgPrice:          market.avgPrice,
      lowPrice:          market.lowPrice,
      highPrice:         market.highPrice,
      listingCount:      market.listingCount,
      soldCount:         0,
      image:             market.image,
      priceSource:       market.priceSource,
      listings:          market.listings,
      soldCompsUrl:      ebayUrl(clean, true),
      activeListingsUrl: ebayUrl(clean, false)
    });
  } catch (error) {
    res.status(500).json({ success: false, error: "Price lookup failed", details: error.message });
  }
});

app.post(
  "/api/scan-card",
  upload.fields([{ name: "front", maxCount: 1 }, { name: "back", maxCount: 1 }]),
  async (req, res) => {
    try {
      const front = req.files?.front?.[0] || null;
      const back  = req.files?.back?.[0]  || null;

      if (!front) return res.status(400).json({ success: false, error: "Front image required" });

      const ai = await scanWithOpenAI(front, back);

      const cleanCardName =
        ai.cardName && ai.cardName !== "Unknown Trading Card"
          ? ai.cardName
          : [ai.year, ai.brand, ai.player, ai.set].filter(Boolean).join(" ");

      const market = await getEbayCardMarket(cleanCardName);
      const clean  = normalizeCardQuery(cleanCardName);

      return res.json({
        success:           true,
        cardName:          cleanCardName || "Unknown Trading Card",
        player:            ai.player     || "Unknown",
        year:              ai.year       || "Unknown",
        set:               ai.set        || "Unknown",
        brand:             ai.brand      || "Unknown",
        cardNumber:        ai.cardNumber || "Unknown",
        sport:             ai.sport      || "Unknown",
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
        listings:          market.listings,
        soldCompsUrl:      ebayUrl(clean, true),
        activeListingsUrl: ebayUrl(clean, false),
        timestamp:         Date.now()
      });
    } catch (error) {
      console.error("Scan server error:", error);
      return res.status(500).json({ success: false, error: "Scanner failed on server", details: error.message });
    }
  }
);

const VS_MARKET_DOLLARS    = 100;
const VS_MARKET_START_DATE = "2026-05-17";
const VS_MARKET_CACHE_MIN  = 15;

// ── VS MARKET MATCHUPS — ALL 15 ANCHORED ──────────────────────
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
  },
  {
    id: "tsla-wembanyama",
    stockSymbol: "TSLA", stockLabel: "Tesla",
    cardLabel: "2023-24 Panini Prizm Victor Wembanyama RC",
    cardQuery: "2023-24 Panini Prizm Victor Wembanyama rookie RC 136",
    stockStart: 435.79, cardStart: 401
  },
  {
    id: "amzn-trout",
    stockSymbol: "AMZN", stockLabel: "Amazon",
    cardLabel: "2011 Topps Update Mike Trout RC",
    cardQuery: "2011 Topps Update Mike Trout rookie RC US175",
    stockStart: 270.64, cardStart: 771
  },
  {
    id: "msft-jordan",
    stockSymbol: "MSFT", stockLabel: "Microsoft",
    cardLabel: "1986 Fleer Michael Jordan RC",
    cardQuery: "1986 Fleer Michael Jordan rookie RC 57",
    stockStart: 450.24, cardStart: 10699
  },
  {
    id: "googl-trae",
    stockSymbol: "GOOGL", stockLabel: "Google",
    cardLabel: "2018-19 Panini Prizm Trae Young RC",
    cardQuery: "2018-19 Panini Prizm Trae Young rookie RC 78",
    stockStart: 380.34, cardStart: 63
  },
  {
    id: "meta-lebron",
    stockSymbol: "META", stockLabel: "Meta",
    cardLabel: "2003-04 Topps Chrome LeBron James RC",
    cardQuery: "2003-04 Topps Chrome LeBron James rookie RC 111",
    stockStart: 632.51, cardStart: 6781
  },
  {
    id: "nflx-moonbreon",
    stockSymbol: "NFLX", stockLabel: "Netflix",
    cardLabel: "Pokemon Umbreon VMAX Alt Art (Moonbreon)",
    cardQuery: "Pokemon Umbreon VMAX Evolving Skies 215 alt art",
    stockStart: 86.02, cardStart: 2544
  },
  {
    id: "cost-burrow",
    stockSymbol: "COST", stockLabel: "Costco",
    cardLabel: "2020 Panini Prizm Joe Burrow RC",
    cardQuery: "2020 Panini Prizm Joe Burrow rookie RC 307",
    stockStart: 956.32, cardStart: 173
  },
  {
    id: "wmt-messi",
    stockSymbol: "WMT", stockLabel: "Walmart",
    cardLabel: "2004 Panini Megacracks Lionel Messi RC",
    cardQuery: "2004 Panini Megacracks Lionel Messi rookie 71",
    stockStart: 115.75, cardStart: 22044
  },
  {
    id: "amd-bonds",
    stockSymbol: "AMD", stockLabel: "AMD",
    cardLabel: "1987 Topps Barry Bonds RC",
    cardQuery: "1987 Topps Barry Bonds rookie RC 320",
    stockStart: 516.10, cardStart: 76
  },
  {
    id: "v-jeter",
    stockSymbol: "V", stockLabel: "Visa",
    cardLabel: "1993 SP Derek Jeter Foil RC",
    cardQuery: "1993 SP Derek Jeter Foil rookie RC 279",
    stockStart: 326.36, cardStart: 529
  }
];

let vsMarketCache = { data: null, expires: 0 };

async function getStockQuote(symbol, attempt) {
  attempt = attempt || 1;
  const MAX_ATTEMPTS = 3;
  try {
    const key = process.env.FINNHUB_API_KEY;
    if (!key) return { symbol, price: 0, ok: false, note: "Missing FINNHUB_API_KEY in Render" };
    const r = await fetch(
      `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(symbol)}&token=${key}`
    );
    const d = await r.json();
    const price = safeNumber(d && d.c, 0);
    if (!price && attempt < MAX_ATTEMPTS) {
      await new Promise(res => setTimeout(res, 400 * attempt));
      return getStockQuote(symbol, attempt + 1);
    }
    if (!price) return { symbol, price: 0, ok: false, note: `No price after ${MAX_ATTEMPTS} attempts` };
    return { symbol, price, ok: true, note: attempt > 1 ? `OK on attempt ${attempt}` : "" };
  } catch (e) {
    if (attempt < MAX_ATTEMPTS) {
      await new Promise(res => setTimeout(res, 400 * attempt));
      return getStockQuote(symbol, attempt + 1);
    }
    return { symbol, price: 0, ok: false, note: e.message };
  }
}

async function getEbayCardMarketWithRetry(query, attempt) {
  attempt = attempt || 1;
  const MAX_ATTEMPTS = 3;
  const result = await getEbayCardMarket(query);
  if ((!result.avgPrice || !result.listingCount) && attempt < MAX_ATTEMPTS) {
    await new Promise(res => setTimeout(res, 500 * attempt));
    return getEbayCardMarketWithRetry(query, attempt + 1);
  }
  return result;
}

app.get("/api/vs-market", async (req, res) => {
  try {
    if (vsMarketCache.data && Date.now() < vsMarketCache.expires) {
      return res.json(vsMarketCache.data);
    }

    const rows = await Promise.all(
      VS_MARKET_MATCHUPS.map(async (m, idx) => {
        await new Promise(res => setTimeout(res, idx * 120));

        const [stockQ, cardM] = await Promise.all([
          getStockQuote(m.stockSymbol),
          getEbayCardMarketWithRetry(m.cardQuery)
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
        note: "Anchors not set yet. These are today's live prices. Copy this WHOLE response back to lock the scoreboard.",
        captureBlock: rows.map(r => ({
          id: r.id,
          stockStart: r.stock.priceNow,
          cardStart:  r.card.priceNow
        })),
        matchups: rows,
        updated: new Date().toISOString()
      };
    }

    const allClean = rows.every(r => r.stock.priceNow > 0 && r.card.priceNow > 0);
    if (allClean) {
      vsMarketCache = { data: payload, expires: Date.now() + VS_MARKET_CACHE_MIN * 60 * 1000 };
    } else {
      const failed = rows.filter(r => !r.stock.priceNow || !r.card.priceNow).map(r => r.id);
      console.log(`[vs-market] not caching — ${failed.length} failed: ${failed.join(", ")}`);
    }
    res.json(payload);
  } catch (error) {
    console.error("vs-market error:", error);
    res.status(500).json({ success: false, error: "vs-market failed", details: error.message });
  }
});

// ===========================================================
// SUPABASE ADMIN CLIENT + DAILY REFRESH JOBS
// 3 cron jobs: watchlist (4 AM), hot/cold (5 AM), pokemon (6 AM)
// Spread 1 hour apart to avoid eBay API burst load.
// ===========================================================

const cron = require("node-cron");
const { createClient } = require("@supabase/supabase-js");

let supabaseAdmin = null;
if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
  supabaseAdmin = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
  );
  console.log("Supabase admin client ready for daily refresh jobs");
} else {
  console.log("Supabase env vars missing — refresh jobs disabled");
}

// Verify REFRESH_SECRET is set for manual refresh endpoints
if (process.env.REFRESH_SECRET) {
  console.log("REFRESH_SECRET loaded — manual refresh endpoints active");
} else {
  console.log("⚠️  REFRESH_SECRET missing — manual refresh endpoints will reject ALL requests");
}

// ── WATCHLIST DAILY PRICE REFRESH (4:00 AM ET) ─────────────
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

// ── HOT/COLD CARDS DAILY PRICE REFRESH (5:00 AM ET) ────────
async function refreshHotColdPrices() {
  if (!supabaseAdmin) {
    console.log("[hotcold-refresh] skipped — no Supabase client");
    return;
  }

  const startTime = Date.now();
  console.log("[hotcold-refresh] starting…");

  try {
    const { data: cards, error } = await supabaseAdmin
      .from("hot_cold_cards")
      .select("id, card_name, current_price")
      .eq("is_active", true);

    if (error) {
      console.error("[hotcold-refresh] fetch error:", error.message);
      return;
    }

    if (!cards || !cards.length) {
      console.log("[hotcold-refresh] no cards to refresh");
      return;
    }

    console.log(`[hotcold-refresh] refreshing ${cards.length} cards…`);

    let updated = 0;
    let failed = 0;
    let skipped = 0;

    for (const card of cards) {
      try {
        const market = await getEbayCardMarket(card.card_name);
        const newPrice = safeNumber(market.avgPrice, 0);

        if (newPrice <= 0) {
          console.log(`[hotcold-refresh] skipping ${card.id} (${card.card_name}) — no eBay price`);
          skipped++;
          await new Promise(r => setTimeout(r, 1000));
          continue;
        }

        const oldPrice = safeNumber(card.current_price, 0);
        let pctChange = 0;
        if (oldPrice > 0) {
          pctChange = +(((newPrice - oldPrice) / oldPrice) * 100).toFixed(2);
        }

        // Auto-correct direction from price movement so the Hot/Cold
        // filters stay accurate as prices change. Up (or flat) = hot, down = cold.
        const newDirection = pctChange >= 0 ? "hot" : "cold";

        const { error: updateError } = await supabaseAdmin
          .from("hot_cold_cards")
          .update({
            prev_price: oldPrice,
            current_price: newPrice,
            pct_change: pctChange,
            direction: newDirection,
            updated_at: new Date().toISOString()
          })
          .eq("id", card.id);

        if (updateError) {
          console.error(`[hotcold-refresh] update failed for ${card.id}:`, updateError.message);
          failed++;
        } else {
          updated++;
        }

        await new Promise(r => setTimeout(r, 1000));
      } catch (e) {
        console.error(`[hotcold-refresh] error on card ${card.id}:`, e.message);
        failed++;
      }
    }

    const elapsed = Math.round((Date.now() - startTime) / 1000);
    console.log(`[hotcold-refresh] done. updated=${updated} skipped=${skipped} failed=${failed} elapsed=${elapsed}s`);
  } catch (e) {
    console.error("[hotcold-refresh] fatal error:", e.message);
  }
}

cron.schedule("0 5 * * *", refreshHotColdPrices, {
  timezone: "America/New_York"
});
console.log("Hot/Cold daily refresh scheduled for 5:00 AM ET");

app.get("/api/refresh-hotcold", async (req, res) => {
  if (!process.env.REFRESH_SECRET || req.query.key !== process.env.REFRESH_SECRET) {
    return res.status(403).json({ success: false, error: "Forbidden" });
  }
  res.json({ success: true, message: "Hot/Cold refresh started — check server logs" });
  refreshHotColdPrices();
});

// ── POKEMON ZONE DAILY PRICE REFRESH (6:00 AM ET) ──────────
async function refreshPokemonPrices() {
  if (!supabaseAdmin) {
    console.log("[pokemon-refresh] skipped — no Supabase client");
    return;
  }

  const startTime = Date.now();
  console.log("[pokemon-refresh] starting…");

  try {
    const { data: cards, error } = await supabaseAdmin
      .from("pokemon_cards")
      .select("id, card_name, current_price")
      .eq("is_active", true);

    if (error) {
      console.error("[pokemon-refresh] fetch error:", error.message);
      return;
    }

    if (!cards || !cards.length) {
      console.log("[pokemon-refresh] no cards to refresh");
      return;
    }

    console.log(`[pokemon-refresh] refreshing ${cards.length} cards…`);

    let updated = 0;
    let failed = 0;
    let skipped = 0;

    for (const card of cards) {
      try {
        const market = await getEbayCardMarket(card.card_name);
        const newPrice = safeNumber(market.avgPrice, 0);

        // Skip cards with no eBay price (preserve existing data)
        if (newPrice <= 0) {
          console.log(`[pokemon-refresh] skipping ${card.id} (${card.card_name}) — no eBay price`);
          skipped++;
          await new Promise(r => setTimeout(r, 1000));
          continue;
        }

        // Rotate prev/current and compute pct_change
        const oldPrice = safeNumber(card.current_price, 0);
        let pctChange = 0;
        if (oldPrice > 0) {
          pctChange = +(((newPrice - oldPrice) / oldPrice) * 100).toFixed(2);
        }

        const { error: updateError } = await supabaseAdmin
          .from("pokemon_cards")
          .update({
            prev_price: oldPrice,
            current_price: newPrice,
            pct_change: pctChange,
            updated_at: new Date().toISOString()
          })
          .eq("id", card.id);

        if (updateError) {
          console.error(`[pokemon-refresh] update failed for ${card.id}:`, updateError.message);
          failed++;
        } else {
          updated++;
        }

        await new Promise(r => setTimeout(r, 1000));
      } catch (e) {
        console.error(`[pokemon-refresh] error on card ${card.id}:`, e.message);
        failed++;
      }
    }

    const elapsed = Math.round((Date.now() - startTime) / 1000);
    console.log(`[pokemon-refresh] done. updated=${updated} skipped=${skipped} failed=${failed} elapsed=${elapsed}s`);
  } catch (e) {
    console.error("[pokemon-refresh] fatal error:", e.message);
  }
}

cron.schedule("0 6 * * *", refreshPokemonPrices, {
  timezone: "America/New_York"
});
console.log("Pokemon daily refresh scheduled for 6:00 AM ET");

app.get("/api/refresh-pokemon", async (req, res) => {
  if (!process.env.REFRESH_SECRET || req.query.key !== process.env.REFRESH_SECRET) {
    return res.status(403).json({ success: false, error: "Forbidden" });
  }
  res.json({ success: true, message: "Pokemon refresh started — check server logs" });
  refreshPokemonPrices();
});

app.use((req, res) => {
  res.status(404).json({ success: false, error: "Endpoint not found" });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`CardGauge backend running on port ${PORT}`);
  console.log(`eBay EPN affiliate active — campid: ${EPN_CAMPAIGN_ID}`);
});
