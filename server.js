/* ===============================
   CARDGAUGE / TRACK THE MARKET
   AI SCANNER + EBAY CARD MARKET BACKEND
   server.js — eBay EPN Affiliate v2
   + median pricing + graded/raw split
   + TIERED PARALLEL-AWARE PRICING
   + STRIPE PRO SUBSCRIPTIONS
   + WORD-BOUNDARY BASE FILTER (Aug 10)
================================ */

const express = require("express");
const cors = require("cors");
const multer = require("multer");
const fetch = require("node-fetch");
const crypto = require("crypto");

const app = express();

// ── CORS — allow all origins (fixes Wix iframe fetch) ──────────
app.use(cors({ origin: "*" }));

/* ══════════════════════════════════════════════════════════════
   STRIPE WEBHOOK — CardGauge Pro subscriptions

   MOUNTED HERE ON PURPOSE. Stripe signs the RAW request body.
   express.json() below rewrites the body into an object, and the
   signature then never matches. This route must stay ABOVE
   app.use(express.json(...)) or every webhook fails verification.

   No stripe npm package needed — the signature is an HMAC and
   node's built-in crypto does it in six lines.

   Render env vars required:
     STRIPE_SECRET_KEY          (sk_live_...)
     STRIPE_WEBHOOK_SECRET      (whsec_... — from the Stripe webhook page)
     SUPABASE_URL
     SUPABASE_SERVICE_ROLE_KEY
══════════════════════════════════════════════════════════════ */

const STRIPE_SECRET_KEY     = process.env.STRIPE_SECRET_KEY || "";
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || "";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function verifyStripeSignature(rawBody, sigHeader, secret) {
  if (!sigHeader || !secret) return false;

  let timestamp = null;
  const signatures = [];
  String(sigHeader).split(",").forEach(part => {
    const idx = part.indexOf("=");
    if (idx < 0) return;
    const k = part.slice(0, idx).trim();
    const v = part.slice(idx + 1).trim();
    if (k === "t") timestamp = v;
    if (k === "v1") signatures.push(v);
  });

  if (!timestamp || !signatures.length) return false;

  // Replay protection — reject anything older than 5 minutes.
  const age = Math.abs(Math.floor(Date.now() / 1000) - Number(timestamp));
  if (!Number.isFinite(age) || age > 300) {
    console.log("[stripe] signature timestamp out of range (" + age + "s)");
    return false;
  }

  const expected = crypto
    .createHmac("sha256", secret)
    .update(timestamp + "." + rawBody, "utf8")
    .digest("hex");

  return signatures.some(sig => {
    try {
      return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
    } catch (e) {
      return false;
    }
  });
}

async function stripeGet(path) {
  if (!STRIPE_SECRET_KEY) {
    console.log("[stripe] STRIPE_SECRET_KEY missing — cannot look up " + path);
    return null;
  }
  try {
    const r = await fetch("https://api.stripe.com/v1/" + path, {
      headers: { Authorization: "Bearer " + STRIPE_SECRET_KEY }
    });
    if (!r.ok) {
      console.log("[stripe] GET " + path + " -> HTTP " + r.status);
      return null;
    }
    return await r.json();
  } catch (e) {
    console.log("[stripe] GET error:", e.message);
    return null;
  }
}

/* The canonical email is whatever the user logs into CardGauge with,
   because is_pro() matches the auth token against pro_users.email.
   Stripe's prefilled email is editable at checkout, so it is only a
   fallback — the Supabase user id passed as client_reference_id is
   what makes the match reliable. */
async function emailFromUserId(userId) {
  if (!supabaseAdmin || !userId || !UUID_RE.test(String(userId))) return null;
  try {
    const { data, error } = await supabaseAdmin.auth.admin.getUserById(String(userId));
    if (error || !data || !data.user) return null;
    const email = String(data.user.email || "").trim().toLowerCase();
    return email || null;
  } catch (e) {
    console.log("[stripe] user lookup failed:", e.message);
    return null;
  }
}

async function emailFromCustomer(customerId) {
  if (!customerId) return null;
  const c = await stripeGet("customers/" + customerId);
  if (!c || c.deleted) return null;
  const email = String(c.email || "").trim().toLowerCase();
  return email || null;
}

async function setProStatus(email, active, note) {
  if (!supabaseAdmin) {
    console.log("[stripe] no Supabase client — cannot update pro_users");
    return false;
  }
  if (!email) return false;

  const clean = String(email).trim().toLowerCase();

  try {
    const { data: existing, error: readErr } = await supabaseAdmin
      .from("pro_users")
      .select("id")
      .eq("email", clean)
      .maybeSingle();

    if (readErr) throw new Error(readErr.message);

    if (existing && existing.id) {
      const { error } = await supabaseAdmin
        .from("pro_users")
        .update({ active: active, source: "stripe", note: note || null })
        .eq("id", existing.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabaseAdmin
        .from("pro_users")
        .insert({ email: clean, active: active, source: "stripe", note: note || null });
      if (error) throw new Error(error.message);
    }

    console.log("[stripe] pro_users " + clean + " -> active=" + active);
    return true;
  } catch (e) {
    console.log("[stripe] pro_users write FAILED for " + clean + ":", e.message);
    return false;
  }
}

/* ── THE ONE THING JOINING A CLICK TO A PAYMENT ──────────────
   The binder logs pro_click with the Supabase user id. Stripe fires
   this webhook server-side with no session, no referrer and no idea
   what page anybody was on — so the id is the only thread between the
   two halves of the funnel.

   The webhook already resolves that id, but only to an EMAIL, which it
   writes to pro_users. It never recorded the id itself and never wrote
   to scan_events, so "12 people clicked Pro" and "1 person paid" lived
   in different tables with nothing in common. This writes the payment
   into the same table as the click, keyed the same way.

   Deliberately fire-and-forget, wrapped so nothing here can throw. A
   failure to record analytics must never take down the handler that
   grants somebody the access they just paid for — and the webhook
   must still return 200 or Stripe retries forever. */
async function logProEvent(event, detail) {
  if (!supabaseAdmin) return;
  try {
    await supabaseAdmin.rpc('log_scan_event', {
      p_event:     String(event).slice(0, 40),
      p_card_name: detail ? String(detail).slice(0, 200) : null,
      p_used_back: false,
      p_is_owner:  false
    });
  } catch (e) {
    console.log("[stripe] analytics write failed (ignored):", e.message);
  }
}

app.post(
  "/api/stripe-webhook",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    const raw = Buffer.isBuffer(req.body) ? req.body.toString("utf8") : "";
    const sig = req.headers["stripe-signature"];

    if (!STRIPE_WEBHOOK_SECRET) {
      console.log("[stripe] STRIPE_WEBHOOK_SECRET not set — rejecting webhook");
      return res.status(500).send("webhook secret not configured");
    }

    if (!verifyStripeSignature(raw, sig, STRIPE_WEBHOOK_SECRET)) {
      console.log("[stripe] BAD SIGNATURE — rejected");
      return res.status(400).send("invalid signature");
    }

    let event;
    try {
      event = JSON.parse(raw);
    } catch (e) {
      return res.status(400).send("bad payload");
    }

    const type = event.type || "";
    const obj  = (event.data && event.data.object) || {};

    try {
      if (type === "checkout.session.completed") {
        // Ignore one-off payments — Pro is a subscription.
        if (obj.mode && obj.mode !== "subscription") {
          console.log("[stripe] checkout completed in mode=" + obj.mode + " — ignored");
        } else {
          let email = await emailFromUserId(obj.client_reference_id);
          let via   = "client_reference_id";

          if (!email) {
            email = String(
              (obj.customer_details && obj.customer_details.email) || obj.customer_email || ""
            ).trim().toLowerCase() || null;
            via = "checkout email";
          }
          if (!email && obj.customer) {
            email = await emailFromCustomer(obj.customer);
            via = "stripe customer";
          }

          if (email) {
            await setProStatus(email, true, "Stripe subscribe via " + via);
            /* The id when we have it, so the click and the payment
               join. When Stripe could not give us one, 'unmatched'
               rather than nothing — a payment that cannot be traced
               back is still a payment, and dropping it would understate
               the only number here that is actually revenue. */
            await logProEvent('subscription_paid',
              (via === "client_reference_id" && obj.client_reference_id)
                ? String(obj.client_reference_id) : 'unmatched:' + via);
          } else {
            console.log("[stripe] checkout.session.completed with NO resolvable email — session " + (obj.id || "?"));
          }
        }
      }

      else if (type === "customer.subscription.deleted") {
        const email = await emailFromCustomer(obj.customer);
        if (email) await setProStatus(email, false, "Stripe subscription canceled");
        else console.log("[stripe] cancel event but no email for customer " + obj.customer);
        /* Counted so that "active Pro" can be derived from events rather
           than inferred from a pro_users row — which checkPro()'s
           fail-open behaviour makes unreliable as a source of truth. */
        await logProEvent('subscription_cancelled', email || 'unknown');
      }

      else if (type === "customer.subscription.updated") {
        const status = obj.status || "";
        const email  = await emailFromCustomer(obj.customer);
        if (!email) {
          console.log("[stripe] update event but no email for customer " + obj.customer);
        } else if (status === "active" || status === "trialing") {
          await setProStatus(email, true, "Stripe subscription " + status);
        } else if (status === "canceled" || status === "unpaid" || status === "incomplete_expired") {
          await setProStatus(email, false, "Stripe subscription " + status);
        } else {
          // past_due, incomplete, paused — leave access alone, Stripe is retrying.
          console.log("[stripe] subscription " + status + " for " + email + " — access unchanged");
        }
      }

      else if (type === "invoice.payment_failed") {
        /* Deliberately does NOT revoke access. Stripe retries a failed
           card for about two weeks; if it never clears, Stripe cancels
           the subscription and customer.subscription.deleted fires,
           which is what actually turns Pro off. Killing access on the
           first failed charge punishes people whose card just expired. */
        console.log("[stripe] payment failed for customer " + obj.customer + " — access left ON, Stripe will retry");
      }

      else {
        console.log("[stripe] ignored event: " + type);
      }
    } catch (e) {
      console.error("[stripe] handler error on " + type + ":", e.message);
    }

    // Always 200 once the signature checked out, or Stripe retries forever.
    res.json({ received: true, type: type });
  }
);

// Safe config check — never returns key values, only whether they exist.
app.get("/api/stripe-status", (req, res) => {
  res.json({
    success: true,
    secretKeySet:     !!STRIPE_SECRET_KEY,
    webhookSecretSet: !!STRIPE_WEBHOOK_SECRET,
    supabaseAdmin:    !!supabaseAdmin,
    liveMode:         STRIPE_SECRET_KEY.indexOf("sk_live") === 0,
    ready:            !!(STRIPE_SECRET_KEY && STRIPE_WEBHOOK_SECRET && supabaseAdmin)
  });
});

// ── Body parsers — everything BELOW this line gets parsed JSON ──
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
    .filter(k => buckets[k].length >= MIN_GROUP)
    .sort()
    .map(k => ({
      grade:  k,
      count:  buckets[k].length,
      median: median(buckets[k].sort((a, b) => a - b))
    }));
}

/* How far apart are the listings? A typical ask of $19 with a high ask
   of $300 means the search is matching several different cards, not one.
   Worth telling the user rather than quietly reporting the median.

   4x between the typical ask and the trimmed high is enough to mean the
   search is catching more than one card. Two real examples set this line:
   "topps finest ohtani" ran 15x, "topps chrome judge" ran 4.2x, and both
   were mixing base cards with autos and parallels.

   NOTE: the scanner frontend runs its own spread check against SOLD
   prices at a 3x threshold. The two are independent on purpose — this
   one measures asking prices, that one measures completed sales — but
   if you tune one, look at the other. */
const WIDE_SPREAD_AT = 4;

function spreadRatio(sortedPrices) {
  if (sortedPrices.length < 4) return 0;
  const r = trimmedRange(sortedPrices);
  const m = median(sortedPrices);
  if (!m || !r.low) return 0;
  return r.high / m;
}

/* JUNK STRIPPING — added after the Aug 22 sold-price coverage audit.

   Two concretely-evidenced patterns were killing otherwise-searchable
   queries:

     "2025 ... Brock Bowers #34 CMP116854"          -> 0 sold comps
     "2025 ... Brock Bowers #34"                     -> 51 sold comps
     "2025 ... Brock Bowers #34 white background"    -> 0 sold comps

   CMP116854 is an internal marketplace SKU, not a card identifier —
   thecardapi has never heard of it and the extra token just prevents a
   match. "white background" describes a PHOTO, not a card.

   Deliberately narrow. A card number (#34), a parallel (Refractor), a
   serial (/499) and autograph terminology all look superficially like
   "extra tokens after the player name" too, and stripping too eagerly
   would break exactly the queries this function exists to get right.
   So this only removes:

     1. Internal SKU/cert codes: 3+ letters immediately followed by
        4+ digits, with no space between them (CMP116854, PWCC00219).
        A real card number is never written this way — it's a bare
        number, "#34", or a fraction like "4/102" — so this pattern
        should not collide with anything legitimate.

     2. A short, fixed list of listing-photo/condition phrases that
        describe the LISTING, never the card. Kept deliberately short
        rather than trying to anticipate every possible junk phrase —
        a narrow list that's certainly safe beats a broad one that
        might not be. */
const SKU_CODE_RE = /\b[A-Za-z]{3,}\d{4,}\b/g;
const LISTING_NOISE_PHRASES = [
  "white background", "black background", "no reserve",
  "free shipping", "fast shipping", "ships fast", "ships free",
  "with sleeve", "in sleeve", "top loader", "toploader",
  "penny sleeve", "brand new", "mint condition", "great condition"
];

function stripQueryJunk(q) {
  let out = String(q || "");
  out = out.replace(SKU_CODE_RE, " ");
  LISTING_NOISE_PHRASES.forEach(phrase => {
    const re = new RegExp("\\b" + phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\b", "gi");
    out = out.replace(re, " ");
  });
  return out.replace(/\s+/g, " ").trim();
}

function normalizeCardQuery(query) {
  let q = stripQueryJunk(query);
  q = q.replace(/\s+/g, " ").trim();
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

/* ============================================================
   PARSE A TYPED QUERY INTO FIELDS

   A photo scan returns year, brand, set, player, card number and
   parallel because the AI reads them off the card. A typed search runs
   no AI, so it returned a name and nothing else — and anything saved
   from the search box landed in the binder with six empty columns,
   unsortable and ungroupable.

   This is a parser, not a model. It recognises the shape of a
   well-formed query — "2018 Topps Update Shohei Ohtani RC" — and gives
   up quietly on anything else rather than guessing. A null is honest;
   a wrong player name is worse than no player name, because it will be
   sorted and grouped as if it were true.

   Deliberately NOT attempted: card number. In a typed query "269" could
   be the number, part of a year, or a serial. The scan path gets it from
   the printed card; here it stays null.
   ============================================================ */

/* MANUFACTURERS ONLY.

   An earlier version listed "Topps Chrome" and "Panini Prizm" as brands,
   which produced two records of the same product line that disagreed:
   a typed search stored brand="Topps Chrome", set=null, while a photo
   scan of the same card stored brand="Topps", set="Chrome". Sorting by
   brand then split one product line across two buckets.

   The scan path is the more authoritative of the two — it reads the card
   rather than guessing from a sentence — so the parser follows it.
   Manufacturer in `brand`, product line in `set`. "Topps Chrome" is
   Topps making a set called Chrome, and that is how it is stored. */
const KNOWN_BRANDS = [
  "Upper Deck", "Panini", "Topps", "Bowman", "Donruss", "Fleer",
  "Score", "Leaf", "Pinnacle", "Pok\u00e9mon", "Pokemon"
];

/* Product lines and sets, longest first so "Update Series" is matched
   before a bare "Update" can take half of it.

   Bowman is deliberately in both lists. It is a manufacturer in its own
   right AND a Topps product line, so "2023 Bowman Chrome" resolves to
   brand Bowman / set Chrome, and "2023 Topps Bowman" to brand Topps /
   set Bowman. Whichever appears first wins, which is how people write
   them. */
const KNOWN_SETS = [
  "Update Series", "Stadium Club", "Allen & Ginter", "Gypsy Queen",
  "Opening Day", "Bowman Draft", "Bowman Sterling", "Bowman Chrome",
  "Sword & Shield", "Evolving Skies", "Hidden Fates", "Rebel Clash",
  "Darkness Ablaze", "Champions Path", "Obsidian Flames", "Silver Tempest",
  "Neo Genesis", "Team Rocket", "Base Set",
  "Contenders", "Immaculate", "Heritage", "Finest", "Chrome", "Update",
  "Prizm", "Mosaic", "Optic", "Select", "Bowman", "Jungle", "Fossil",
  "Flawless", "Absolute", "Certified", "Spectra", "Obsidian"
];

/* Words that are never part of a player's name. Grades, conditions,
   marketing terms and the rookie flag all end up in queries. */
const NOT_A_NAME = new RegExp(
  "\\b(rc|rookie|card|cards|psa|bgs|sgc|cgc|tag|ace|graded|slab|slabbed|" +
  "gem|mint|nm|lot|reprint|auto|autograph|patch|parallel|refractor|holo|" +
  "numbered|serial|sp|ssp|variation|insert|base|the)\\b", "gi");

/* Brands and product lines that only ever appear in one sport.

   A typed search has no AI behind it, so sport was always null — and on
   a desktop, typing is the only way in. That left every desktop search
   unable to tell 1986 Topps Baseball (792 cards) from 1986 Topps
   Football (396).

   Only entries where there is genuinely no ambiguity are listed. Topps,
   Panini, Chrome and Prizm are all deliberately ABSENT: they each print
   several sports, and a confident wrong sport is worse than none —
   it would silently hand somebody the wrong set size and look
   authoritative doing it. Roughly a third of searches get an answer;
   the rest stay honestly blank. */
const SPORT_BY_TERM = [
  // Baseball-only products
  ["bowman",           "Baseball"],
  ["heritage",         "Baseball"],
  ["allen & ginter",   "Baseball"],
  ["allen and ginter", "Baseball"],
  ["gypsy queen",      "Baseball"],
  ["stadium club",     "Baseball"],
  ["topps now",        "Baseball"],
  // Trading card games
  ["pokemon",          "Pokemon"],
  ["pok\u00e9mon",      "Pokemon"],
  ["magic the gathering", "Gaming (TCG)"],
  ["yugioh",           "Gaming (TCG)"],
  ["yu-gi-oh",         "Gaming (TCG)"],
  // Sport named outright — people often type it
  ["baseball",         "Baseball"],
  ["basketball",       "Basketball"],
  ["football",         "Football"],
  ["hockey",           "Hockey"],
  ["soccer",           "Soccer"],
  ["wwe",              "Wrestling"],
  ["ufc",              "MMA"],
  ["formula 1",        "Racing"],
  ["nascar",           "Racing"]
];

function sportFromQuery(text) {
  const t = " " + String(text || "").toLowerCase() + " ";
  for (const pair of SPORT_BY_TERM) {
    if (t.indexOf(" " + pair[0]) > -1) return pair[1];
  }
  return null;
}

function parseCardQuery(query) {
  const raw = String(query || "").replace(/\s+/g, " ").trim();
  const out = { year: null, brand: null, set: null, player: null, parallel: null, sport: null };
  if (!raw) return out;

  /* Read the sport off the WHOLE query before anything is stripped out,
     because the word that identifies it is often also the brand. */
  out.sport = sportFromQuery(raw);

  let rest = raw;

  /* Year: a standalone 4-digit number in a plausible range. Bounded so a
     card number like "1987" in "#1987" or a price doesn't become a year —
     the word boundary and the range do most of that work. */
  const ym = rest.match(/\b(18[5-9]\d|19\d\d|20[0-4]\d)\b/);
  if (ym) {
    out.year = parseInt(ym[1], 10);
    rest = rest.replace(ym[0], " ");
  }

  const wordRe = t => new RegExp("\\b" + t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\b", "i");

  /* Manufacturer. */
  for (const b of KNOWN_BRANDS) {
    if (wordRe(b).test(rest)) {
      out.brand = b;
      rest = rest.replace(wordRe(b), " ");
      break;
    }
  }

  /* Product line, longest first. */
  const setsByLength = KNOWN_SETS.slice().sort((a, b) => b.length - a.length);
  for (const st of setsByLength) {
    if (wordRe(st).test(rest)) {
      out.set = st;
      rest = rest.replace(wordRe(st), " ");
      break;
    }
  }

  /* People say "2020 Prizm Herbert" without writing Panini, and "Prizm"
     alone identifies the product perfectly well. Rather than record no
     brand at all, let the set stand in — better a searchable brand than
     an empty column, and it matches how the card is actually referred
     to. */
  if (!out.brand && out.set) out.brand = out.set;

  /* Parallel: reuse the same word lists the ask and sold filters use, so
     "silver prizm" means the same thing everywhere in this file. */
  for (const w of PARALLEL_WORDS) {
    const re = new RegExp("\\b" + w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\b", "i");
    if (re.test(rest)) {
      out.parallel = w.replace(/\b\w/g, c => c.toUpperCase());
      rest = rest.replace(re, " ");
      break;
    }
  }

  /* Whatever survives, minus grades, card numbers and filler, is the
     player. Two words or fewer that are all noise gives nothing rather
     than a fragment. */
  let name = rest
    .replace(NOT_A_NAME, " ")
    .replace(/#\s*[\w/-]+/g, " ")      // #US285, #4/102
    .replace(/\b\d+(\.\d+)?\b/g, " ") // stray numbers and grades
    .replace(/[^A-Za-z\u00C0-\u024F.'\- ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  /* A single letter or an initial isn't a name. Two characters is the
     floor — "Ed" exists, "E" does not. */
  if (name.length >= 2 && /[A-Za-z]{2}/.test(name)) {
    out.player = name.split(" ").slice(0, 4).join(" ");
  }

  return out;
}

/* ── POKEMON SET CODES ────────────────────────────────────────
   Modern Pokemon cards print a three-letter code beside the card
   number. Scans were coming back with set="EVS" instead of "Evolving
   Skies", which breaks two things at once: nobody searches eBay for a
   code, and a checklist lookup will never match one.

   The prompt now asks the model to expand these itself. This table is
   the net for when it doesn't, and it is deliberately incomplete — new
   sets ship several times a year and a table in a file cannot keep up.
   An unrecognised code passes through unchanged rather than being
   discarded: a code is worse than a name but much better than nothing,
   and sellers do sometimes use them in titles.
   ─────────────────────────────────────────────────────────────── */
const POKEMON_SET_CODES = {
  // Scarlet & Violet
  SVI: "Scarlet & Violet", PAL: "Paldea Evolved", OBF: "Obsidian Flames",
  MEW: "151", PAR: "Paradox Rift", PAF: "Paldean Fates",
  TEF: "Temporal Forces", TWM: "Twilight Masquerade", SFA: "Shrouded Fable",
  SCR: "Stellar Crown", SSP: "Surging Sparks",
  // Sword & Shield
  SSH: "Sword & Shield", RCL: "Rebel Clash", DAA: "Darkness Ablaze",
  VIV: "Vivid Voltage", SHF: "Shining Fates", BST: "Battle Styles",
  CRE: "Chilling Reign", EVS: "Evolving Skies", FST: "Fusion Strike",
  BRS: "Brilliant Stars", ASR: "Astral Radiance", LOR: "Lost Origin",
  SIT: "Silver Tempest", CRZ: "Crown Zenith", CPA: "Champion's Path",
  // Sun & Moon
  SUM: "Sun & Moon", GRI: "Guardians Rising", BUS: "Burning Shadows",
  CIN: "Crimson Invasion", UPR: "Ultra Prism", FLI: "Forbidden Light",
  CES: "Celestial Storm", LOT: "Lost Thunder", TEU: "Team Up",
  UNB: "Unbroken Bonds", UNM: "Unified Minds", CEC: "Cosmic Eclipse",
  HIF: "Hidden Fates", SLG: "Shining Legends", DET: "Detective Pikachu"
};

/* A code is 2-4 letters and nothing else. "Base Set" and "Evolving
   Skies" never match; "EVS" and "svi" both do.

   Case-insensitive on purpose. The model usually shouts a code but not
   always, and the risk is nil either way — a value only changes if it
   is found in the table below, so anything that isn't a known code
   passes through untouched regardless of how it was capitalised. */
function looksLikeSetCode(v) {
  return /^[A-Za-z]{2,4}$/.test(String(v || "").trim());
}

/* Decide the set from two inputs the model reports separately: the code
   it READ off the card, and the name it BELIEVES that code means.

   The first version asked the model to expand codes itself, which went
   badly in the way these things always do. Told to expand "whenever you
   can", it met an unfamiliar code and reached for the nearest one it
   knew: PFL came back as "Obsidian Flames" (that is OBF) and ASC as
   "Astral Radiance" (that is ASR). It then moved the YEAR to match the
   wrong set, so a 2025 card was recorded as 2022.

   A confidently wrong set name is worse than an unresolved code. The
   code was honest about being unknown; the name pulls comps for a
   different card and looks authoritative doing it.

   So the model is no longer the authority on this. A code we can name
   gets the name from the table. A code we cannot name stays a code —
   accurate, searchable, and obviously unresolved to anyone looking at
   it. The model's guess is only used when it did not report a code at
   all, which is the case for every sports card and for older Pokemon
   sets that never printed one. */
function resolvePokemonSet(ai) {
  const code  = String((ai && ai.setCode) || "").trim();
  const named = String((ai && ai.set) || "").trim();

  if (!isPokemon(ai)) return named;      // sports abbreviations mean other things

  // The model put a code in the set field itself — older behaviour, still handle it.
  const codeInSet = looksLikeSetCode(named) ? named : "";
  const readCode  = code || codeInSet;

  if (readCode) {
    const known = POKEMON_SET_CODES[readCode.toUpperCase()];
    if (known) return known;
    /* Unknown code. Keep it rather than accepting a name the model may
       have invented to fill the gap — and if the name IS the code, that
       is what we return anyway. */
    return readCode.toUpperCase();
  }

  return named;
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

/* Pokemon needs a much shorter version of that list.

   On a sports card "Base Set" is a description, not a product, and no
   seller types it, so stripping it is correct. In Pokemon, Base Set is
   the NAME of the 1999 set and the most searched set in the hobby.
   Running it through GENERIC_SET turned a 1999 Base Set Charizard into
   "pokemon Charizard 4/102" and blended the original with thirty years
   of reprints. Jungle, Fossil and Team Rocket read as generic for the
   same reason: real set names that sound like descriptions.

   So for Pokemon only genuinely empty values get stripped. */
const GENERIC_SET_POKEMON = /^(n\/a|none|unknown|-|null)$/i;
function setJunkFor(ai) {
  return isPokemon(ai) ? GENERIC_SET_POKEMON : GENERIC_SET;
}
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
/* Pokemon variants that move price as much as a Panini colour parallel
   does, and that were entirely missing here. 1st Edition vs Unlimited on
   a Base Set card is not a small premium — it is a different card. Same
   for Shadowless. Reverse Holo and Alt Art matter on modern.

   "unlimited" is deliberately absent: it describes the BASE printing, so
   listing it here would filter base cards out of base-card pricing. */
const POKEMON_WORDS = [
  "1st edition", "first edition", "shadowless", "reverse holo",
  "alt art", "alternate art", "full art", "rainbow rare", "secret rare",
  "gold star", "trainer gallery", "illustration rare", "special illustration",
  "prerelease", "staff promo"
];

/* NOT A BASE CARD, and not a parallel either.

   The parallel lists above handle colours and finishes, which is what
   they were built for. They say nothing about the other ways a listing
   can be a completely different object from the base card, and those
   were walking straight into the base-card median:

     - An autograph. A 2018 Chrome Ohtani auto is a four-figure card
       sitting in the same search as a $70 base rookie.
     - A patch or relic. Same problem, different premium.
     - A LOT. "Lot of 5" is five cards at one price, so the price is not
       the price of a card at all.
     - A reprint or a custom, which is not the card.

   A raw median of $425 on a card whose PSA 9 sells for $475 is the tell:
   a base card does not sell for 89% of its own graded copy, and the
   whole reason grading exists is that gap. The autographs were in the
   pool.

   Kept separate from PARALLEL_WORDS on purpose. A parallel IS the card,
   in a different finish, and somebody scanning a Purple Refractor wants
   parallel sales. Nobody scanning any card wants a lot of five or
   somebody's custom. */
const NOT_THE_CARD = [
  "auto", "autograph", "autographed", "signed", "signature", "on card auto",
  "patch", "relic", "jersey", "memorabilia", "game used", "game-used", "swatch",
  "lot of", "card lot", "bulk lot", "mystery", "repack", "break",
  "reprint", "custom", "aceo", "novelty", "proxy", "facsimile"
];

const PARALLEL_WORDS = COLOR_WORDS.concat(TEXTURE_WORDS).concat(POKEMON_WORDS);

/* ── WORD-BOUNDARY MATCHING ─────────────────────────────────────

   FIXED Aug 10. The old test was `t.includes(" " + word)`, which has an
   opening boundary and no closing one. Every one of these was a false
   positive, and each one silently removed a real base-card sale from
   the pool:

     " black"  matched  Charlie BLACKmon
     " red"    matched  REDemption
     " gold"   matched  GOLDen anniversary
     " white"  matched  WHITEhead
     " green"  matched  GREENberg
     " auto"   matched  AUTOmatic, AUTOgraph relic wording

   The damage compounded rather than being cosmetic. Base sales got
   flagged as parallels and filtered out; the surviving base pool fell
   below MIN_GROUP; the fallback in summarizeSold then handed back the
   ENTIRE ungraded group — refractors included — and labelled it RAW.
   That is how a 2018 Chrome Ohtani base RC reported a $425 raw median
   against its own $475 PSA 9.

   A shared helper so the two filters can never drift apart again. */
function hasWord(hay, word) {
  const w = String(word).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp("(^|[^a-z0-9])" + w + "([^a-z0-9]|$)", "i").test(hay);
}

/* True when a listing is something other than the card itself. */
function notTheCard(title) {
  const t = " " + String(title || "").toLowerCase().replace(/[^a-z0-9 -]/g, " ")
                    .replace(/\s+/g, " ") + " ";
  return NOT_THE_CARD.some(w => hasWord(t, w));
}

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
  const bare = n.replace(/^#/, "");
  // Pokemon numbers are written "074/073" in listing titles, never "#074/073".
  if (bare.indexOf("/") > -1) return bare;
  return "#" + bare;
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

function titleHasParallel(title, terms) {
  if (!terms.length) return false;
  const t = " " + String(title || "").toLowerCase() + " ";
  return terms.every(term => t.includes(term));
}

/* Serial matching has to respect digit boundaries.

   The old substring test was wrong in both directions:
     "/9"  matched  "/99" and "/999"
     "1/1" matched  "1/100"  (the string "1/100" contains "1/1")

   A 1/1 filter that quietly admits every /100 listing produces exactly
   the kind of wide spread the frontend then has to apologise for. The
   digit after the denominator must not be another digit. */
function titleHasSerial(title, denom) {
  if (!denom) return false;
  const t = String(title || "").replace(/\s+/g, "").toLowerCase();

  if (denom === "1/1") {
    // Not preceded or followed by another digit: "1/1" yes, "1/100" no,
    // "11/1" no.
    return /(^|[^0-9])1\/1([^0-9]|$)/.test(t);
  }

  const digits = denom.replace(/[^0-9]/g, "");
  if (!digits) return false;
  return new RegExp("/" + digits + "([^0-9]|$)").test(t);
}

function parallelTerms(ai) {
  const par = cleanVal(ai.parallel);
  if (!par || GENERIC_SET.test(par)) return [];
  return par.toLowerCase()
    .replace(/[^a-z0-9\- ]/g, " ")
    .split(/\s+/)
    .filter(w => w.length > 2 && w !== "parallel");
}

/* Pokemon needs its own query shape, and the lack of it was the whole
   problem.

   buildQueryTiers builds every search around `player`. A Pokemon card has
   no player, so when the AI left that field empty the search collapsed to
   year + brand + set — a nameless query that matches half the set and
   returns junk. The Pokemon's NAME is the player.

   The variant also has to come out of the keyword query. eBay ANDs
   keywords, and a seller listing a Coalossal VMAX rarely types "Full Art"
   even when it is one. Requiring it returns nothing. The variant still
   filters titles further down in selectListings, which is the right place
   for it: narrow the results, don't narrow the search. */
function isPokemon(ai) {
  const hay = [ai && ai.sport, ai && ai.brand, ai && ai.set, ai && ai.cardName]
    .map(v => String(v || "").toLowerCase()).join(" ");
  return hay.indexOf("pok") > -1;
}

function buildQueryTiers(ai) {
  const year   = cleanVal(ai.year);
  const brand  = cleanVal(ai.brand);
  const player = cleanVal(ai.player);
  const setRaw = cleanVal(ai.set);
  const poke   = isPokemon(ai);
  const set    = setJunkFor(ai).test(setRaw) ? "" : trimOverlap(setRaw, brand);
  const parRaw = cleanVal(ai.parallel);
  const par    = GENERIC_SET.test(parRaw) ? "" : parRaw;
  const num    = cardNumberToken(ai);
  const grade  = (cleanVal(ai.gradeCompany) && cleanVal(ai.gradeValue))
                 ? cleanVal(ai.gradeCompany) + " " + cleanVal(ai.gradeValue) : "";

  /* A Japanese card and its English twin are different cards at very
     different prices, and they were being blended into one number.
     Sellers reliably put "Japanese" in the title; almost nobody writes
     "English", so only the Japanese case becomes a keyword. English
     stays implicit, which is also what the ask side already assumes. */
  const lang = /^(jap|jpn)/i.test(cleanVal(ai.language)) ? "Japanese" : "";

  let tight, core, loose;
  if (poke) {
    // "pokemon" is forced in so eBay lands in the right category, and the
    // variant is deliberately left out of the keywords.
    tight = joinParts(["pokemon", lang, player, set, num, grade]);
    core  = joinParts(["pokemon", lang, player, num, grade]);
    loose = joinParts(["pokemon", lang, player]);
  } else {
    tight = joinParts([year, brand, set, player, par, num, grade]);
    core  = joinParts([year, brand, player, num, grade]);
    loose = joinParts([year, brand, player]);
  }

  const tiers = [];
  if (tight) tiers.push({ tier: "tight", query: tight });
  if (core && core !== tight) tiers.push({ tier: "core", query: core });
  if (loose && loose !== core && loose !== tight) tiers.push({ tier: "loose", query: loose });
  return tiers;
}

/* Is a slash-number a PRINT RUN, or just a card number?

   This was quietly breaking every Pokemon lookup. titleLooksParallel
   treated any "n/n" in a title as evidence of serial numbering, which is
   right for "25/99" on a Panini parallel and completely wrong for
   Pokemon, where the card number IS a slash-number: 074/073, 4/102,
   SV107/SV122. Nearly every Pokemon listing was therefore flagged as a
   parallel and filtered OUT of base-card pricing, leaving the median to
   be computed from whatever scraps survived.

   Three tells separate the two:
     - a zero-padded numerator (074/073) is set numbering, never a serial
     - a numerator larger than the denominator (secret rares run past the
       set total) cannot be a print run
     - print runs come in a small, well-known set of sizes */
const PRINT_RUNS = new Set([
  1, 5, 10, 15, 20, 25, 35, 49, 50, 55, 60, 65, 70, 75, 80, 85, 90, 99,
  100, 125, 149, 150, 175, 199, 200, 249, 250, 275, 299, 300, 350, 399,
  400, 425, 450, 499, 500, 550, 599, 600, 650, 699, 700, 750, 799, 800,
  850, 899, 900, 950, 999, 1000, 1500, 2000, 2500, 5000
]);

function looksLikeSerialNumbering(text) {
  const t = String(text || "");
  const re = /(\d{1,4})\s*\/\s*(\d{1,4})/g;
  let m;
  while ((m = re.exec(t)) !== null) {
    const numRaw = m[1];
    const num = parseInt(numRaw, 10);
    const den = parseInt(m[2], 10);
    if (/^0\d/.test(numRaw)) continue;      // 074/073 — set numbering
    if (num > den) continue;                // secret rare, not a print run
    if (!PRINT_RUNS.has(den)) continue;     // 4/102 etc — a set total
    return true;
  }
  return false;
}

function titleLooksParallel(title, brandName) {
  let t = " " + String(title || "").toLowerCase() + " ";
  String(brandName || "").toLowerCase().split(/\s+/).forEach(w => {
    if (w.length > 2) t = t.split(w).join(" ");
  });
  if (looksLikeSerialNumbering(t)) return true;
  // Word-boundary match — see hasWord(). The old includes(" " + w) test
  // matched Blackmon as "black" and redemption as "red".
  return PARALLEL_WORDS.some(w => hasWord(t, w));
}

/* Is this SOLD record a base card?

   The sold side used to answer this with "is it ungraded?", which is a
   different question. A Mother's Day Pink /50 that sold for $200 is not
   in a slab, so it counted as a raw base sale — along with a Black /67
   and two Gold /2018s. Four numbered parallels averaged in with four
   base cards pushed the raw median from $2 to $10, and the page then
   announced a deal on a $2 common that nobody could act on.

   print_run comes back in the API response and always did. The filter
   simply never looked at it. The title check is the backstop for
   parallels that carry no serial numbering at all (Refractors, Reverse
   Holos, Silver Prizms), and it reuses the same word lists and the same
   Pokemon-safe slash-number logic the ask side has used for months.

   Brand is passed as "" on purpose: PARALLEL_WORDS deliberately excludes
   product names, so there is nothing to strip. */
function looksBaseSale(r) {
  if (r.printRun != null && r.printRun > 0) return false;
  /* Autos, patches, lots and reprints are not base cards and not
     parallels — they are different objects at wildly different prices,
     and they were the reason a base median could sit at 89% of its own
     PSA 9. */
  if (notTheCard(r.title)) return false;
  if (titleLooksParallel(r.title, "")) return false;
  return true;
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
      const tightBase = tight.filter(l => !titleLooksParallel(l.title, brand) && !notTheCard(l.title));
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
    const base = wide.filter(l => !titleLooksParallel(l.title, brand) && !notTheCard(l.title));
    if (base.length >= 3) {
      return { listings: base, matchQuality: "base_fallback", tierUsed: "core-base",
               note: "No listings found for this parallel. Showing BASE card prices — a parallel is usually worth more." };
    }
    return { listings: wide, matchQuality: "base_fallback", tierUsed: "core",
             note: "No listings found for this parallel. Showing prices for the card generally." };
  }

  if (!isParallel && wide.length) {
    const base = wide.filter(l => !titleLooksParallel(l.title, brand) && !notTheCard(l.title));
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
  const set    = setJunkFor(ai).test(setRaw) ? "" : trimOverlap(setRaw, brand);
  let n = joinParts([cleanVal(ai.year), brand, set, cleanVal(ai.player)]);
  const par = cleanVal(ai.parallel);
  if (par && !GENERIC_SET.test(par)) n += " " + par;
  const s = cleanVal(ai.serialNumber);
  if (s && /\d+\s*\/\s*\d+/.test(s)) n += " " + s.replace(/\s+/g, "");
  /* Pokemon has no rookies. "RC" on a Charizard is wrong on its face and
     it also rides into the eBay keywords through the display name. */
  if (ai.isRookie && !isPokemon(ai)) n += " RC";
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
  const wide   = spread >= WIDE_SPREAD_AT;

  const base = {
    query:          cleanQuery,
    avgPrice:       median(prices),
    lowPrice:       range.low,
    highPrice:      range.high,
    listingCount:   listings.length,
    spreadRatio:    Number(spread.toFixed(1)),
    wideSpread:     wide,
    image:          (listings.find(x => x.image) || {}).image || "",
    priceSource:    listings.length ? "eBay active card listings (median)" : "No clean card listings found",
    raw:            summarizeGroup(rawGroup),
    graded:         summarizeGroup(gradedGroup),
    gradeBreakdown: gradeBreakdown(gradedGroup),
    listings
  };

  /* The spread warning used to be skipped entirely whenever the caller
     supplied its own priceNote — and getCardMarketForCard ALWAYS supplies
     one. So every scanned card silently lost this warning while typed
     searches kept it, for the same underlying data.

     Now the warning always gets written to its own field. priceNote still
     defers to the caller's more specific note (which explains WHICH
     listings were priced), so nothing is overwritten and no scan loses the
     signal. */
  if (wide) {
    base.spreadNote =
      "These listings vary a lot — the search is probably matching several " +
      "different cards. Edit the search below to narrow it down.";
    if (!(extra && extra.priceNote)) {
      base.matchQuality = "loose";
      base.priceNote = base.spreadNote;
    }
  }

  return Object.assign(base, extra || {});
}

const EMPTY_MARKET = (q, source) => ({
  query: q, avgPrice: 0, lowPrice: 0, highPrice: 0,
  listingCount: 0, image: "", priceSource: source,
  raw: { count:0, median:0, low:0, high:0, thin:false },
  graded: { count:0, median:0, low:0, high:0, thin:false },
  gradeBreakdown: [], listings: [],
  spreadRatio: 0, wideSpread: false, spreadNote: ""
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

/* Refinement queries — the scanner's "PSA 10 / Raw only" chips — cost a
   full records pull each, on top of the original scan. One card explored
   through three chips was spending 400 records against a 10,000/day
   budget instead of 100, and that cost scales with exactly the engagement
   we're trying to grow.

   A median off 50 sales is not meaningfully worse than a median off 100,
   so refinements ask for half. The frontend flags them with compact=1. */
const CARDAPI_LIMIT_COMPACT = Number(process.env.CARDAPI_LIMIT_COMPACT || 50);

/* Bump this whenever the sold-side filtering logic changes.

   Same pattern as CATALOG_LOGIC_VERSION further down, and for the same
   reason: a permanent cache and improving logic are a bad pair without a
   version stamp. Every row cached before the word-boundary fix was
   computed by a filter that let refractors into the base pool, and
   serving those back would hide the fix completely.

   NOTE: card_price_history is keyed on cache_key too, so bumping this
   starts a fresh daily series per card. The old series was built on
   contaminated medians, so that is the right trade — but it is a real
   cost and it is deliberate. */
const SOLD_LOGIC_VERSION = 2;

/* The cache key must carry the limit. Without it a 50-record compact pull
   gets stored under the same key as a full lookup and is then served back
   as though it were one. */
function cacheKeyFor(query, limit) {
  const base = normalizeCardQuery(query).toLowerCase().replace(/\s+/g, " ").trim().slice(0, 280);
  const n = Number(limit || CARDAPI_LIMIT);
  const stem = n === CARDAPI_LIMIT ? base : base + "#" + n;
  return stem + "@v" + SOLD_LOGIC_VERSION;
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

function summarizeSold(records, query, limitUsed) {
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
      sales: [], query: query, lookbackDays: CARDAPI_LOOKBACK,
      limitUsed: limitUsed || CARDAPI_LIMIT,
      soldBasis: "none", soldWarning: "", soldContaminated: false
    };
  }

  const prices = clean.map(r => r.price).sort((a, b) => a - b);

  /* If the card being priced IS a parallel, stripping parallels would
     leave nothing to price it from. Only base-card lookups get filtered.
     The query carries the parallel terms, so it answers this directly. */
  const targetIsParallel = titleLooksParallel(query, "");

  /* Whatever the card IS, its own kind must not be filtered out.

     NOT_THE_CARD keeps four-figure autographs out of a BASE card's
     median. Applied to an auto search it does the opposite: every sale
     gets flagged as "not the card", the base pool empties, and the
     fallback then reports "only 0 confirmed base-card sales" on a card
     that is an autograph and was never going to have any.

     Same guard titleLooksParallel has always had. If the query says
     auto, autos are the comparison. */
  const targetIsSpecial = notTheCard(query);

  /* THE SILENT FALLBACK, NOW AUDIBLE.

     The old narrow() returned the UNFILTERED group whenever fewer than
     MIN_GROUP base sales survived, and said nothing about it. The page
     then printed a refractor-contaminated median under a "RAW" badge.

     The fallback still happens — a thin sample beats no answer — but it
     is recorded here and reported below. A number that quietly stopped
     meaning what its label says is worse than a number with a caveat. */
  const filt = { rawBase: 0, rawAll: 0, rawFellBack: false };
  const narrow = function (group, tag) {
    if (targetIsParallel || targetIsSpecial) return group;
    const base = group.filter(looksBaseSale);
    if (tag === "raw") { filt.rawBase = base.length; filt.rawAll = group.length; }
    if (base.length >= MIN_GROUP) return base;
    if (tag === "raw") filt.rawFellBack = group.length > base.length;
    return group;
  };

  /* Splitting raw from graded on the grader FIELD ALONE leaks in two
     directions, and both matter.

     A slab whose record carries no grader lands in the raw pool and
     drags the raw median up — which is the number people quote as what
     the card is worth ungraded. And a record with a grader but no grade
     falls into neither pool: excluded from graded because that test
     needs both, excluded from raw because it has one.

     The title is the backstop. detectGrade() already reads "PSA 10" out
     of a listing title and has been used on the ask side for months; it
     was simply never applied to sold records. */
  const gradeOf = r => {
    if (r.grader) return { company: String(r.grader).toUpperCase(), grade: r.grade || null };
    const fromTitle = detectGrade(r.title);
    return fromTitle.graded
      ? { company: fromTitle.company, grade: fromTitle.grade != null ? String(fromTitle.grade) : null }
      : null;
  };

  clean.forEach(r => {
    const g = gradeOf(r);
    r.isGraded = !!g;
    if (g) {
      if (!r.grader) r.grader = g.company;   // fill from the title
      if (!r.grade && g.grade != null) r.grade = String(g.grade);
    }
  });

  const gradedAll = clean.filter(r => r.isGraded);
  const rawAll    = clean.filter(r => !r.isGraded);

  const raw    = narrow(rawAll, "raw");
  const graded = narrow(gradedAll, "graded");

  /* The grade ladder needs the same treatment. A PSA 10 of a Gold /50
     landing on the PSA 10 rung of a base card is what makes the scanner
     tell somebody to spend $25 grading a common. */
  const ladderSrc = narrow(clean, "ladder");

  const rawP  = raw.map(r => r.price).sort((a, b) => a - b);
  const grP   = graded.map(r => r.price).sort((a, b) => a - b);
  const dates = clean.map(r => r.saleDate).filter(Boolean).sort();

  const ladder = soldGradeBreakdown(ladderSrc);
  const rawMed = median(rawP);

  /* The headline number must describe ONE thing. A raw card is not worth
     the median of raw sales and PSA 10 slabs mixed together — that median
     drifts upward with every slab in the window. When there are enough raw
     sales, they are the headline; the graded side is reported separately. */
  const useRaw   = rawP.length >= MIN_GROUP;
  const headline = useRaw ? rawP : prices;
  let   basis    = useRaw ? "raw" : "all";
  const range    = trimmedRange(headline);

  /* SELF-CONSISTENCY CHECK.

     A base card cannot be worth most of its own graded copy — the gap is
     the entire reason grading exists. When the raw median lands near the
     PSA 9, the raw pool is not raw base cards, whatever the filter
     concluded. Both numbers are already computed here, so this costs
     nothing to check and catches contamination the word lists miss.

     The 0.7 line is deliberately loose. Genuine raw-to-PSA-9 ratios on
     modern cards sit around 0.2-0.4; anything at 0.7 or above is not a
     tight call. */
  let warning = "";
  let contaminated = false;
  const psa9  = ladder.find(g => g.grade === "PSA 9");
  const psa10 = ladder.find(g => g.grade === "PSA 10");
  const rung  = (psa9 && psa9.median) || (psa10 && psa10.median ? psa10.median * 0.34 : 0);

  if (useRaw && rung > 0 && rawMed >= rung * 0.7) {
    contaminated = true;
    basis = "mixed";
    warning = "These ungraded sales look like they include parallels or inserts — " +
              "the raw price sits too close to the graded price to be one card. " +
              "Narrow the search before trusting this number.";
  } else if (filt.rawFellBack) {
    contaminated = true;
    basis = "mixed";
    warning = "Only " + filt.rawBase + " confirmed base-card sale" +
              (filt.rawBase === 1 ? "" : "s") + " out of " + filt.rawAll +
              " ungraded. This median includes other versions of the card.";
  }

  return {
    soldCount:     clean.length,
    soldMedian:    median(headline),
    soldLow:       range.low,
    soldHigh:      range.high,
    soldBasis:     basis,
    soldWarning:   warning,
    soldContaminated: contaminated,
    soldMedianAll: median(prices),
    soldCountUsed: headline.length,
    /* The frontend prints "100+" when the count hits the limit, because a
       count sitting exactly at the ceiling is a ceiling and not a total.
       It needs to know what the ceiling actually was. */
    limitUsed:     limitUsed || CARDAPI_LIMIT,
    soldRaw:    { count: raw.length,    median: rawMed },
    soldGraded: { count: graded.length, median: median(grP) },
    soldRawBasis:      filt.rawFellBack ? "ungraded" : "base",
    soldBaseCount:     filt.rawBase,
    soldUngradedCount: filt.rawAll,
    soldGradeBreakdown: ladder,
    bestOfferCount: clean.filter(r => r.listingType === "best_offer").length,

    /* How these sales happened, not just what they went for.

       An auction ending at $14.50 and a Buy It Now at $14.50 are not the
       same fact. An auction is several people converging on a price; a
       fixed-price sale is one person accepting one seller's number. A
       median built entirely from fixed-price listings is a median of
       what sellers asked and somebody eventually paid \u2014 which is much
       closer to an asking price than it looks. */
    listingMix: listingMix(clean),
    lastSaleDate:   dates.length ? dates[dates.length - 1] : null,
    sales:          clean.slice(0, 12),
    query:          query,
    lookbackDays:   CARDAPI_LOOKBACK
  };
}

/* Sales grouped by how they happened. Returns null rather than a table
   of zeroes when the source doesn't carry the field, so the frontend can
   stay silent instead of printing an empty breakdown. */
function listingMix(rows) {
  if (!Array.isArray(rows) || !rows.length) return null;
  const typed = rows.filter(r => r && r.listingType);
  if (!typed.length) return null;

  const bucket = t => {
    const v = String(t || "").toLowerCase();
    if (v.indexOf("auction") > -1)   return "auction";
    if (v.indexOf("best_offer") > -1 || v.indexOf("best offer") > -1) return "bestOffer";
    if (v.indexOf("fixed") > -1 || v.indexOf("buy") > -1) return "fixed";
    return "other";
  };

  const counts = { auction: 0, bestOffer: 0, fixed: 0, other: 0 };
  const prices = { auction: [], bestOffer: [], fixed: [], other: [] };
  typed.forEach(r => {
    const b = bucket(r.listingType);
    counts[b] += 1;
    const p = Number(r.price);
    if (isFinite(p) && p > 0) prices[b].push(p);
  });

  const out = {
    total:      typed.length,
    untyped:    rows.length - typed.length,
    auction:    counts.auction,
    bestOffer:  counts.bestOffer,
    fixed:      counts.fixed,
    other:      counts.other,
    auctionMedian: median(prices.auction),
    fixedMedian:   median(prices.fixed),
    note: ""
  };

  /* The reading, not just the numbers. A median resting almost entirely
     on fixed-price sales deserves a caveat: nobody competed for those,
     so they describe what one buyer accepted rather than what the market
     converged on. */
  const pctAuction = Math.round((out.auction / out.total) * 100);
  if (out.total < 4) {
    out.note = "";
  } else if (pctAuction >= 60) {
    out.note = "Mostly auctions \u2014 these are prices buyers competed to reach.";
  } else if (pctAuction <= 15) {
    out.note = "Almost all fixed-price sales. Nobody bid against anyone here, so these " +
               "are closer to what sellers asked than what a market settled on.";
  }
  return out;
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
  /* A contaminated median must not enter the permanent series. The
     cached payload expires in twelve hours; a history row does not, and
     a bad point poisons every movement arrow computed against it. */
  if (sold.soldContaminated) {
    console.log("[history] skipped contaminated median for " + query);
    return;
  }
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

async function fetchSoldComps(query, limit) {
  if (!CARDAPI_KEY) return null;
  const clean = normalizeCardQuery(query);
  if (!clean || clean.length < 4) return null;   // their q needs 4+ chars

  const useLimit = Number(limit || CARDAPI_LIMIT);

  const params = new URLSearchParams({
    q:         clean,
    limit:     String(useLimit),
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
    const out  = summarizeSold(recs, clean, useLimit);
    out.recordsUsed = recs.length;
    out.budgetLeft  = remaining != null ? Number(remaining) : null;
    return out;
  } catch (e) {
    console.log("[cardapi] error:", e.message);
    return null;
  }
}

/* Cache-first sold lookup. askMedian is passed in only so the history
   row can store the ask and the sold side from the same moment.
   compact=true halves the record spend — used for refinement chips. */
async function getSoldComps(query, askMedian, compact) {
  if (!CARDAPI_KEY) return null;
  const limit = compact ? CARDAPI_LIMIT_COMPACT : CARDAPI_LIMIT;
  const key = cacheKeyFor(query, limit);
  if (!key) return null;

  const hit = await readSoldCache(key);
  if (hit) { hit.cached = true; return hit; }

  const fresh = await fetchSoldComps(query, limit);
  if (!fresh || fresh.rateLimited) return fresh;

  fresh.cached = false;
  await writeSoldCache(key, fresh.query, fresh);
  /* Only full pulls write price history. A compact refinement is a
     different slice of the market (one grade, or raw only) and would
     corrupt the daily series for the card as a whole. */
  if (!compact) await recordPriceHistory(key, fresh.query, fresh, askMedian);
  return fresh;
}

/* Ask vs sold — the spread nobody else shows.

   This has to compare LIKE WITH LIKE, and the first version didn't.

   Real failure it produced: a 2017 Bowman Chrome Mega Ohtani came back
   with a sold median of $3,000 and a typical ask of $20, and the page
   announced "asking prices are 99% BELOW recent sales — there may be a
   deal listed right now." There was no deal. The 5 sales were graded
   slabs; the 100 listings were 59 raw cards at $15 and 41 slabs at
   $4,830. Two different populations, one meaningless ratio, and the
   scanner sent people hunting for a $3,000 card at $20.

   So: match the sold basis to the matching ask group. Raw sales get
   compared to raw listings, graded sales to graded listings. Only fall
   back to the blended medians when neither side splits cleanly, and even
   then refuse to call it a deal if the gap is too large to be real. */
const IMPLAUSIBLE_GAP_PCT = 65;

function askVsSold(market, sold) {
  if (!sold || !sold.soldCount) return null;

  /* A deal callout on a pool we have already flagged as mixed is the
     same mistake in a different place. If the sold side is known to be
     contaminated, say that instead of computing a percentage off it. */
  if (sold.soldContaminated) {
    return {
      ask: safeNumber(market && market.avgPrice, 0),
      sold: safeNumber(sold.soldMedian, 0),
      diff: 0, pct: 0, basis: "mixed", mismatch: true,
      note: sold.soldWarning || "The recent sales look like several different versions "
            + "of this card, so there is nothing reliable to compare against.",
      askCount: (market && market.listingCount) || 0,
      soldCount: sold.soldCount
    };
  }

  const askRaw    = (market && market.raw)    || { count: 0, median: 0 };
  const askGraded = (market && market.graded) || { count: 0, median: 0 };
  const soldRaw    = sold.soldRaw    || { count: 0, median: 0 };
  const soldGraded = sold.soldGraded || { count: 0, median: 0 };

  let basis = null, ask = 0, soldMed = 0, label = '';

  // Whichever side the sold data actually describes, match it.
  if (soldRaw.count >= MIN_GROUP && askRaw.count >= MIN_GROUP &&
      soldRaw.count >= soldGraded.count) {
    basis = 'raw'; ask = askRaw.median; soldMed = soldRaw.median; label = 'Raw copies: ';
  } else if (soldGraded.count >= MIN_GROUP && askGraded.count >= MIN_GROUP &&
             soldGraded.count > soldRaw.count) {
    basis = 'graded'; ask = askGraded.median; soldMed = soldGraded.median; label = 'Graded slabs: ';
  } else {
    basis = 'all';
    ask = safeNumber(market && market.avgPrice, 0);
    soldMed = safeNumber(sold.soldMedian, 0);
  }

  ask = safeNumber(ask, 0);
  soldMed = safeNumber(soldMed, 0);
  if (!ask || !soldMed) return null;

  const diff = ask - soldMed;
  const pct  = Math.round((diff / soldMed) * 100);

  /* A gap this wide is not a market signal, it is a sign the two sides
     are describing different cards. Say that instead of inventing an
     opportunity that isn't there. */
  const mismatch = (basis === 'all' && Math.abs(pct) >= IMPLAUSIBLE_GAP_PCT);

  /* A deal callout while the ASK side is flagged as a wide spread is the
     same error the sold side just guarded against: the cheap listings are
     probably a different version, not a bargain. */
  const askIsMessy = !!(market && market.wideSpread);

  let note;
  if (mismatch) {
    note = 'Asking prices and recent sales are too far apart to compare — '
         + 'the listings and the sales look like different versions of this card. '
         + 'Narrow the search before trusting either number.';
  } else if (pct <= -10 && askIsMessy) {
    note = 'Some listings sit below recent sales, but the listings vary too much to call '
         + 'it a deal — the cheap ones are probably a different version. Narrow the search first.';
  } else if (pct >= 10) {
    note = label + 'sellers are asking ' + pct + '% over what buyers actually pay. Don\'t pay list price.';
  } else if (pct <= -10) {
    note = label + 'asking prices are ' + Math.abs(pct) + '% BELOW recent sales — there may be a deal listed right now.';
  } else {
    note = label + 'asking prices are close to what buyers actually pay.';
  }
  if (label && note) note = note.charAt(0).toUpperCase() + note.slice(1);

  return {
    ask: ask, sold: soldMed, diff: Math.round(diff), pct: pct,
    basis: basis, mismatch: mismatch, note: note,
    askCount:  basis === 'raw' ? askRaw.count  : basis === 'graded' ? askGraded.count  : (market && market.listingCount) || 0,
    soldCount: basis === 'raw' ? soldRaw.count : basis === 'graded' ? soldGraded.count : sold.soldCount
  };
}

// ── OpenAI scan ────────────────────────────────────────────────
const AI_FALLBACK = (summary) => ({
  cardName: "Unknown Trading Card", player: "Unknown", year: "Unknown",
  set: "Unknown", brand: "Unknown", cardNumber: "Unknown", sport: "Unknown",
  parallel: "", parallelOptions: [], parallelCertain: true,
  serialNumber: "", isRookie: false, isAutograph: false, isPatch: false,
  gradeCompany: "", gradeValue: "",
  signal: "VERIFY", confidence: "Low", summary
});

async function scanWithOpenAI(frontFile, backFile) {
  if (!process.env.OPENAI_API_KEY) return AI_FALLBACK("OpenAI API key missing.");

  const images = [{ type: "image_url", image_url: { url: fileToDataUrl(frontFile) } }];
  if (backFile) images.push({ type: "image_url", image_url: { url: fileToDataUrl(backFile) } });

  const payload = {
    /* gpt-4o rather than gpt-4o-mini.

       The mini model was misreading manufacturer logos \u2014 Topps coming
       back as Donruss \u2014 which is not a subtle failure. A wrong brand
       sends the price lookup to a different company's product entirely,
       and every number after that is confidently wrong.

       Accuracy is the product here. Everything on this site rests on the
       numbers being right, so the cheaper model was saving money on the
       one thing that cannot be allowed to fail. At current volume the
       difference is a few dollars a month; if scanning grows past a few
       hundred a day it is worth re-measuring, but not before. */
    model: "gpt-4o",
    messages: [
      { role: "system", content: "You are an expert trading card identifier. You examine photos of sports cards, Pokemon cards, TCG cards, graded slabs, and sealed product. You return ONLY valid JSON with no markdown, no code fences, and no commentary. You never estimate dollar values." },
      { role: "user", content: [
        { type: "text", text: "Identify this card as precisely as possible. Return ONLY a JSON object with these exact keys: cardName, player, year, brand, set, setCode, cardNumber, sport, parallel, parallelOptions, parallelCertain, insert, serialNumber, language, isRookie, isAutograph, isPatch, gradeCompany, gradeValue, signal, confidence, summary.\n\nHOW TO READ A CARD \u2014 DO THIS FIRST, BEFORE ANY OF THE RULES BELOW:\nEverything you need is PRINTED ON THE CARD. Read it. Do not infer it from what the card looks like or from what cards like this usually are.\n1. BRAND \u2014 find the manufacturer logo. It is almost always on the front, and the copyright line on the back names it outright: 'Topps', 'Panini', 'Upper Deck', 'Donruss', 'Bowman', 'Fleer', 'Leaf'. These logos look nothing alike. Read the one that is actually there. Do NOT guess a brand because the design reminds you of one \u2014 a wrong brand sends the whole lookup to a different company's product.\n2. YEAR \u2014 the copyright line on the back, usually next to the manufacturer name. Use that, not the season the player was active.\n3. CARD NUMBER \u2014 usually on the back, top or bottom corner. Copy it exactly, including any letters or slashes.\n4. PLAYER \u2014 printed on the front. Full name as shown.\n5. SET \u2014 the product line, printed on the front or named in the back's copyright line.\n\nIf the photo is too blurry or cropped to read one of these, return 'Unknown' for that field. A field you could not read is far better than one you invented \u2014 a made-up brand or year produces a confident price for a completely different card.\n\nGLARE ON SHINY SURFACES \u2014 A SPECIFIC AND COMMON FAILURE MODE:\n- Chrome, Prizm, Optic, and other holographic-finish cards reflect light unpredictably, and the reflection moves with the angle of the photo. The SAME physical card photographed twice, seconds apart, can show glare over completely different parts of the card each time.\n- This means small printed text \u2014 the copyright year especially, since it's small and often near the border \u2014 can be partially washed out by glare in one photo and fully legible in another, even for the identical card.\n- If glare, reflection, or a bright hotspot covers ANY part of the year, card number, or set text, do not guess the obscured digit or character from context (\"it's probably 2023 because these usually are\"). Return 'Unknown' for that field instead. A guess made confident by pattern-matching against typical years is exactly the kind of invented answer this whole instruction set exists to prevent.\n- Do not let a shiny/holographic FINISH be mistaken for a named PARALLEL. \"Prizm\" is a specific Panini product line, not a generic word for \"shiny\" \u2014 a card can have a holographic look without actually being a Prizm-branded parallel. Only report a parallel name you can tie to actual printed text, a serial number, or a color scheme specific to that product's known parallel list. A generic shine is not evidence of any particular named parallel.\n\nTHE SINGLE MOST IMPORTANT FIELD IS player. Never leave it empty.\n- On a sports card it is the athlete's name.\n- ON A POKEMON OR TCG CARD IT IS THE CREATURE'S NAME, including its suffix exactly as printed: 'Coalossal VMAX', 'Charizard V', 'Umbreon VMAX', 'Pikachu ex', 'Mewtwo GX'. Set sport to 'Pokemon' and brand to 'Pokemon'. Without the name every price lookup fails, so read it off the top of the card even if the rest of the card is unclear.\n\nCRITICAL \u2014 PARALLEL IDENTIFICATION. Parallels change a card's value by 10x or more, so look carefully before concluding a card is base:\n- Border color is the main tell. Panini Prizm/Select/Optic parallels are named by color: Silver, Red, Blue, Green, Orange, Purple, Gold, Black, Pink, Camo, Mojo, Wave, Hyper, Disco, Shimmer, Ice.\n- Topps Chrome parallels: Refractor, X-Fractor, Prism, Atomic, Sepia, Gold, Orange, Red, SuperFractor, Negative, Speckle.\n- POKEMON: the variant matters as much as any colour parallel. Report it in the parallel field. Vintage: 1st Edition (look for the black stamp to the left of the artwork), Shadowless (no drop shadow on the right of the art box). Any era: Reverse Holo (the CARD BODY is foil, the artwork is not), Full Art, Alt Art, Rainbow Rare, Gold Secret Rare, Illustration Rare. Do NOT write Unlimited or Regular \u2014 that is the base printing, so leave parallel empty.\n- Look for rainbow/foil sheen, cracked-ice texture, sparkle, or a colored border that differs from the base design.\n- Look for serial numbering printed on the front or back, usually small, formatted like 25/99 or /99. Report it exactly as printed in serialNumber. POKEMON CARD NUMBERS ARE NOT SERIAL NUMBERING: 074/073, 4/102 and SV107/SV122 are the card's number within its set. Put those in cardNumber and leave serialNumber EMPTY.\n- '1/1' or 'One of One' is critical \u2014 always report it.\n- If you see a colored border or foil pattern but cannot name the exact parallel, use the color plus the word Parallel, e.g. 'Blue Parallel'.\n- Use an empty string for parallel ONLY if the card is clearly a plain base card.\n\nWHEN YOU CANNOT TELL WHICH PARALLEL \u2014 SAY SO INSTEAD OF PICKING ONE:\n- Some parallels differ only by a colour TINT across a foil surface, and a photograph taken under ordinary indoor light frequently cannot separate them. On Topps Chrome, a base Refractor, Sepia, Prism, Aqua and Rose Gold all look like 'a shiny refractor' in a phone photo. On Panini Prizm the Silver, Hyper and Disco parallels are similarly close.\n- In that situation do NOT choose the most likely one. Put the family in parallel \u2014 'Refractor' \u2014 AND list every candidate you genuinely cannot rule out in parallelOptions, most likely first, maximum six.\n- Set parallelCertain to false whenever parallelOptions has entries. Set it to true only when the card names its own parallel in printed text, carries a serial number that identifies it, or has a colour so distinct there is nothing to confuse it with.\n- If the card is plainly base, parallel is empty, parallelOptions is empty, and parallelCertain is true.\n- WHY THIS MATTERS: a wrong parallel is not a small error. A base Refractor and a Superfractor of the same card differ by a hundred times in price, so naming the wrong one produces a confident valuation that is wrong by orders of magnitude. Listing three candidates the buyer can choose between is worth far more than one guess that reads as certain.\n\nINSERT SETS \u2014 REPORT THESE TOO, IN THE insert FIELD:\n- An insert is a themed subset printed alongside the base set, with its own name printed on the card front: 'Freshman Flash', 'Future Stars', 'Kaboom', 'Downtown', 'Diamond Kings', 'Stars of MLB', 'Home Field Advantage'.\n- An insert is NOT the base card and does not trade at base-card prices, so a base price on an insert is wrong in both directions.\n- Read the name off the front and put it in insert EXACTLY as printed. If the card carries no insert name, return an empty string.\n- Do not confuse an insert with a parallel. A parallel is the same card in a different finish; an insert is a different card design entirely. A card can be both.\n\nSET FIELD RULES \u2014 IMPORTANT:\n- The 'set' field must be the actual product/subset name as it would appear in an eBay listing title, for example 'Update Series', 'Draft Picks', 'Downtown', 'Kaboom'.\n- If the card is just the base set of the product, return an EMPTY STRING for set. Never return 'Base', 'Base Set', 'Base Rookie', or 'Common' \u2014 those words do not appear in listing titles and break the price search.\n- POKEMON IS THE EXCEPTION TO THAT RULE. Pokemon set names are real products and must ALWAYS be returned in full, even when they sound generic: 'Base Set', 'Jungle', 'Fossil', 'Team Rocket', 'Neo Genesis', 'Evolving Skies', 'Champions Path', 'Darkness Ablaze', 'Rebel Clash', 'Hidden Fates', 'Obsidian Flames', '151'. Use the set symbol and the card number to identify it. Never return an empty set for a Pokemon card if you can name the set at all.\n- POKEMON SET CODES \u2014 REPORT WHAT IS PRINTED, SEPARATELY FROM WHAT YOU THINK IT MEANS. Modern Pokemon cards print a 2-4 letter code in the bottom corner beside the card number: SVI, PAL, OBF, EVS, SSP, MEW, ASC, PFL.\n  \u2022 Put the code EXACTLY as printed in setCode. This is something you can read \u2014 report it even if the set is unfamiliar.\n  \u2022 Put the set name in set ONLY IF YOU ARE CERTAIN which set that code belongs to. If you are not certain, LEAVE set EMPTY. Do not reach for the closest set you happen to know.\n  \u2022 A wrong set name is far worse than no set name. It pulls comps for a different card and looks authoritative doing it. 'I read PFL and I do not know that set' is a correct and useful answer; guessing 'Obsidian Flames' because OBF is similar is not.\n  \u2022 The year must match the set you name. If you are unsure of the set, do not adjust the year to fit a guess \u2014 read the copyright year off the card.\n\nSPORT \u2014 ALWAYS FILL THIS IN:\n- One of: Baseball, Basketball, Football, Hockey, Soccer, Pokemon, Racing, Wrestling, Golf, Tennis, MMA, Non-Sport.\n- Read it off the card: the team, the league logo, the uniform, the position, the equipment in the photo.\n- This is NOT optional and 'Unknown' is not an acceptable answer. Two sets can share a name, a year and a brand and still be different sets \u2014 1986 Topps is 792 cards in baseball and 396 in football. Without the sport there is no way to tell them apart, so a collector gets the wrong set size for the rest of time.\n- If the card is genuinely ambiguous, pick the most likely sport rather than leaving it blank.\n\nLANGUAGE:\n- Return 'Japanese' if the card text is Japanese, or 'Chinese' or 'Korean' where those apply. Otherwise return 'English'.\n- Japanese Pokemon cards trade as a separate market at different prices, so getting this wrong misprices the card badly. They are a slightly different size, carry Japanese characters in the name and attack text, and usually print the card number without a set total.\n\nOTHER RULES:\n- If a back image is provided, TRUST THE BACK for card number, set name, and copyright year \u2014 printed text beats inferring from the front design.\n- If the card is in a graded slab, read the label for company, grade, year, player, set, and card number.\n- isRookie, isAutograph, isPatch must be true or false booleans.\n- signal must be one of: GRADE, WATCH, SELL RAW, HOT, VERIFY.\n- confidence must be High, Medium, or Low. Use Low if the image is blurry or you are unsure about the parallel.\n- Never guess a dollar value. Never include price fields." },
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

    // compact=1 is sent by the scanner's refinement chips — half the records.
    const compact = req.query.compact === "1" || req.query.compact === "true";

    const market = await getEbayCardMarket(query);
    const clean  = normalizeCardQuery(query);
    const sold   = await getSoldComps(clean, market.avgPrice, compact);

    res.json({
      success:           true,
      cardName:          clean,
      searchQuery:       clean,
      sold:              sold || null,
      askVsSold:         askVsSold(market, sold),
      avgPrice:          market.avgPrice,
      avgSoldPrice:      market.avgPrice,
      lowPrice:          market.lowPrice,
      highPrice:         market.highPrice,
      listingCount:      market.listingCount,
      soldCount:         (sold && sold.soldCount) || 0,
      image:             market.image,
      priceSource:       market.priceSource,
      spreadRatio:       market.spreadRatio,
      wideSpread:        market.wideSpread,
      spreadNote:        market.spreadNote || "",
      matchQuality:      market.matchQuality || (market.listingCount ? "exact" : "none"),
      priceNote:         market.priceNote  || (market.listingCount ? "" : "No clean card listings found."),
      raw:               market.raw,
      graded:            market.graded,
      gradeBreakdown:    market.gradeBreakdown,
      listings:          market.listings,
      soldCompsUrl:      ebayUrl(clean, true),
      activeListingsUrl: ebayUrl(clean, false),

      /* Structured fields, so a card saved from the SEARCH box lands in
         the binder as sortable data rather than one opaque string. The
         scan path gets these from the AI reading the card; here they are
         parsed out of what the user typed.

         Spread flat rather than nested so the frontend reads them the
         same way on both paths — the save code shouldn't have to know
         which one it came from. Anything the parser isn't sure of comes
         back null, and a null is honest: a wrong player name is worse
         than no player name, because it gets sorted as if it were true. */
      ...parseCardQuery(clean)
    });
  } catch (error) {
    res.status(500).json({ success: false, error: "Card market lookup failed", details: error.message });
  }
});

/* ── /api/parse-bulk ────────────────────────────────────────────
   Turns a pasted list into structured rows.

   Lives on the server so there is ONE parser. The obvious alternative
   was a copy in the browser for instant preview, and a copy is how two
   implementations quietly stop agreeing — which is exactly the bug that
   put "Topps Chrome" in the brand column on one path and "Topps" plus
   "Chrome" on the other.

   Costs nothing to run: no AI, no eBay, no thecardapi. It is string work
   on text the user already typed, which is the whole point. Somebody with
   a thousand cards can get them in without spending a thousand vision
   calls, then price them later a batch at a time.
   ──────────────────────────────────────────────────────────────── */
const BULK_MAX_LINES = 200;

app.post("/api/parse-bulk", (req, res) => {
  try {
    let lines = req.body && req.body.lines;

    // Accept an array or one blob of text — a paste is a blob.
    if (typeof lines === "string") lines = lines.split(/\r?\n/);
    if (!Array.isArray(lines)) {
      return res.status(400).json({ success: false, error: "Send lines as an array or a string" });
    }

    const cleaned = lines
      .map(l => String(l || "").replace(/\s+/g, " ").trim())
      /* Drop the scaffolding people paste along with the cards: bullets
         and leading list numbers. In "12. 2018 Topps Ohtani" the 12 is
         not part of the card's name. */
      .map(l => l.replace(/^[-*\u2022]\s*/, "").replace(/^\d{1,3}[.)]\s+/, ""))
      .filter(l => l.length > 1);

    const overflow = Math.max(0, cleaned.length - BULK_MAX_LINES);
    const use = cleaned.slice(0, BULK_MAX_LINES);

    /* The same text twice in one paste is nearly always a duplicated
       line rather than two copies of a card. Flag it, don't drop it —
       the person deciding is better placed than we are. */
    const seen = {};
    const rows = use.map((line, idx) => {
      const key = line.toLowerCase();
      const dupe = !!seen[key];
      seen[key] = true;
      const p = parseCardQuery(line);
      return {
        index:      idx,
        line:       line,
        cardName:   line.slice(0, 200),
        year:       p.year,
        brand:      p.brand,
        set:        p.set,
        player:     p.player,
        parallel:   p.parallel,
        duplicate:  dupe,
        /* How much the parser actually recognised, so the UI can show
           which lines are worth a second look before they are saved. */
        confidence: [p.year, p.brand, p.player].filter(Boolean).length
      };
    });

    res.json({
      success: true,
      count:   rows.length,
      skipped: overflow,
      max:     BULK_MAX_LINES,
      note:    overflow
        ? ("Only the first " + BULK_MAX_LINES + " lines were read. Paste the rest separately.")
        : "",
      rows: rows
    });
  } catch (error) {
    res.status(500).json({ success: false, error: "Could not read that list", details: error.message });
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
      soldCount:         0,   // this endpoint does not fetch sold data
      image:             market.image,
      priceSource:       market.priceSource,
      spreadRatio:       market.spreadRatio,
      wideSpread:        market.wideSpread,
      spreadNote:        market.spreadNote || "",
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

      /* An insert is not the base card and does not trade like one. The
         model now reports it separately; folding it into `set` is what
         makes it reach the eBay keywords and the display name, which is
         where it needs to be. Guarded so an insert name that duplicates
         the set is not written twice. */
      const insertName = cleanVal(ai.insert);
      if (insertName && !GENERIC_SET.test(insertName)) {
        const existingSet = cleanVal(ai.set);
        if (!existingSet || existingSet.toLowerCase().indexOf(insertName.toLowerCase()) < 0) {
          ai.set = joinParts([existingSet, insertName]);
        }
      }

      const cleanCardName = buildDisplayName(ai);

      /* Verification runs alongside the price lookup rather than before
         it. Sequencing them would add its latency to every scan for a
         check that usually passes; in parallel it is nearly free in
         wall-clock time and the result is ready when the response is
         assembled. */
      const verifyPromise = verifyAgainstCatalog(ai);

      const market        = await getCardMarketForCard(ai);
      const searchQuery   = market.searchQuery || buildCardQuery(ai) || cleanCardName;
      const sold          = await getSoldComps(searchQuery, market.avgPrice);
      const verification  = await verifyPromise;

      console.log(
        "[scan] " + cleanCardName +
        " | back=" + (back ? "yes" : "no") +
        " | parallel=" + (ai.parallel || "-") +
        " | insert=" + (insertName || "-") +
        " | serial=" + (ai.serialNumber || "-") +
        " | q=" + searchQuery +
        " | tier=" + (market.tierUsed || "-") +
        " | match=" + (market.matchQuality || "-") +
        " | n=" + market.listingCount +
        " | ask=$" + market.avgPrice +
        " | sold=$" + (sold && sold.soldMedian ? sold.soldMedian : "-") +
        " (" + (sold ? sold.soldCount : 0) + " sales" + (sold && sold.cached ? ", cached" : "") + ")" +
        (sold && sold.soldContaminated ? " | CONTAMINATED" : "") +
        " | verified=" + (verification.checked
            ? (verification.exists === true ? "yes" : verification.exists === false ? "NO" : "?")
            : "skipped")
      );

      return res.json({
        success:           true,
        cardName:          cleanCardName || "Unknown Trading Card",
        player:            ai.player     || "Unknown",
        year:              ai.year       || "Unknown",
        /* Resolved from the code the model READ, not the name it
           inferred. See resolvePokemonSet — the model guessing at
           unfamiliar codes was producing confidently wrong set names. */
        set:               resolvePokemonSet(ai) || "Unknown",
        setCode:           String(ai.setCode || "").trim().toUpperCase() || null,
        insert:            insertName || "",
        brand:             ai.brand      || "Unknown",
        cardNumber:        ai.cardNumber || "Unknown",
        sport:             ai.sport      || "Unknown",
        parallel:          ai.parallel      || "",
        /* WHAT IT COULD NOT RULE OUT.

           A tonal parallel — Sepia against a base Refractor, Hyper
           against Silver — is a tint on a foil surface, and a phone
           photo under a kitchen light frequently cannot separate them.
           Naming one confidently is how a card worth $70 gets priced
           at $3,575.

           So the model now returns the family it is sure of and every
           candidate it cannot eliminate. The frontend offers them as a
           choice rather than picking for somebody. Same principle as
           refusing a mixed median: an honest question beats a
           confident wrong answer. */
        parallelOptions:   Array.isArray(ai.parallelOptions)
                             ? ai.parallelOptions.filter(Boolean).map(function(x){
                                 return String(x).slice(0,40); }).slice(0,6)
                             : [],
        parallelCertain:   ai.parallelCertain !== false,
        serialNumber:      ai.serialNumber  || "",
        isRookie:          !!ai.isRookie,
        isAutograph:       !!ai.isAutograph,
        isPatch:           !!ai.isPatch,
        usedBack:          !!back,
        searchQuery:       searchQuery,
        sold:              sold || null,
        askVsSold:         askVsSold(market, sold),
        matchQuality:      market.matchQuality || "exact",
        tierUsed:          market.tierUsed     || "",
        priceNote:         market.priceNote    || "",
        spreadNote:        market.spreadNote   || "",
        signal:            ai.signal     || "VERIFY",
        confidence:        ai.confidence || "Medium",

        /* A second opinion from the catalog. Deliberately reported
           alongside the read rather than folded into it: if this ever
           silently replaced a field, somebody would see a confident
           answer with no way to know it had been swapped.

           verified.exists === false is the useful one. It means the set
           is real and the card number is not in it, which is what a
           misread looks like from the outside. */
        verified:          verification,
        summary:           ai.summary    || "AI scan complete. Verify exact version, condition, and comps.",
        avgSoldPrice:      market.avgPrice,
        avgPrice:          market.avgPrice,
        lowPrice:          market.lowPrice,
        highPrice:         market.highPrice,
        listingCount:      market.listingCount,
        soldCount:         (sold && sold.soldCount) || 0,
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

/* ══════════════════════════════════════════════════════════════
   PSA CERT LOOKUP — scan a graded slab's barcode instead of the card.

   PSA already knows exactly what's inside the holder — player, year,
   set, card number, and the grade itself. There is no reason to run
   that through the AI vision identification step at all; this skips
   straight to pricing using PSA's own ground truth.

   REAL, OFFICIAL, FREE API — not scraping. Docs:
   https://www.psacard.com/publicapi/documentation
   Get a token by registering at https://www.psacard.com/publicapi
   with a PSA account, then set PSA_API_TOKEN in Render's env vars.

   THE ONE HONEST UNKNOWN: PSA's docs show the request pattern but not
   the full response JSON schema. Rather than guess at field names and
   silently return blank fields, this logs the raw response on every
   call until the mapping below has been confirmed against a real cert
   number — cheap insurance against shipping a broken field map. */
const PSA_API_TOKEN = process.env.PSA_API_TOKEN || "";
const PSA_API_BASE = "https://api.psacard.com/publicapi";

/* Defensive across likely casings, since the exact schema isn't
   confirmed yet. Tries PascalCase (a .NET-style API, which the
   GetByCertNumber naming convention suggests) and camelCase, and
   falls back gracefully rather than throwing on an unexpected shape. */
function pick(obj, ...keys) {
  for (const k of keys) {
    if (obj && obj[k] != null && obj[k] !== "") return obj[k];
  }
  return null;
}

async function fetchPsaCert(certNumber) {
  if (!PSA_API_TOKEN) return { ok: false, reason: "PSA_API_TOKEN not configured" };
  const clean = String(certNumber || "").replace(/[^0-9]/g, "");
  if (!clean) return { ok: false, reason: "No cert number provided" };

  try {
    const r = await fetch(PSA_API_BASE + "/cert/GetByCertNumber/" + clean, {
      headers: { Authorization: "bearer " + PSA_API_TOKEN }
    });
    if (!r.ok) {
      console.log("[psa] HTTP " + r.status + " for cert " + clean);
      return { ok: false, reason: "PSA API returned " + r.status };
    }
    const body = await r.json();

    /* Logged until the field mapping below is confirmed against a
       real response — see the note above. Safe to remove once we've
       verified this once. */
    console.log("[psa] raw response for cert " + clean + ":", JSON.stringify(body).slice(0, 800));

    if (body && body.IsValidRequest === false) {
      return { ok: false, reason: body.ServerMessage || "Invalid cert number" };
    }
    if (body && body.ServerMessage === "No data found") {
      return { ok: false, reason: "No PSA record found for that cert number" };
    }

    // The cert payload may be nested under a PSACert-style key, or flat.
    const cert = body.PSACert || body.psaCert || body.Cert || body.cert || body;

    const parsed = {
      certNumber:   clean,
      player:       pick(cert, "Subject", "subject", "PlayerName", "playerName") || "Unknown",
      year:         pick(cert, "Year", "year") || "Unknown",
      brand:        pick(cert, "Brand", "brand") || "Unknown",
      set:          pick(cert, "Variety", "variety", "Set", "set") || "",
      cardNumber:   pick(cert, "CardNumber", "cardNumber", "CardNo", "cardNo") || "Unknown",
      grade:        pick(cert, "CardGrade", "cardGrade", "Grade", "grade"),
      gradeDescription: pick(cert, "GradeDescription", "gradeDescription") || "",
      sport:        pick(cert, "Category", "category", "Sport", "sport") || "Unknown",
      isAutograph:  !!(pick(cert, "IsDualCert", "isDualCert") || /auto/i.test(String(pick(cert, "Subject", "subject") || ""))),
      raw: body
    };

    return { ok: true, data: parsed };
  } catch (e) {
    console.log("[psa] error:", e.message);
    return { ok: false, reason: e.message };
  }
}

app.get("/api/psa-cert", async (req, res) => {
  const certNumber = req.query.cert;
  if (!certNumber) return res.status(400).json({ success: false, error: "cert number required" });

  const psa = await fetchPsaCert(certNumber);
  if (!psa.ok) {
    return res.json({ success: false, error: psa.reason });
  }

  const d = psa.data;

  /* Feed straight into the existing pricing pipeline — same path a
     photo scan uses, just skipping AI identification because PSA
     already told us exactly what this is. */
  const ai = {
    cardName: [d.year, d.brand, d.set, d.player].filter(Boolean).join(" "),
    player: d.player, year: d.year, brand: d.brand, set: d.set,
    cardNumber: d.cardNumber, sport: d.sport,
    parallel: "", serialNumber: "", isRookie: false,
    isAutograph: d.isAutograph, isPatch: false,
    gradeCompany: "PSA", gradeValue: d.grade
  };

  const cleanCardName = buildDisplayName(ai);
  const market = await getCardMarketForCard(ai);
  const searchQuery = market.searchQuery || buildCardQuery(ai) || cleanCardName;
  const sold = await getSoldComps(searchQuery, market.avgPrice);

  console.log("[psa] " + cleanCardName + " | PSA " + d.grade + " | cert " + d.certNumber +
    " | sold=$" + (sold && sold.soldMedian ? sold.soldMedian : "-"));

  res.json({
    success: true,
    source: "psa_cert",
    certNumber: d.certNumber,
    cardName: cleanCardName || "Unknown Trading Card",
    player: d.player, year: d.year, set: d.set || "Unknown",
    brand: d.brand, cardNumber: d.cardNumber, sport: d.sport,
    parallel: "", serialNumber: "", isRookie: false,
    isAutograph: d.isAutograph, isPatch: false, usedBack: false,
    gradeCompany: "PSA", gradeValue: d.grade, gradeDescription: d.gradeDescription,
    signal: "GRADE", confidence: "High",
    searchQuery: searchQuery,
    sold: sold || null,
    askVsSold: askVsSold(market, sold),
    matchQuality: market.matchQuality || "exact",
    tierUsed: market.tierUsed || "",
    priceNote: market.priceNote || "",
    spreadNote: market.spreadNote || "",
    avgSoldPrice: market.avgPrice, avgPrice: market.avgPrice,
    lowPrice: market.lowPrice, highPrice: market.highPrice,
    listingCount: market.listingCount,
    soldCount: (sold && sold.soldCount) || 0,
    spreadRatio: market.spreadRatio, wideSpread: market.wideSpread,
    raw: market.raw, graded: market.graded, gradeBreakdown: market.gradeBreakdown,
    image: market.image, priceSource: market.priceSource,
    listings: market.listings,
    soldCompsUrl: ebayUrl(searchQuery, true),
    activeListingsUrl: ebayUrl(searchQuery, false),
    summary: "Identified from PSA cert " + d.certNumber + " — grade and card details are PSA's own record, not an AI guess.",
    timestamp: Date.now()
  });
});

// ── /api/grade-estimate ────────────────────────────────────────
//
//  Powers /grade-prescreen. The page was live and linked from both
//  scanners, but this endpoint did not exist — every submission returned
//  "endpoint not found".
//
//  Two rules govern the whole thing:
//
//   1. It is a PRE-SCREEN, not a grade. A camera cannot see the fine
//      scratches and print lines a grader catches under magnification, so
//      the answer is a RANGE and the surface score is always the least
//      trustworthy number on the page.
//
//   2. What the user reports from having the card in hand may only ever
//      LOWER the estimate. The page promises this in writing. Someone
//      holding the card knows more than the photo does about damage, but
//      "looks clean to me" is not evidence of a 10.
// ═══════════════════════════════════════════════════════════════

/* Hard ceilings. A crease is the brutal one — graders cap creased cards
   in the 2-4 range no matter how good everything else looks, which is
   exactly the outcome someone needs to know BEFORE paying to submit. */
const CONDITION_CAPS = {
  surface: {
    "clean": 10,
    "light scratches": 8,
    "visible scratches or print lines": 6
  },
  corners: {
    "sharp": 10,
    "slight softness": 8,
    "rounded or dinged": 6
  },
  edges: {
    "clean": 10,
    "minor whitening": 8,
    "chipping or heavy whitening": 6
  },
  creases: {
    "none": 10,
    "has a crease or bend": 3
  }
};

// Sub-scores (0-100) the reported condition also can't exceed.
const CONDITION_SUB_CAPS = {
  surface: { "light scratches": 62, "visible scratches or print lines": 34 },
  corners: { "slight softness": 62, "rounded or dinged": 34 },
  edges:   { "minor whitening": 62, "chipping or heavy whitening": 34 },
  creases: { "has a crease or bend": 20 }
};

const GRADE_FALLBACK = (reason) => ({
  gradeLow: 0, gradeHigh: 0,
  subgrades: { centering: 0, corners: 0, edges: 0, surface: 0 },
  findings: [], confidence: "Lower", cardName: "",
  summary: reason
});

async function gradeWithOpenAI(frontFile, backFile, condition, notes) {
  if (!process.env.OPENAI_API_KEY) return GRADE_FALLBACK("OpenAI API key missing.");

  const images = [{ type: "image_url", image_url: { url: fileToDataUrl(frontFile) } }];
  if (backFile) images.push({ type: "image_url", image_url: { url: fileToDataUrl(backFile) } });

  const reported = Object.keys(condition || {})
    .filter(k => condition[k])
    .map(k => k + ": " + condition[k])
    .join("; ");

  const userText =
    "Pre-screen this trading card for grading. Return ONLY a JSON object with these exact keys: "
    + "cardName, gradeLow, gradeHigh, centering, corners, edges, surface, findings, confidence, summary.\\n\\n"
    + "HOW TO SCORE:\\n"
    + "- gradeLow and gradeHigh are WHOLE NUMBERS from 1 to 10 describing the likely PSA range. "
    + "The gap between them is your uncertainty — never return the same number for both unless the card is obviously damaged.\\n"
    + "- centering, corners, edges and surface are each 0-100.\\n"
    + "- BE CONSERVATIVE. A 10 requires near-perfect centering, four sharp corners, clean edges and a flawless surface. "
    + "Most raw cards from a pack are 8-9. If you are unsure, score lower and widen the range.\\n"
    + "- CENTERING is the one factor a photo shows reliably: compare the border widths left-to-right and top-to-bottom on BOTH sides. "
    + "A 60/40 border is roughly a 9; 65/35 is an 8; worse than 70/30 caps most cards at 7.\\n"
    + "- SURFACE is the least reliable from a photo. Say so in your summary and keep the range wide unless damage is clearly visible.\\n"
    + "- findings is an array of 2-5 SHORT plain-English observations, each naming what you saw and where "
    + "(e.g. 'Left border noticeably wider than right on the front', 'Slight whitening along the bottom edge'). "
    + "Never invent a flaw you cannot see. If the card looks clean, say that.\\n"
    + "- confidence must be exactly one of: Lower, Moderate, Higher. Use Lower when only one side was provided, "
    + "when the photo is blurry or glare-heavy, or when the card is sleeved.\\n"
    + "- cardName: identify the card if you can (year, brand, set, player). Empty string if you cannot.\\n"
    + "- Never estimate a dollar value.\\n\\n"
    + (reported ? ("THE OWNER IS HOLDING THE CARD AND REPORTS: " + reported
        + ". Treat this as reliable evidence of damage the photo may not show. It may lower your scores. "
        + "It must NEVER raise them.\\n") : "")
    + (notes ? ("OWNER'S NOTES: " + String(notes).slice(0, 500) + "\\n") : "")
    + (backFile ? "" : "ONLY THE FRONT was provided — centering and edges cannot be fully judged. Use Lower confidence and widen the range.\\n");

  const payload = {
    /* Same reasoning as the scan above, and arguably stronger: judging
       centering and corner wear off a photo is harder vision than
       reading a logo, and being wrong here costs somebody a $25
       grading fee on a card that was never going to make the grade. */
    model: "gpt-4o",
    messages: [
      { role: "system", content: "You are a conservative trading card grading pre-screener. You examine photos and estimate a likely grade RANGE, never a single definitive grade. You know a camera cannot resolve fine surface scratches or print lines, and you say so. You return ONLY valid JSON with no markdown, no code fences, and no commentary. You never estimate dollar values. You would rather under-promise a grade than have someone waste money on a submission." },
      { role: "user", content: [{ type: "text", text: userText }, ...images] }
    ],
    temperature: 0.2,
    max_tokens: 800
  };

  try {
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
      console.error("[grade] OpenAI error:", rawText.slice(0, 300));
      return GRADE_FALLBACK("AI could not read this card.");
    }
    const apiData = JSON.parse(rawText);
    const content = (apiData && apiData.choices && apiData.choices[0]
                     && apiData.choices[0].message && apiData.choices[0].message.content) || "";
    return JSON.parse(cleanJsonText(content));
  } catch (e) {
    console.log("[grade] parse/network error:", e.message);
    return GRADE_FALLBACK("AI result could not be read.");
  }
}

function clampGrade(n, fallback) {
  const v = Math.round(Number(n));
  if (!Number.isFinite(v) || v < 1 || v > 10) return fallback;
  return v;
}
function clampSub(n) {
  const v = Math.round(Number(n));
  if (!Number.isFinite(v)) return 0;
  return Math.max(0, Math.min(100, v));
}

app.post(
  "/api/grade-estimate",
  upload.fields([{ name: "front", maxCount: 1 }, { name: "back", maxCount: 1 }]),
  async (req, res) => {
    try {
      const front = (req.files && req.files.front && req.files.front[0]) || null;
      const back  = (req.files && req.files.back  && req.files.back[0])  || null;
      if (!front) return res.status(400).json({ success: false, error: "Front image required" });

      let condition = {};
      try { condition = JSON.parse(req.body.condition || "{}") || {}; } catch (e) { condition = {}; }
      const notes = String(req.body.notes || "").slice(0, 500);

      const ai = await gradeWithOpenAI(front, back, condition, notes);

      let low  = clampGrade(ai.gradeLow, 0);
      let high = clampGrade(ai.gradeHigh, 0);
      if (!low && !high) {
        return res.json({
          success: false,
          error: ai.summary || "Could not pre-screen this card. Try a flatter, brighter photo."
        });
      }
      if (!low)  low  = Math.max(1, high - 2);
      if (!high) high = Math.min(10, low + 2);
      if (low > high) { const t = low; low = high; high = t; }

      const subs = {
        centering: clampSub(ai.centering),
        corners:   clampSub(ai.corners),
        edges:     clampSub(ai.edges),
        surface:   clampSub(ai.surface)
      };

      /* Apply what the owner reported. Downward only — the page promises
         exactly that, and it is the honest direction anyway: a hand can
         confirm damage a camera missed, but "looks clean to me" is not
         evidence of a 10. */
      const capsHit = [];
      Object.keys(CONDITION_CAPS).forEach(group => {
        const val = condition[group];
        if (!val) return;
        const cap = CONDITION_CAPS[group][val];
        if (cap != null && high > cap) {
          high = cap;
          capsHit.push(group + " (" + val + ")");
        }
        if (cap != null && low > cap) low = Math.max(1, cap - 1);

        const subCap = CONDITION_SUB_CAPS[group] && CONDITION_SUB_CAPS[group][val];
        if (subCap != null) {
          const target = group === "creases" ? "surface" : group;
          if (subs[target] > subCap) subs[target] = subCap;
        }
      });
      if (low > high) low = high;

      /* A crease is the one flaw worth stating outright. Graders cap
         creased cards in the low single digits regardless of how good the
         rest of the card looks, and that is precisely what somebody needs
         to hear BEFORE paying for a submission. */
      const creased = condition.creases === "has a crease or bend";

      let confidence = String(ai.confidence || "Moderate");
      if (!/^(Lower|Moderate|Higher)$/i.test(confidence)) confidence = "Moderate";
      if (!back) confidence = "Lower";
      if (capsHit.length && !/lower/i.test(confidence)) confidence = "Moderate";

      const findings = Array.isArray(ai.findings)
        ? ai.findings.filter(Boolean).map(f => String(f).slice(0, 160)).slice(0, 5)
        : [];
      if (creased) {
        findings.unshift("You reported a crease or bend — graders cap creased cards at roughly a 3, whatever else the card has going for it.");
      }
      if (!back) {
        findings.push("Only the front was uploaded, so back centering and edges could not be checked.");
      }

      const surfaceCaveat = creased
        ? "A crease is the one thing that makes this decision easy: at a 3 or below, grading almost never pays unless the card is genuinely rare. Check sold comps for graded 3s before you spend anything."
        : "Surface is the factor a photo shows worst. Graders catch fine scratches and print lines under magnification and strong light that a camera will not resolve — the real grade can land below this range for reasons no photo would have revealed.";

      console.log(
        "[grade] " + (ai.cardName || "unidentified") +
        " | back=" + (back ? "yes" : "no") +
        " | range=" + low + "-" + high +
        " | conf=" + confidence +
        " | reported=" + (Object.keys(condition).filter(k => condition[k]).length || 0) +
        " | caps=" + (capsHit.join(",") || "-")
      );

      return res.json({
        success: true,
        cardName: String(ai.cardName || ""),
        gradeLow: low,
        gradeHigh: high,
        confidence: confidence,
        subgrades: subs,
        findings: findings,
        surfaceCaveat: surfaceCaveat,
        usedBack: !!back,
        reportedCondition: condition,
        summary: String(ai.summary || ""),
        timestamp: Date.now()
      });
    } catch (error) {
      console.error("[grade] server error:", error);
      return res.status(500).json({ success: false, error: "Pre-screen failed on server", details: error.message });
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
    const compact = req.query.compact === "1" || req.query.compact === "true";
    const market  = await getEbayCardMarket(query);
    const sold    = await getSoldComps(query, market.avgPrice, compact);
    res.json({
      success:   true,
      available: !!(sold && !sold.rateLimited),
      query:     normalizeCardQuery(query),
      cacheKey:  cacheKeyFor(query, compact ? CARDAPI_LIMIT_COMPACT : CARDAPI_LIMIT),
      askMedian: market.avgPrice,
      sold:      sold || null,
      askVsSold: askVsSold(market, sold)
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

/* ── UP, DOWN, OR NEITHER ───────────────────────────────────────

   The old Beckett guides put an arrow next to every card. They could,
   because they compared monthly issues over dense data on cards that
   traded constantly.

   This does not have that. A 30-day median can rest on four sales, and
   if one $40 sale ages out while a $55 one arrives, the median jumps
   30% without the card having moved at all. An arrow on that is the
   same failure as a confident price on a mixed search: a number that
   sounds certain and describes nothing.

   So the arrow has to earn its place three times over:

     - enough sales on BOTH sides of the comparison, not just recently
     - a move big enough to clear the noise those few sales create
     - two windows far enough apart to be different periods

   Most cards will fail one of those and show a flat dash. That is the
   honest answer for a card that traded six times in a month, and a
   dash that means "we don't know" is worth more than an arrow that
   means nothing.
   ─────────────────────────────────────────────────────────────── */

const MOVE_WINDOW_DAYS = 15;   // each half of the comparison
const MOVE_MIN_SALES   = 4;    // per side — below this, medians are noise
const MOVE_MIN_PCT     = 8;    // smaller than this is not a movement

function medianOf(nums) {
  const a = nums.filter(n => typeof n === "number" && isFinite(n) && n > 0).sort((x, y) => x - y);
  if (!a.length) return null;
  const m = Math.floor(a.length / 2);
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
}

/* Returns one of: up, down, flat, unknown — and always says why. The
   reason is not decoration; a dash with no explanation reads as broken,
   and a dash that says "only 3 sales" reads as careful. */
function movementFrom(points) {
  const out = { direction: "unknown", pct: null, reason: "", recent: null, prior: null,
                recentSales: 0, priorSales: 0 };
  if (!Array.isArray(points) || !points.length) {
    out.reason = "No price history for this card yet.";
    return out;
  }

  const now  = Date.now();
  const dayMs = 86400000;
  const recentCut = now - MOVE_WINDOW_DAYS * dayMs;
  const priorCut  = now - MOVE_WINDOW_DAYS * 2 * dayMs;

  const recent = [], prior = [];
  let recentSales = 0, priorSales = 0;

  points.forEach(p => {
    const t = new Date(p.sale_date + "T12:00:00Z").getTime();
    const v = Number(p.sold_median);
    const n = Number(p.sold_count) || 0;
    if (!isFinite(t) || !(v > 0)) return;
    if (t >= recentCut)      { recent.push(v); recentSales += n; }
    else if (t >= priorCut)  { prior.push(v);  priorSales  += n; }
  });

  out.recentSales = recentSales;
  out.priorSales  = priorSales;

  if (!recent.length || !prior.length) {
    out.reason = "Not enough history yet \u2014 we need about a month to compare two periods.";
    return out;
  }

  /* The gate that matters. Two medians built on a handful of sales each
     will disagree by 20% on nothing at all. */
  if (recentSales < MOVE_MIN_SALES || priorSales < MOVE_MIN_SALES) {
    out.reason = "Too few sales to call it \u2014 " + recentSales + " recently against " +
                 priorSales + " before that. Below " + MOVE_MIN_SALES +
                 " a side, the median moves on which cards happened to sell.";
    return out;
  }

  const r = medianOf(recent), p = medianOf(prior);
  if (!r || !p) { out.reason = "No usable prices in one of the periods."; return out; }

  out.recent = Math.round(r);
  out.prior  = Math.round(p);
  const pct = ((r - p) / p) * 100;
  out.pct = Math.round(pct * 10) / 10;

  if (Math.abs(pct) < MOVE_MIN_PCT) {
    out.direction = "flat";
    out.reason = "Holding steady \u2014 moved " + (pct >= 0 ? "+" : "") + out.pct +
                 "%, which is inside the noise on this many sales.";
    return out;
  }

  out.direction = pct > 0 ? "up" : "down";
  out.reason = "Median of the last " + MOVE_WINDOW_DAYS + " days against the " +
               MOVE_WINDOW_DAYS + " before it, on " + (recentSales + priorSales) + " sales.";
  return out;
}

/* GET /api/card-movement?query=...
   One card. The binder asks for several, so it batches below. */
app.get("/api/card-movement", async (req, res) => {
  try {
    const query = String(req.query.query || "").trim();
    if (!query) return res.status(400).json({ success: false, error: "query required" });
    if (!supabaseAdmin) return res.json({ success: true, movement: { direction: "unknown",
                                          reason: "History not configured." } });

    const { data, error } = await supabaseAdmin
      .from("card_price_history")
      .select("sale_date,sold_median,sold_count")
      .eq("cache_key", cacheKeyFor(query))
      .gte("sale_date", daysAgoISO(MOVE_WINDOW_DAYS * 2 + 2))
      .order("sale_date", { ascending: true });
    if (error) throw new Error(error.message);

    res.set("Cache-Control", "no-store");
    res.json({ success: true, query: query, movement: movementFrom(data || []) });
  } catch (error) {
    res.json({ success: false, error: error.message });
  }
});

/* POST /api/card-movement-batch  { queries: [...] }
   A binder with sixty cards should be one request, not sixty. */
app.post("/api/card-movement-batch", async (req, res) => {
  try {
    let queries = (req.body && req.body.queries) || [];
    if (!Array.isArray(queries)) return res.status(400).json({ success: false, error: "queries must be an array" });
    queries = queries.map(q => String(q || "").trim()).filter(Boolean).slice(0, 300);
    if (!queries.length || !supabaseAdmin) return res.json({ success: true, movements: {} });

    const keys = [...new Set(queries.map(cacheKeyFor))];
    const { data, error } = await supabaseAdmin
      .from("card_price_history")
      .select("cache_key,sale_date,sold_median,sold_count")
      .in("cache_key", keys)
      .gte("sale_date", daysAgoISO(MOVE_WINDOW_DAYS * 2 + 2))
      .order("sale_date", { ascending: true });
    if (error) throw new Error(error.message);

    const byKey = {};
    (data || []).forEach(r => { (byKey[r.cache_key] = byKey[r.cache_key] || []).push(r); });

    const movements = {};
    queries.forEach(q => { movements[q] = movementFrom(byKey[cacheKeyFor(q)] || []); });

    res.set("Cache-Control", "no-store");
    res.json({ success: true, movements: movements });
  } catch (error) {
    res.json({ success: false, error: error.message });
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
      lookbackDays:  CARDAPI_LOOKBACK,
      cacheTtlHours: CACHE_TTL_HOURS,
      recordLimit:        CARDAPI_LIMIT,
      recordLimitCompact: CARDAPI_LIMIT_COMPACT,
      soldLogicVersion:   SOLD_LOGIC_VERSION
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

/* ── CATALOG: HOW MANY CARDS ARE IN THIS SET? ───────────────────

   Set completion needs exactly one number a collection cannot supply:
   the size of the set. You cannot learn "792" from owning 780 — that is
   precisely the number you do not have. Until now the person had to
   type it.

   The Catalog knows. But its allowance is the tightest budget in the
   whole system: 500 records a day on Builder, and EVERY RECORD RETURNED
   COUNTS AS ONE. A careless implementation would spend that before
   lunch.

   Three decisions follow from that:

   1. Ask for the smallest useful page. Five candidate sets, not a
      hundred. Five records per lookup means a hundred lookups a day,
      which is far more than this will ever need.

   2. Cache the answer permanently and share it across every user. A
      set's card count does not change — 1952 Topps has the same number
      of cards as it did last year. The first person to look it up pays
      the records; everyone after reads Supabase for free.

   3. Cache MISSES too. Without that, a set the Catalog does not carry
      gets re-queried on every page load, draining the pool for nothing
      and returning nothing each time.

   The full checklist — which specific cards a set contains, and so
   which ones are missing — is a separate and much more expensive
   question: a 792-card set costs 792 records, more than a whole day on
   Builder. That is deliberately not attempted here. This endpoint
   answers "how many", which costs almost nothing and is most of what
   people want.
   ─────────────────────────────────────────────────────────────── */
const CATALOG_BASE      = "https://www.thecardapi.com/api/v1/catalog";
const CATALOG_PAGE_SIZE = 5;      // records per lookup — see note 1 above
/* 9s was too tight. Real lookups against thecardapi were aborting
   mid-flight, and the abort surfaced to the user as "we can't match
   this to a set in the catalog" — which says the set does not exist
   when the truth is that we stopped waiting. A slow answer that
   arrives beats a fast one that is wrong. */
const CATALOG_TIMEOUT   = 20000;

/* Bump this whenever the lookup gets smarter.

   A permanent cache and improving logic are a bad pair without it. The
   first version searched on text alone, so "1986 Topps" matched five
   2021 retro inserts named "1986 Topps Baseball" — and that wrong
   answer was then cached forever. Adding a year filter fixed the logic
   and changed nothing, because every affected query was already
   answered.

   A version stamp means better logic automatically retires worse
   answers. Old rows are ignored rather than deleted, so a rollback
   still has its cache. */
const CATALOG_LOGIC_VERSION = 6;
/* v6: Pokemon sets now resolve against TCGdex. Every Pokemon lookup
   before this was cached as a miss against thecardapi. */
/* v5: set names are translated to the catalog's vocabulary before the
   lookup — Topps Bowman, doubled words, and bare Panini product names
   all failed and were cached as misses. */
/* v4: sport is translated to the catalog's own vocabulary before being
   used as a filter. Every Pokemon lookup before this was cached as a
   MISS — and misses are cached deliberately, so without a bump they
   would keep returning "no matching set" forever even though the fix
   is live. This is exactly the case the version stamp exists for. */

function normaliseSetQuery(q) {
  return String(q || "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
}

async function catalogFetch(pathAndQuery) {
  if (!CARDAPI_KEY) throw new Error("no catalog key");
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), CATALOG_TIMEOUT);
  try {
    const r = await fetch(CATALOG_BASE + pathAndQuery, {
      headers: { "x-api-key": CARDAPI_KEY },
      signal: ctrl.signal
    });
    const remaining = r.headers.get("x-ratelimit-remaining");
    if (r.status === 401 || r.status === 403) throw new Error("catalog not on this plan");
    if (r.status === 429) throw new Error("catalog daily allowance used up");
    if (!r.ok) throw new Error("catalog error " + r.status);
    const body = await r.json();
    return { body: body, remaining: remaining };
  } catch (e) {
    /* An abort is a timeout, not a verdict. Naming it lets the caller
       say "this is taking too long, try again" instead of "this set
       does not exist", which is what a user was being told. */
    if (e && (e.name === "AbortError" || /abort/i.test(e.message || ""))) {
      var te = new Error("catalog timed out");
      te.timedOut = true;
      throw te;
    }
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

/* THE CATALOG FILES POKEMON UNDER "GAMING".

   The scanner records sport as "Pokemon" — correct, and what a
   collector would call it. The catalog uses "Gaming" for trading card
   games. Passing ours through as a filter therefore excluded every
   Pokemon set the catalog holds, including 1999 Base Set, which it
   carries with a full 106-card count.

   Found by calling the endpoint without a sport at all and watching it
   match instantly. Three Pokemon sets had failed in a row and the
   conclusion nearly drawn was that the catalog had no Pokemon in it.

   Anything not in this map passes through unchanged: the sports names
   already agree, and inventing translations for terms that match would
   create the same class of bug in the other direction. */
const CATALOG_SPORT = {
  "pokemon":   "Gaming",
  "pok\u00e9mon":   "Gaming",
  "gaming (tcg)": "Gaming",
  "tcg":       "Gaming",
  "magic the gathering": "Gaming",
  "yugioh":    "Gaming",
  "yu-gi-oh":  "Gaming"
};

function catalogSport(v) {
  var t = String(v || "").trim();
  if (!t) return "";
  return CATALOG_SPORT[t.toLowerCase()] || t;
}

/* ── WHAT THE CATALOG CALLS THIS SET ─────────────────────────
   The scanner records what is printed on the card. The catalog records
   what the product is filed as. Those disagree in a few specific ways,
   and each one produced a set nobody could look up:

     "Topps Bowman"  — Bowman is its own brand, not a Topps line. The
                       card says Topps on the copyright and Bowman on
                       the front, and the model reported both.
     "Prizm Prizm"   — brand and set both read as Prizm, because Prizm
                       is a Panini product and the parser falls back to
                       using the set as the brand when no manufacturer
                       is named.
     "Pokemon PFL"   — an unexpanded set code. Nothing can match it.

   Fixed here rather than in the scan, deliberately. What the model
   read off the card is not wrong, and rewriting it at the source would
   corrupt the binder's own fields — sorting, grouping and the display
   name all depend on them. This translates only the string used to ASK
   the catalog, and leaves the record intact. */
function catalogSetQuery(raw) {
  var q = String(raw || "").replace(/\s+/g, " ").trim();
  if (!q) return q;

  /* Same word twice in a row: "Prizm Prizm", "Bowman Bowman". A
     duplicate is never part of a real set name and always comes from
     brand and set having resolved to the same thing. */
  q = q.replace(/\b(\w+)(\s+\1)+\b/gi, "$1");

  /* Bowman is a Topps property but a separate brand in every catalog.
     "2023 Topps Bowman Chrome" is filed as "2023 Bowman Chrome". */
  q = q.replace(/\btopps\s+bowman\b/gi, "Bowman");

  /* Prizm, Optic, Select, Mosaic and Donruss are Panini products. The
     catalog prefixes the manufacturer; a card that only said "Prizm"
     needs it added or nothing matches. */
  if (/\b(prizm|optic|select|mosaic)\b/i.test(q) && !/\bpanini\b/i.test(q)) {
    q = q.replace(/\b(prizm|optic|select|mosaic)\b/i, "Panini $1");
  }

  return q.replace(/\s+/g, " ").trim();
}

/* ═══ POKEMON SETS COME FROM TCGDEX ═══════════════════════════
   thecardapi charges one catalog record per card and caps the day at
   400, so a 200-card Pokemon set is half a day's allowance. TCGdex
   returns the same set — every card, id, number and name — in a single
   22KB response, free, with no key and no budget.

   It also carries the number that caused a visible bug: cardCount has
   both `official` (the printed base count) and `total` (including
   secret rares). Astral Radiance showed 215 in one place and 216 in
   another because we only ever had one of those figures.

   SPORTS STAYS ON THECARDAPI. TCGdex is Pokemon only, so this is a
   branch rather than a replacement, and the response shape is
   deliberately identical so nothing downstream changes.

   Their FAQ asks that bulk users cache rather than refetch, which is
   what already happens — sets and checklists persist in Supabase and
   are shared across every user. */
const TCGDEX_BASE = "https://api.tcgdex.net/v2/en";

function isPokemonSet(sport, label) {
  var hay = (String(sport || "") + " " + String(label || "")).toLowerCase();
  return hay.indexOf("pok") > -1 || /\bgaming\b/.test(hay);
}

/* The set list is 35KB for every Pokemon set in existence, so it is
   fetched once and held for the life of the process. A cold start pays
   137ms; nothing else does. */
var tcgdexSets = null, tcgdexSetsAt = 0;
const TCGDEX_SETS_TTL = 6 * 3600 * 1000;

async function tcgdexAllSets() {
  if (tcgdexSets && (Date.now() - tcgdexSetsAt) < TCGDEX_SETS_TTL) return tcgdexSets;
  var ctrl = new AbortController();
  var timer = setTimeout(function(){ ctrl.abort(); }, 12000);
  try {
    var r = await fetch(TCGDEX_BASE + "/sets", { signal: ctrl.signal });
    if (!r.ok) throw new Error("tcgdex sets HTTP " + r.status);
    var list = await r.json();
    if (!Array.isArray(list)) throw new Error("tcgdex sets: unexpected shape");
    tcgdexSets = list; tcgdexSetsAt = Date.now();
    return list;
  } finally { clearTimeout(timer); }
}

/* Match a binder label against a TCGdex set name.

   The label is "2023 Pokemon Obsidian Flames"; the set is "Obsidian
   Flames". So the year and the word Pokemon are stripped and what
   remains is compared. Scored rather than filtered, because a hard
   match on the full string finds nothing — which is precisely how
   three Pokemon sets came to look unsupported when they were sitting
   in the database all along. */
function tcgdexMatch(sets, label) {
  var q = String(label || "").toLowerCase()
    .replace(/\b(18[5-9]\d|19\d\d|20[0-4]\d)\b/g, " ")
    .replace(/\bpok[e\u00e9]mon\b/g, " ")
    .replace(/[^a-z0-9 &]/g, " ")
    .replace(/\s+/g, " ").trim();
  if (!q) return null;

  var best = null, bestScore = 0;
  sets.forEach(function (set) {
    var n = String(set.name || "").toLowerCase()
      .replace(/[^a-z0-9 &]/g, " ").replace(/\s+/g, " ").trim();
    if (!n) return;

    var score = 0;
    if (n === q) score = 100;
    else if (n.indexOf(q) > -1 || q.indexOf(n) > -1) score = 70;
    else {
      /* Word overlap, so "Sword & Shield Evolving Skies" still matches
         a label that only says "Evolving Skies". */
      var qw = q.split(" ").filter(function(w){ return w.length > 2; });
      var nw = n.split(" ");
      var hit = qw.filter(function(w){ return nw.indexOf(w) > -1; }).length;
      if (qw.length) score = Math.round((hit / qw.length) * 60);
    }
    /* A set with no card count is no use to a checklist. */
    if (!(set.cardCount && set.cardCount.total)) score -= 30;
    if (score > bestScore) { bestScore = score; best = set; }
  });

  return bestScore >= 45 ? best : null;
}

/* Same shape /api/set-lookup already returns, so the binder cannot
   tell which source answered. */
async function tcgdexLookup(label) {
  var sets = await tcgdexAllSets();
  var hit = tcgdexMatch(sets, label);
  if (!hit) return null;
  return {
    ucid:        "TCGDEX:" + hit.id,
    set_name:    hit.name,
    year:        null,
    sport:       "Pokemon",
    /* total, not official — the checklist lists every card including
       secret rares, and a target that stops short of the list would
       read as complete while cards were still missing. */
    card_count:  (hit.cardCount && (hit.cardCount.total || hit.cardCount.official)) || null,
    parent_name: null,
    slug:        hit.id
  };
}

/* One request for the whole set. thecardapi needs one record per card
   against a 400/day cap; this is 22KB and free. */
async function tcgdexChecklist(setId) {
  var ctrl = new AbortController();
  var timer = setTimeout(function(){ ctrl.abort(); }, 12000);
  try {
    var r = await fetch(TCGDEX_BASE + "/sets/" + encodeURIComponent(setId), { signal: ctrl.signal });
    if (!r.ok) throw new Error("tcgdex set HTTP " + r.status);
    var d = await r.json();
    var cards = Array.isArray(d.cards) ? d.cards : [];
    return {
      total: (d.cardCount && (d.cardCount.total || d.cardCount.official)) || cards.length,
      cards: cards.map(function (c) {
        return {
          ucid:        "TCGDEX:" + c.id,
          set_ucid:    "TCGDEX:" + setId,
          card_number: c.localId != null ? String(c.localId) : null,
          subject:     c.name || null,
          is_rookie:   false,
          print_run:   null,
          image_url:   c.image ? (c.image + "/high.webp") : null,
          fetched_at:  new Date().toISOString()
        };
      })
    };
  } finally { clearTimeout(timer); }
}

app.get("/api/set-lookup", async (req, res) => {
  const raw = String(req.query.q || "").trim();
  /* Sport is part of the question, so it is part of the cache key.
     "1986 Topps" is 792 cards in baseball and 396 in football — same
     name, same year, same brand, different set. Caching one answer for
     both would hand a football collector a target they can never
     reach. */
  const sport = String(req.query.sport || "").trim();
  const q     = normaliseSetQuery(raw + (sport ? " :" + sport : ""));
  if (q.length < 3) {
    return res.json({ success: true, cached: false, sets: [], note: "Give us a bit more to go on." });
  }

  /* Cache first, always. This is the branch that runs almost every
     time once the common sets have been seen once. */
  if (supabaseAdmin) {
    try {
      const hit = await supabaseAdmin
        .from("catalog_set_queries").select("ucid,found,logic_version").eq("q", q).maybeSingle();
      /* An answer from an older version of the lookup is not trusted —
         it was produced by logic we have since decided was wrong. */
      if (hit.data && Number(hit.data.logic_version || 0) >= CATALOG_LOGIC_VERSION) {
        if (!hit.data.found) {
          return res.json({ success: true, cached: true, sets: [],
                            note: "No matching set in the catalog." });
        }
        const set = await supabaseAdmin
          .from("catalog_sets")
          .select("ucid,set_name,year,sport,card_count,parent_name")
          .eq("ucid", hit.data.ucid).maybeSingle();
        if (set.data) {
          return res.json({ success: true, cached: true, sets: [set.data] });
        }
      }
    } catch (e) {
      /* A cache that is down is a slow day, not a broken feature. */
      console.warn("[catalog] cache read failed:", e.message);
    }
  }

  /* Pokemon goes to TCGdex before thecardapi is consulted at all. It
     is free, faster, and returns whole checklists in one call — and
     thecardapi's Pokemon coverage was the thing that failed. Falls
     through to the paid catalog if this finds nothing, so a miss here
     costs nothing. */
  if (isPokemonSet(sport, raw)) {
    try {
      var pk = await tcgdexLookup(raw);
      if (pk) {
        if (supabaseAdmin) {
          try {
            await supabaseAdmin.from("catalog_sets").upsert(
              [Object.assign({}, pk, { fetched_at: new Date().toISOString() })],
              { onConflict: "ucid" });
            await supabaseAdmin.from("catalog_set_queries").upsert({
              q: q, ucid: pk.ucid, found: true,
              logic_version: CATALOG_LOGIC_VERSION,
              fetched_at: new Date().toISOString()
            }, { onConflict: "q" });
          } catch (e) { console.warn("[tcgdex] cache write failed:", e.message); }
        }
        res.set("Cache-Control", "no-store");
        return res.json({ success: true, cached: false, sets: [pk], source: "tcgdex" });
      }
    } catch (e) {
      /* Their outage is not a dead end — thecardapi may still have it. */
      console.warn("[tcgdex] lookup failed, falling through:", e.message);
    }
  }

  if (!CARDAPI_KEY) {
    return res.json({ success: true, cached: false, sets: [], note: "Catalog not configured." });
  }

  try {
    /* Pull the year out and send it as a filter.

       Without it, searching "1986 Topps" came back with five 2021
       products — Topps' 35th-anniversary retro inserts, which are
       literally NAMED "1986 Topps Baseball". Substring matching cannot
       tell those apart from the actual 1986 set, and the real one was
       nowhere in the results. The year is right there in the query; not
       using it was leaving the answer on the table. */
    const ym = raw.match(/\b(18[5-9]\d|19\d\d|20[0-4]\d)\b/);
    const wantYear = ym ? Number(ym[1]) : null;

    const params = new URLSearchParams({ q: catalogSetQuery(raw), limit: String(CATALOG_PAGE_SIZE) });
    if (wantYear) params.set("year", String(wantYear));
    if (sport)    params.set("sport", catalogSport(sport));

    const { body, remaining } = await catalogFetch("/sets?" + params.toString());
    const rows = Array.isArray(body && body.data) ? body.data : [];

    let sets = rows.map(r => ({
      ucid:        r.ucid || r.set_ucid || null,
      set_name:    r.set_name || r.name || "",
      year:        r.year != null ? Number(r.year) : null,
      sport:       r.sport || null,
      card_count:  Number(r.card_count || r.total_cards || r.cards || 0) || null,
      /* An insert or parallel carries its parent product. A set with no
         parent is a base set in its own right, which is almost always
         what somebody means when they name a set they're building. */
      parent_name: r.parent_set_name || r.parent_name || null,
      slug:        r.slug || null
    })).filter(x => x.ucid && x.set_name);

    /* Rank rather than filter, because a hard filter can leave nothing.
       Best first: right year and no parent beats right year alone,
       which beats a name match with the wrong year attached. */
    sets.sort((a, b) => score(b) - score(a));
    function score(x) {
      let n = 0;
      if (wantYear && x.year === wantYear) n += 4;
      /* Weighted above the base-set bonus: a football collector wants
         the 396-card football set even if a baseball set looks more
         canonical. */
      if (sport && x.sport && x.sport.toLowerCase() === sport.toLowerCase()) n += 3;
      if (!x.parent_name) n += 2;
      if (x.card_count) n += 1;
      return n;
    }

    /* The list endpoint does not carry card counts — that is what
       /sets/{ucid} is for. One extra record buys the only number this
       whole feature needs, and only for the single best match. */
    if (sets.length && !sets[0].card_count) {
      try {
        const detail = await catalogFetch("/sets/" + encodeURIComponent(sets[0].ucid));
        const d = (detail.body && (detail.body.data || detail.body)) || {};
        const count = Number(
          d.card_count || d.total_cards || d.cards || d.count ||
          (d.pagination && d.pagination.total) || 0
        );
        if (count > 0) sets[0].card_count = count;
        if (d.year != null && !sets[0].year) sets[0].year = Number(d.year);
      } catch (e) {
        console.warn("[catalog] set detail failed:", e.message);
      }
    }

    /* Write through, including the miss. */
    if (supabaseAdmin) {
      try {
        if (sets.length) {
          await supabaseAdmin.from("catalog_sets").upsert(
            sets.map(x => Object.assign({}, x, { fetched_at: new Date().toISOString() })),
            { onConflict: "ucid" }
          );
        }
        await supabaseAdmin.from("catalog_set_queries").upsert({
          q: q,
          ucid: sets.length ? sets[0].ucid : null,
          found: sets.length > 0,
          logic_version: CATALOG_LOGIC_VERSION,
          fetched_at: new Date().toISOString()
        }, { onConflict: "q" });
      } catch (e) {
        console.warn("[catalog] cache write failed:", e.message);
      }
    }

    /* A set size that is wrong stays wrong until the browser forgets
       it, and nobody knows to hard-refresh a JSON endpoint. */
    res.set("Cache-Control", "no-store");
    res.json({
      success: true,
      cached: false,
      sets: sets,
      remaining: remaining != null ? Number(remaining) : null,
      note: sets.length ? "" : "No matching set in the catalog."
    });
  } catch (error) {
    /* Never a 500 to the browser. A failed lookup means somebody types
       the number themselves, which is exactly what they did before this
       endpoint existed — the page must keep working. */
    console.warn("[catalog] lookup failed:", error.message);
    res.json({
      success: true, cached: false, sets: [],
      timedOut: !!error.timedOut,
      note: error.timedOut
        ? "The card catalog is slow right now \u2014 try again in a moment."
        : error.message
    });
  }
});

/* ── DOES THIS CARD EXIST? ──────────────────────────────────────

   Every accuracy failure this week was the same shape: the model
   produced a plausible answer and nothing checked whether the card it
   described was real. Topps read as Donruss. A 2026 Murakami came back
   as 2022. An unrecognised Pokemon code resolved to the nearest set the
   model happened to know, and the year moved to match.

   None of those are hard to catch. The catalog knows what exists — it
   is the subscription that has so far produced exactly one checklist —
   and asking it "is there a #274 in 2026 Bowman Chrome?" is a boolean,
   not an opinion.

   Three decisions shape this:

   1. It NEVER changes the answer. A verification step that quietly
      substitutes a different card is worse than no verification: the
      person sees a confident result and has no idea it was swapped.
      This annotates and, when it disagrees, says so.

   2. It costs at most a handful of records, and only when there is
      something to check. No card number means nothing to look up, so
      it does not run.

   3. It fails silent. The catalog being down, out of allowance, or not
      on the plan must leave the scan exactly as it was. Verification is
      a second opinion, not a dependency.
   ─────────────────────────────────────────────────────────────── */

const VERIFY_MAX_CANDIDATES = 5;

/* Card numbers are compared the way people write them, not the way they
   are stored: "#027", "27" and "027" are the same card, and Pokemon's
   "4/102" has to survive intact. */
function sameCardNumber(a, b) {
  const n = v => String(v == null ? "" : v).trim().toLowerCase()
                   .replace(/^#+/, "").replace(/^0+(?=\d)/, "");
  const x = n(a), y = n(b);
  return !!x && x === y;
}

async function verifyAgainstCatalog(ai) {
  const out = {
    checked:   false,      // did we get to ask?
    exists:    null,       // true / false / null when unknown
    confidence:null,       // high | medium | low
    ucid:      null,
    note:      "",
    candidates: []
  };

  if (!CARDAPI_KEY) return out;

  const number = String(ai.cardNumber || "").trim();
  const year   = parseInt(ai.year, 10);
  const brand  = String(ai.brand || "").trim();
  const setNm  = String(ai.set || "").trim();

  /* Without a card number there is nothing precise to verify. A name and
     a year match half the hobby. */
  if (!number || number.toLowerCase() === "unknown") {
    out.note = "No card number read, so nothing to check against.";
    return out;
  }

  try {
    /* Find the set first. This is the same lookup the set-size feature
       uses and it shares the same cache, so for any set somebody has
       already looked up it costs nothing at all. */
    const setQuery = [year || "", brand, setNm].filter(Boolean).join(" ").trim();
    if (!setQuery) return out;

    const params = new URLSearchParams({ q: setQuery, limit: String(VERIFY_MAX_CANDIDATES) });
    if (year)      params.set("year", String(year));
    if (ai.sport)  params.set("sport", catalogSport(ai.sport));

    const setRes = await catalogFetch("/sets?" + params.toString());
    const sets = Array.isArray(setRes.body && setRes.body.data) ? setRes.body.data : [];
    if (!sets.length) {
      out.checked = true;
      out.note = "That set isn't in the card catalog, so we couldn't confirm it.";
      return out;
    }

    /* Prefer the right year and a set with no parent — a base product
       rather than an insert inside another one. */
    sets.sort((a, b) => {
      const sc = x => (year && Number(x.year) === year ? 4 : 0)
                    + (x.parent_set_name || x.parent_name ? 0 : 2);
      return sc(b) - sc(a);
    });
    const set = sets[0];
    const setUcid = set.ucid || set.set_ucid;
    if (!setUcid) return out;

    /* Now the actual question: is there a card with this number in that
       set? One record if it exists, zero if it doesn't. */
    const cardRes = await catalogFetch("/?" + new URLSearchParams({
      set_id: setUcid, card_number: number, limit: "3"
    }).toString());
    const cards = Array.isArray(cardRes.body && cardRes.body.data) ? cardRes.body.data : [];

    out.checked = true;

    const hit = cards.find(c => sameCardNumber(c.card_number, number));
    if (hit) {
      out.exists     = true;
      out.ucid       = hit.ucid || null;
      out.confidence = "high";
      out.candidates = cards.slice(0, 3).map(c => ({
        ucid: c.ucid, card_number: c.card_number, subject: c.subject || null
      }));

      /* The card exists. Does the person on it match what the model
         said? A number that lands on a different player means the scan
         read one of the two fields wrong, and that is worth saying. */
      const said = String(ai.player || "").toLowerCase().replace(/[^a-z ]/g, "").trim();
      const real = String(hit.subject || "").toLowerCase().replace(/[^a-z ]/g, "").trim();
      if (said && real) {
        const overlap = said.split(" ").filter(w => w.length > 2 && real.indexOf(w) > -1);
        if (!overlap.length) {
          out.confidence = "low";
          out.note = "The catalog lists #" + number + " in this set as " + hit.subject +
                     ", not " + ai.player + ". One of those is wrong \u2014 worth checking " +
                     "the card number on the back.";
        }
      }
      return out;
    }

    /* The set is real and the number is not in it. That is the clearest
       possible signal that something was misread. */
    out.exists     = false;
    out.confidence = "low";
    out.note = "We couldn't find card #" + number + " in " + (set.set_name || setNm) +
               ". The number or the set may have been misread \u2014 a photo of the back " +
               "usually fixes it.";
    return out;

  } catch (e) {
    /* Allowance gone, catalog down, not on the plan. The scan stands as
       it was; a second opinion we could not get is not an error. */
    console.warn("[verify] skipped:", e.message);
    return out;
  }
}

/* ── CHECKLISTS: WHICH CARDS ARE IN THIS SET ────────────────────

   A count says "115 cards". A checklist says which 115, and that turns
   "you're 2% done" into "here are the 113 you still need" — the thing
   collectors actually want.

   The constraint is the same one that shapes everything else here: a
   checklist costs one catalog record per card, against 500 a day. A
   792-card set is more than a full day's allowance, and fetching on
   demand would spend the budget re-answering a question whose answer
   never changes.

   So it is built once and kept:

   - Pulled a page at a time, up to a daily ceiling, and RESUMED
     tomorrow if the set is large. Progress is recorded, so a half-built
     checklist is never mistaken for a complete one — "you're missing
     400 cards" would otherwise be a confident lie.

   - Stored shared, not per user. What is in 1986 Topps is not private.
     The first collector to ask pays the records; everybody after reads
     Supabase for nothing.

   - Matched on card number, normalised. That is the only field that
     reliably identifies a card within its set, and it is why photo
     scans work well here and typed searches do not — a typed query
     never yields a card number worth trusting.
   ─────────────────────────────────────────────────────────────── */
const CHECKLIST_PAGE      = 100;   // catalog max per request
const CHECKLIST_MAX_PAGES = 4;     // 400 records — leaves room for lookups

/* "#027", "27" and "27 " are the same card. Pokemon's "4/102" is not a
   fraction and must survive intact. */
function normCardNumber(v) {
  return String(v == null ? "" : v)
    .trim().toLowerCase()
    .replace(/^#+/, "")
    .replace(/^0+(?=\d)/, "");
}

async function buildChecklist(setUcid, setName, expectedTotal) {
  if (!supabaseAdmin) return { ok: false, reason: "no database" };

  /* A TCGdex set arrives whole. No paging, no daily budget, no
     "come back tomorrow" — which was the worst thing about large sets
     on the paid catalog. */
  if (String(setUcid).indexOf("TCGDEX:") === 0) {
    var prevP = null;
    try {
      var pr = await supabaseAdmin.from("catalog_checklist_progress")
        .select("*").eq("set_ucid", setUcid).maybeSingle();
      prevP = pr.data;
    } catch (e) {}
    if (prevP && prevP.complete) return { ok: true, complete: true, count: prevP.fetched_count };

    try {
      var pk = await tcgdexChecklist(String(setUcid).slice(7));
      if (pk.cards.length) {
        await supabaseAdmin.from("catalog_cards").upsert(pk.cards, { onConflict: "ucid" });
      }
      await saveProgress(setUcid, setName, pk.total, pk.cards.length, 1, true, null);
      return { ok: true, complete: true, count: pk.cards.length, total: pk.total };
    } catch (e) {
      console.warn("[tcgdex] checklist failed:", e.message);
      return { ok: true, complete: false, count: 0, paused: e.message };
    }
  }

  let prog = null;
  try {
    const r = await supabaseAdmin.from("catalog_checklist_progress")
      .select("*").eq("set_ucid", setUcid).maybeSingle();
    prog = r.data;
  } catch (e) { /* treat as first run */ }

  if (prog && prog.complete) return { ok: true, complete: true, count: prog.fetched_count };

  let page    = prog ? prog.next_page : 1;
  let fetched = prog ? prog.fetched_count : 0;
  let pages   = 0;
  let done    = false;
  let total   = (prog && prog.expected_total) || expectedTotal || null;

  while (pages < CHECKLIST_MAX_PAGES) {
    const params = new URLSearchParams({
      set_id: setUcid, page: String(page), limit: String(CHECKLIST_PAGE)
    });
    let body;
    try {
      const r = await catalogFetch("/?" + params.toString());
      body = r.body;
    } catch (e) {
      /* Out of allowance, or the catalog is down. Keep what we have and
         resume tomorrow rather than losing the partial set. */
      await saveProgress(setUcid, setName, total, fetched, page, false, e.message);
      return { ok: true, complete: false, count: fetched, total: total, paused: e.message };
    }

    const rows = Array.isArray(body && body.data) ? body.data : [];
    if (body && body.pagination && body.pagination.total) total = Number(body.pagination.total);

    if (!rows.length) { done = true; break; }

    const cards = rows.map(r => ({
      ucid:        r.ucid,
      set_ucid:    setUcid,
      card_number: r.card_number != null ? String(r.card_number) : null,
      subject:     r.subject || null,
      is_rookie:   r.is_rookie === true,
      print_run:   r.print_run != null ? Number(r.print_run) : null,
      image_url:   r.image_url_front || null,
      fetched_at:  new Date().toISOString()
    })).filter(c => c.ucid);

    if (cards.length) {
      try {
        await supabaseAdmin.from("catalog_cards").upsert(cards, { onConflict: "ucid" });
      } catch (e) {
        console.warn("[checklist] write failed:", e.message);
      }
    }

    fetched += cards.length;
    page += 1;
    pages += 1;

    if (rows.length < CHECKLIST_PAGE) { done = true; break; }
    if (total && fetched >= total)    { done = true; break; }
  }

  await saveProgress(setUcid, setName, total, fetched, page, done, null);
  return { ok: true, complete: done, count: fetched, total: total };
}

async function saveProgress(setUcid, setName, total, fetched, nextPage, complete, err) {
  if (!supabaseAdmin) return;
  try {
    await supabaseAdmin.from("catalog_checklist_progress").upsert({
      set_ucid:       setUcid,
      set_name:       setName || null,
      expected_total: total || null,
      fetched_count:  fetched,
      next_page:      nextPage,
      complete:       !!complete,
      last_error:     err || null,
      updated_at:     new Date().toISOString()
    }, { onConflict: "set_ucid" });
  } catch (e) { console.warn("[checklist] progress write failed:", e.message); }
}

/* GET /api/set-checklist?ucid=UC-...&have=27,101,US285
   Returns what is missing. `have` is the caller's card numbers — the
   diff happens here so the browser never downloads a whole set. */
app.get("/api/set-checklist", async (req, res) => {
  const ucid = String(req.query.ucid || "").trim();
  const name = String(req.query.name || "").trim();
  if (!ucid) return res.status(400).json({ success: false, error: "ucid required" });

  const have = new Set(
    String(req.query.have || "").split(",").map(normCardNumber).filter(Boolean)
  );

  try {
    const built = await buildChecklist(ucid, name, Number(req.query.total) || null);

    let cards = [];
    if (supabaseAdmin) {
      const r = await supabaseAdmin.from("catalog_cards")
        .select("card_number,subject,is_rookie,print_run")
        .eq("set_ucid", ucid)
        .order("card_number");
      if (!r.error) cards = r.data || [];
    }

    const missing = cards.filter(c => !have.has(normCardNumber(c.card_number)));

    res.set("Cache-Control", "no-store");
    res.json({
      success:  true,
      complete: !!built.complete,
      /* Stated plainly when the list is partial. A missing-card list
         built from half a checklist is worse than none — it names cards
         somebody may already own and omits ones they need. */
      note: built.complete ? "" :
        ("Still building this checklist \u2014 " + (built.count || 0) +
         (built.total ? " of " + built.total : "") +
         " cards so far. Come back tomorrow for the rest."),
      known:   cards.length,
      total:   built.total || null,
      haveCount: have.size,
      missing: missing.slice(0, 500).map(c => ({
        card_number: c.card_number,
        subject:     c.subject,
        is_rookie:   c.is_rookie === true,
        print_run:   c.print_run
      })),
      missingCount: missing.length
    });
  } catch (error) {
    console.warn("[checklist] failed:", error.message);
    res.json({ success: false, error: error.message });
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
    /* Counted separately so the log distinguishes "no sold data" from
       "the write failed" — they need different responses. */
    let skipped = 0;

    for (const item of items) {
      try {
        /* SOLD, NOT ASKING.

           This used avgPrice — the median of live LISTINGS. Cards
           entered the binder at a sold price and were then re-priced
           every night against what sellers hope for, which runs above
           what buyers pay and does so unevenly. Every "since saved"
           figure was therefore comparing two different kinds of number,
           and a portfolio total built that way drifts further from
           reality the longer it runs.

           A contaminated pool is refused outright rather than written.
           The scanner will not vouch for those medians, and a value
           that silently enters a portfolio is worse than one shown on
           screen with a warning attached — nobody is watching when the
           cron runs.

           When there are no sales at all the card keeps yesterday's
           price rather than taking an asking price. A stale number is
           honest about being old; an asking price wearing a sold
           label is not. */
        const market = await getEbayCardMarket(item.card_name);
        const sold   = market.sold || {};
        const contaminated = !!sold.soldContaminated;
        const soldMed = contaminated ? 0 : safeNumber(
          (sold.soldRaw && sold.soldRaw.count >= 3 ? sold.soldRaw.median : 0) || sold.soldMedian, 0);
        const newPrice = soldMed;

        if (!newPrice) {
          skipped++;
          continue;
        }

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
    console.log(`[watchlist-refresh] done. updated=${updated} skipped=${skipped} failed=${failed} elapsed=${elapsed}s`);
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

/* ══════════════════════════════════════════════════════════════
   PRICE ALERTS — Phase 4 of the email/retention project.

   Runs after the nightly watchlist refresh (which updates current_price),
   so this always sees today's numbers, not yesterday's.

   ONE EMAIL PER USER, not one per card. Someone watching eight cards
   that all moved gets one digest, not eight separate emails — the
   inbox experience matters as much as the data.

   THE RE-ALERT PROBLEM: comparing current_price to price_when_added
   forever means a card that crossed 10% once gets re-reported every
   single night after that, even with zero further movement. Each row
   carries its own last_alerted_price — the price that triggered the
   PREVIOUS alert (or price_when_added if never alerted). Only a move
   from THAT baseline counts as new, and after sending, the baseline
   resets to the current price. So the next alert only fires on a
   genuinely new move.

   Respects email_preferences: skipped if price_alerts is off or
   unsubscribed_all is true. A user with no preferences row (shouldn't
   happen given the backfill + trigger, but code defensively) is
   treated as opted out — silence is the safe default, not spam.
══════════════════════════════════════════════════════════════ */

/* SendGrid, not Resend. cardgauge.com is verified there via CNAME
   records — Resend specifically required an MX record to enable
   sending, and Wix's DNS panel cannot publish MX records on a
   subdomain. SendGrid's default "Automated Security" setup only needs
   CNAMEs, which Wix handles fine, so this is the actual working path.

   Function name kept as sendResendEmail so the two callers (price
   alerts, welcome emails) needed zero changes — only the
   implementation underneath changed. */
const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY || "";
const ALERT_FROM_EMAIL = "CardGauge <alerts@cardgauge.com>";
const PRICE_ALERT_PCT = 10;   // minimum move to bother somebody about

async function sendResendEmail(to, subject, html) {
  if (!SENDGRID_API_KEY) {
    console.log("[email] SENDGRID_API_KEY missing — skipping send to " + to);
    return false;
  }
  try {
    const r = await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: {
        Authorization: "Bearer " + SENDGRID_API_KEY,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: to }] }],
        from: { email: "alerts@cardgauge.com", name: "CardGauge" },
        subject: subject,
        content: [{ type: "text/html", value: html }]
      })
    });
    // SendGrid returns 202 with an empty body on success — not 200.
    if (!r.ok) {
      const body = await r.text();
      console.log("[email] SendGrid send failed " + r.status + ": " + body.slice(0, 300));
      return false;
    }
    return true;
  } catch (e) {
    console.log("[email] SendGrid send error:", e.message);
    return false;
  }
}

function alertCardRowHtml(item, pct) {
  const up = pct >= 0;
  const arrow = up ? "\u25B2" : "\u25BC";
  const color = up ? "#22c55e" : "#ef4444";
  return (
    '<tr style="border-bottom:1px solid #1e2d45;">' +
      '<td style="padding:10px 0;color:#f1f5f9;font-family:sans-serif;font-size:14px;">' +
        (item.card_name || "Card") +
      '</td>' +
      '<td style="padding:10px 0;text-align:right;color:' + color + ';font-family:monospace;font-size:14px;font-weight:700;white-space:nowrap;">' +
        arrow + ' ' + Math.abs(Math.round(pct)) + '%' +
      '</td>' +
      '<td style="padding:10px 0 10px 14px;text-align:right;color:#94a3b8;font-family:monospace;font-size:12.5px;white-space:nowrap;">' +
        '$' + Math.round(item.last_alerted_price || item.price_when_added || 0) + ' \u2192 $' + Math.round(item.current_price) +
      '</td>' +
    '</tr>'
  );
}

function buildAlertEmailHtml(rows) {
  const rowsHtml = rows.map(function (r) { return alertCardRowHtml(r.item, r.pct); }).join("");
  return (
    '<div style="background:#0a0e1a;padding:32px 16px;font-family:Arial,sans-serif;">' +
      '<div style="max-width:480px;margin:0 auto;background:#111827;border:1px solid #1e2d45;border-radius:14px;padding:28px;">' +
        '<div style="font-size:20px;font-weight:800;color:#f1f5f9;margin-bottom:4px;">CARD<span style="color:#f59e0b;">GAUGE</span></div>' +
        '<p style="color:#94a3b8;font-size:13px;margin:0 0 20px;">' +
          rows.length + ' card' + (rows.length === 1 ? '' : 's') + ' in your binder moved today.' +
        '</p>' +
        '<table style="width:100%;border-collapse:collapse;">' + rowsHtml + '</table>' +
        '<a href="https://www.cardgauge.com/my-binder" style="display:block;margin-top:24px;background:#22c55e;color:#052e16;text-decoration:none;text-align:center;padding:13px;border-radius:10px;font-weight:800;font-size:14px;">View your binder \u2192</a>' +
        '<p style="color:#64748b;font-size:11px;line-height:1.6;margin-top:20px;">' +
          'You\'re getting this because price alerts are on for your CardGauge account. ' +
          '<a href="https://www.cardgauge.com/my-binder" style="color:#64748b;">Manage email preferences</a>' +
        '</p>' +
      '</div>' +
    '</div>'
  );
}

async function runPriceAlerts() {
  if (!supabaseAdmin) {
    console.log("[price-alerts] skipped — no Supabase client");
    return;
  }
  if (!SENDGRID_API_KEY) {
    console.log("[price-alerts] skipped — SENDGRID_API_KEY not set");
    return;
  }

  const startTime = Date.now();
  console.log("[price-alerts] starting…");

  try {
    const { data: items, error } = await supabaseAdmin
      .from("watchlist_items")
      .select("id, user_id, card_name, price_when_added, current_price, last_alerted_price")
      .not("current_price", "is", null)
      .not("price_when_added", "is", null)
      .gt("price_when_added", 0);

    if (error) {
      console.error("[price-alerts] fetch error:", error.message);
      return;
    }
    if (!items || !items.length) {
      console.log("[price-alerts] nothing to check");
      return;
    }

    // Which moves actually clear the bar, per-card, against each card's own baseline.
    const movers = [];
    for (const item of items) {
      const baseline = safeNumber(item.last_alerted_price, 0) || safeNumber(item.price_when_added, 0);
      if (!baseline || !item.current_price) continue;
      const pct = ((item.current_price - baseline) / baseline) * 100;
      if (Math.abs(pct) >= PRICE_ALERT_PCT) {
        movers.push({ item: item, pct: pct });
      }
    }

    if (!movers.length) {
      console.log("[price-alerts] no cards crossed " + PRICE_ALERT_PCT + "% today");
      return;
    }

    // Group by user — one digest email, not one email per card.
    const byUser = {};
    movers.forEach(function (m) {
      const uid = m.item.user_id;
      if (!byUser[uid]) byUser[uid] = [];
      byUser[uid].push(m);
    });

    let emailsSent = 0, emailsSkipped = 0, usersChecked = 0;

    for (const userId of Object.keys(byUser)) {
      usersChecked++;
      try {
        const { data: prefs } = await supabaseAdmin
          .from("email_preferences")
          .select("price_alerts, unsubscribed_all")
          .eq("user_id", userId)
          .maybeSingle();

        // No row, opted out, or globally unsubscribed — silence, not a send.
        if (!prefs || !prefs.price_alerts || prefs.unsubscribed_all) {
          emailsSkipped++;
          continue;
        }

        const { data: userData, error: userErr } = await supabaseAdmin.auth.admin.getUserById(userId);
        if (userErr || !userData || !userData.user || !userData.user.email) {
          emailsSkipped++;
          continue;
        }
        const email = userData.user.email;

        const rows = byUser[userId];
        const html = buildAlertEmailHtml(rows);
        const subject = rows.length === 1
          ? (rows[0].pct >= 0 ? "\uD83D\uDCC8 " : "\uD83D\uDCC9 ") + rows[0].item.card_name + " moved " + Math.abs(Math.round(rows[0].pct)) + "%"
          : rows.length + " cards moved in your CardGauge binder";

        const sent = await sendResendEmail(email, subject, html);
        if (sent) {
          emailsSent++;
          // Reset each card's baseline to today's price, so tomorrow's
          // comparison is against TODAY, not the original save price.
          for (const m of rows) {
            await supabaseAdmin
              .from("watchlist_items")
              .update({
                last_alerted_price: m.item.current_price,
                last_alerted_at: new Date().toISOString()
              })
              .eq("id", m.item.id);
          }
          try {
            await supabaseAdmin.rpc("log_scan_event", {
              p_event: "price_alert_sent",
              p_card_name: String(rows.length),
              p_used_back: false,
              p_is_owner: false
            });
          } catch (e) { /* analytics failure must never block the send */ }
        } else {
          emailsSkipped++;
        }
      } catch (e) {
        console.error("[price-alerts] error for user " + userId + ":", e.message);
        emailsSkipped++;
      }
    }

    const elapsed = Math.round((Date.now() - startTime) / 1000);
    console.log(
      "[price-alerts] done. users_with_movers=" + usersChecked +
      " sent=" + emailsSent + " skipped=" + emailsSkipped +
      " elapsed=" + elapsed + "s"
    );
  } catch (e) {
    console.error("[price-alerts] fatal error:", e.message);
  }
}

// Runs 30 minutes after the watchlist price refresh, so current_price
// reflects today's numbers before this checks them.
cron.schedule("30 4 * * *", runPriceAlerts, { timezone: "America/New_York" });
console.log("Price alerts scheduled for 4:30 AM ET");

// Manual trigger for testing — same auth pattern as /api/refresh-watchlist.
app.get("/api/run-price-alerts", async (req, res) => {
  if (!process.env.REFRESH_SECRET || req.query.key !== process.env.REFRESH_SECRET) {
    return res.status(403).json({ success: false, error: "Forbidden" });
  }
  res.json({ success: true, message: "Price alerts started — check server logs" });
  runPriceAlerts();
});

/* ══════════════════════════════════════════════════════════════
   WELCOME EMAIL — Phase 3 of the email/retention project.

   Sent once, shortly after signup. Runs on a short-interval cron
   (every 5 minutes) rather than firing from the frontend at the moment
   of signup — a cron still sends the email if somebody closes the tab
   the instant their code verifies, where a frontend-triggered send
   would silently never fire.

   Bounded to accounts created in the last 24 hours. Without that bound,
   any bug that left welcome_sent stuck at false would eventually scan
   every account ever created, on every run, forever. A welcome email
   that arrives a day late because of a bug is a minor annoyance; an
   unbounded query that grows with the user base is a real one.

   Deliberately does NOT touch email_preferences beyond marking
   welcome_sent — this is a transactional send (the person just created
   the account), not a marketing send, so it does not check
   price_alerts/weekly_update/unsubscribed_all. It DOES still create the
   preferences row via the trigger already in place, so those other
   emails respect the person's choices from their very first message
   onward.
══════════════════════════════════════════════════════════════ */

function buildWelcomeEmailHtml() {
  return (
    '<div style="background:#0a0e1a;padding:32px 16px;font-family:Arial,sans-serif;">' +
      '<div style="max-width:480px;margin:0 auto;background:#111827;border:1px solid #1e2d45;border-radius:14px;padding:28px;">' +
        '<div style="font-size:20px;font-weight:800;color:#f1f5f9;margin-bottom:4px;">CARD<span style="color:#f59e0b;">GAUGE</span></div>' +
        '<p style="color:#94a3b8;font-size:13px;margin:0 0 20px;">Welcome to CardGauge 👋</p>' +
        '<p style="color:#f1f5f9;font-size:15px;line-height:1.6;margin:0 0 16px;">' +
          'Your free account is ready.' +
        '</p>' +
        '<p style="color:#94a3b8;font-size:14px;line-height:1.65;margin:0 0 20px;">' +
          'Scan cards, save the ones you care about, build your collection. ' +
          'We\'ll let you know when cards you\'re watching change significantly in value.' +
        '</p>' +
        '<p style="color:#94a3b8;font-size:13px;line-height:1.6;margin:0 0 24px;">' +
          'Your first 25 watched cards are free.' +
        '</p>' +
        '<a href="https://www.cardgauge.com" style="display:block;background:#22c55e;color:#052e16;text-decoration:none;text-align:center;padding:13px;border-radius:10px;font-weight:800;font-size:14px;">Open CardGauge \u2192</a>' +
        '<p style="color:#64748b;font-size:11px;line-height:1.6;margin-top:24px;">' +
          'You\'re getting this because you created a CardGauge account. ' +
          '<a href="https://www.cardgauge.com/my-binder" style="color:#64748b;">Manage email preferences</a>' +
        '</p>' +
      '</div>' +
    '</div>'
  );
}

async function runWelcomeEmails() {
  if (!supabaseAdmin) return;
  if (!SENDGRID_API_KEY) return;

  try {
    // Only accounts from the last 24 hours — see the note above on why
    // this is bounded rather than an open-ended "not yet sent" scan.
    const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();

    const { data: prefs, error } = await supabaseAdmin
      .from("email_preferences")
      .select("user_id, created_at")
      .eq("welcome_sent", false)
      .gte("created_at", since)
      .limit(50);

    if (error) {
      console.error("[welcome-email] fetch error:", error.message);
      return;
    }
    if (!prefs || !prefs.length) return;

    let sent = 0, skipped = 0;

    for (const row of prefs) {
      try {
        const { data: userData, error: userErr } = await supabaseAdmin.auth.admin.getUserById(row.user_id);
        if (userErr || !userData || !userData.user || !userData.user.email) {
          skipped++;
          continue;
        }

        const ok = await sendResendEmail(
          userData.user.email,
          "Welcome to CardGauge \uD83D\uDC4B",
          buildWelcomeEmailHtml()
        );

        if (ok) {
          sent++;
          await supabaseAdmin
            .from("email_preferences")
            .update({ welcome_sent: true, welcome_sent_at: new Date().toISOString() })
            .eq("user_id", row.user_id);
          try {
            await supabaseAdmin.rpc("log_scan_event", {
              p_event: "welcome_email_sent",
              p_card_name: null,
              p_used_back: false,
              p_is_owner: false
            });
          } catch (e) { /* analytics failure must never block the send */ }
        } else {
          skipped++;
        }
      } catch (e) {
        console.error("[welcome-email] error for user " + row.user_id + ":", e.message);
        skipped++;
      }
    }

    if (sent || skipped) {
      console.log("[welcome-email] sent=" + sent + " skipped=" + skipped);
    }
  } catch (e) {
    console.error("[welcome-email] fatal error:", e.message);
  }
}

cron.schedule("*/5 * * * *", runWelcomeEmails);
console.log("Welcome emails checking every 5 minutes");

// Manual trigger for testing.
app.get("/api/run-welcome-emails", async (req, res) => {
  if (!process.env.REFRESH_SECRET || req.query.key !== process.env.REFRESH_SECRET) {
    return res.status(403).json({ success: false, error: "Forbidden" });
  }
  res.json({ success: true, message: "Welcome email check started — check server logs" });
  runWelcomeEmails();
});

/* ══════════════════════════════════════════════════════════════
   WEEKLY DIGEST — Phase 5 of the email/retention project.

   "$4,281 estimated value, +$183 this week, biggest movers, N cards
   M sets" — the weekly-habit email, distinct from price alerts (which
   fire on individual moves, whenever they happen).

   THE COMPARISON PROBLEM. watchlist_items only holds the CURRENT
   price — there was no record anywhere of what a user's collection was
   worth seven days ago. weekly_portfolio_snapshots exists to fix that:
   this function reads the most recent prior snapshot, diffs against
   today, then writes a new snapshot for next week to diff against.

   A user's first-ever digest has no prior snapshot to compare to — it
   still sends (showing just the current total, no delta, no movers),
   because "here's where you stand" is still useful on its own, and
   skipping it silently would mean somebody with a real collection
   never gets a digest until their SECOND eligible week.

   Skipped entirely for users with zero cards. An email whose entire
   content is "$0, 0 cards" is not a habit-forming touchpoint, it is
   noise, and it is the majority of users right now given how few
   people have saved anything.
══════════════════════════════════════════════════════════════ */

function fmtUsd(n) {
  const v = Math.round(Number(n) || 0);
  return "$" + v.toLocaleString();
}

function digestMoverRowHtml(name, from, to) {
  const pct = from ? Math.round(((to - from) / from) * 100) : 0;
  const up = to >= from;
  const arrow = up ? "\u25B2" : "\u25BC";
  const color = up ? "#22c55e" : "#ef4444";
  return (
    '<tr style="border-bottom:1px solid #1e2d45;">' +
      '<td style="padding:9px 0;color:#f1f5f9;font-family:sans-serif;font-size:13.5px;">' + name + '</td>' +
      '<td style="padding:9px 0;text-align:right;color:' + color + ';font-family:monospace;font-size:13px;font-weight:700;white-space:nowrap;">' +
        arrow + ' ' + Math.abs(pct) + '%' +
      '</td>' +
    '</tr>'
  );
}

function buildWeeklyDigestHtml(opts) {
  const hasComparison = opts.hasComparison;
  const deltaColor = opts.delta >= 0 ? "#22c55e" : "#ef4444";
  const deltaSign = opts.delta >= 0 ? "+" : "\u2212";
  const moversHtml = opts.movers.map(function (m) {
    return digestMoverRowHtml(m.name, m.from, m.to);
  }).join("");

  return (
    '<div style="background:#0a0e1a;padding:32px 16px;font-family:Arial,sans-serif;">' +
      '<div style="max-width:480px;margin:0 auto;background:#111827;border:1px solid #1e2d45;border-radius:14px;padding:28px;">' +
        '<div style="font-size:20px;font-weight:800;color:#f1f5f9;margin-bottom:4px;">CARD<span style="color:#f59e0b;">GAUGE</span></div>' +
        '<p style="color:#94a3b8;font-size:13px;margin:0 0 20px;">Your weekly CardGauge update</p>' +
        '<div style="font-size:34px;font-weight:900;color:#f1f5f9;line-height:1;">' + fmtUsd(opts.totalValue) + '</div>' +
        (hasComparison
          ? '<div style="color:' + deltaColor + ';font-family:monospace;font-size:13px;font-weight:700;margin-top:6px;">' +
              deltaSign + fmtUsd(Math.abs(opts.delta)) + ' this week</div>'
          : '<div style="color:#64748b;font-family:monospace;font-size:12px;margin-top:6px;">First week tracking your collection</div>') +
        (moversHtml
          ? '<div style="margin-top:22px;padding-top:18px;border-top:1px solid #1e2d45;">' +
              '<div style="color:#94a3b8;font-family:monospace;font-size:10.5px;letter-spacing:.1em;text-transform:uppercase;margin-bottom:10px;">Biggest movers</div>' +
              '<table style="width:100%;border-collapse:collapse;">' + moversHtml + '</table>' +
            '</div>'
          : '') +
        '<div style="margin-top:22px;padding-top:18px;border-top:1px solid #1e2d45;color:#94a3b8;font-family:monospace;font-size:12px;">' +
          opts.cardCount + ' card' + (opts.cardCount === 1 ? '' : 's') +
        '</div>' +
        '<div style="margin-top:18px;padding:14px;background:rgba(251,191,36,.08);border:1px solid rgba(251,191,36,.25);border-radius:10px;">' +
          '<div style="color:#fbbf24;font-weight:700;font-size:12.5px;margin-bottom:4px;">\ud83d\udcc7 New: scan a PSA barcode</div>' +
          '<div style="color:#94a3b8;font-size:11.5px;line-height:1.5;">Already graded? Skip the photo \u2014 scan the barcode on the label and we\u2019ll pull the card, grade and price straight from PSA\u2019s own record.</div>' +
        '</div>' +
        '<a href="https://www.cardgauge.com/my-binder" style="display:block;margin-top:20px;background:#22c55e;color:#052e16;text-decoration:none;text-align:center;padding:13px;border-radius:10px;font-weight:800;font-size:14px;">View your binder \u2192</a>' +
        '<p style="color:#64748b;font-size:11px;line-height:1.6;margin-top:20px;">' +
          '<a href="https://www.cardgauge.com/my-binder" style="color:#64748b;">Manage email preferences</a>' +
        '</p>' +
      '</div>' +
    '</div>'
  );
}

async function runWeeklyDigest() {
  if (!supabaseAdmin || !SENDGRID_API_KEY) return;

  const startTime = Date.now();
  console.log("[weekly-digest] starting…");

  try {
    const { data: items, error } = await supabaseAdmin
      .from("watchlist_items")
      .select("id, user_id, card_name, current_price")
      .not("current_price", "is", null)
      .gt("current_price", 0);

    if (error) {
      console.error("[weekly-digest] fetch error:", error.message);
      return;
    }
    if (!items || !items.length) {
      console.log("[weekly-digest] no priced cards to report on");
      return;
    }

    // Group into per-user portfolios.
    const byUser = {};
    items.forEach(function (it) {
      if (!byUser[it.user_id]) byUser[it.user_id] = [];
      byUser[it.user_id].push(it);
    });

    let sent = 0, skipped = 0;

    for (const userId of Object.keys(byUser)) {
      try {
        const { data: prefs } = await supabaseAdmin
          .from("email_preferences")
          .select("weekly_update, unsubscribed_all")
          .eq("user_id", userId)
          .maybeSingle();

        if (!prefs || !prefs.weekly_update || prefs.unsubscribed_all) {
          skipped++;
          continue;
        }

        const rows = byUser[userId];
        const totalValue = rows.reduce(function (a, r) { return a + safeNumber(r.current_price, 0); }, 0);
        const nowItems = {};
        rows.forEach(function (r) {
          nowItems[r.id] = { name: r.card_name || "Card", price: safeNumber(r.current_price, 0) };
        });

        // Most recent prior snapshot, if any.
        const { data: prior } = await supabaseAdmin
          .from("weekly_portfolio_snapshots")
          .select("total_value, items, snapshot_at")
          .eq("user_id", userId)
          .order("snapshot_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        let hasComparison = false, delta = 0, movers = [];
        if (prior && prior.items) {
          hasComparison = true;
          delta = totalValue - safeNumber(prior.total_value, 0);

          // Per-card diff, sorted by absolute % move, top 3.
          const diffs = [];
          Object.keys(nowItems).forEach(function (id) {
            const before = prior.items[id];
            if (!before || !before.price) return;
            const pct = Math.abs((nowItems[id].price - before.price) / before.price);
            if (pct >= 0.05) {   // 5%+ to count as a "mover" in the digest
              diffs.push({ name: nowItems[id].name, from: before.price, to: nowItems[id].price, pct: pct });
            }
          });
          diffs.sort(function (a, b) { return b.pct - a.pct; });
          movers = diffs.slice(0, 3);
        }

        const { data: userData, error: userErr } = await supabaseAdmin.auth.admin.getUserById(userId);
        if (userErr || !userData || !userData.user || !userData.user.email) {
          skipped++;
          continue;
        }

        const html = buildWeeklyDigestHtml({
          totalValue: totalValue,
          hasComparison: hasComparison,
          delta: delta,
          movers: movers,
          cardCount: rows.length
        });

        const ok = await sendResendEmail(
          userData.user.email,
          "Your CardGauge Weekly Update",
          html
        );

        if (ok) {
          sent++;
          try {
            await supabaseAdmin.rpc("log_scan_event", {
              p_event: "weekly_update_sent",
              p_card_name: null,
              p_used_back: false,
              p_is_owner: false
            });
          } catch (e) { /* analytics failure must never block the send */ }
        } else {
          skipped++;
        }

        // New snapshot either way — even a skipped/failed send still
        // gets one, so next week's comparison isn't built on stale data.
        await supabaseAdmin.from("weekly_portfolio_snapshots").insert({
          user_id: userId,
          total_value: totalValue,
          card_count: rows.length,
          items: nowItems
        });
      } catch (e) {
        console.error("[weekly-digest] error for user " + userId + ":", e.message);
        skipped++;
      }
    }

    const elapsed = Math.round((Date.now() - startTime) / 1000);
    console.log("[weekly-digest] done. sent=" + sent + " skipped=" + skipped + " elapsed=" + elapsed + "s");
  } catch (e) {
    console.error("[weekly-digest] fatal error:", e.message);
  }
}

// Monday mornings, ET.
cron.schedule("0 8 * * 1", runWeeklyDigest, { timezone: "America/New_York" });
console.log("Weekly digest scheduled for Mondays 8:00 AM ET");

app.get("/api/run-weekly-digest", async (req, res) => {
  if (!process.env.REFRESH_SECRET || req.query.key !== process.env.REFRESH_SECRET) {
    return res.status(403).json({ success: false, error: "Forbidden" });
  }
  res.json({ success: true, message: "Weekly digest started — check server logs" });
  runWeeklyDigest();
});

/* ══════════════════════════════════════════════════════════════
   EMAIL OPEN/CLICK TRACKING — Phase 9 of the email/retention project.

   SendGrid can POST every open, click, bounce, and spam report back to
   a URL of our choosing (their "Event Webhook"). Until this exists,
   "welcome_email_sent" and "price_alert_sent" were the only signal —
   whether anybody actually OPENED one, let alone clicked through, was
   invisible. This endpoint is where those events land.

   MUST use express.raw or otherwise read the body before any JSON
   parsing runs — SendGrid's webhook sends an array of events, and this
   route is registered below express.json() in the file, which is fine
   here because this endpoint doesn't need signature verification on
   the raw body the way Stripe's does. It reads the already-parsed body.

   Logged as generic email_opened / email_clicked rather than tied to
   which specific campaign, because SendGrid's event payload doesn't
   carry that unless custom_args were attached at send time — which
   the current sendResendEmail() does not do. Good enough to answer
   "are people opening these at all", not yet enough to break down
   opens by price-alert vs weekly-digest vs welcome. That's a future
   refinement, not a blocker for having open/click data at all.
══════════════════════════════════════════════════════════════ */

app.post("/api/sendgrid-webhook", async (req, res) => {
  // Always 200 quickly — SendGrid retries on non-2xx, and a slow or
  // failing analytics write must never cause repeated redelivery.
  res.status(200).send("ok");

  if (!supabaseAdmin) return;
  const events = Array.isArray(req.body) ? req.body : [];
  if (!events.length) return;

  const EVENT_MAP = {
    open: "email_opened",
    click: "email_clicked",
    bounce: "email_bounced",
    spamreport: "email_spam_report"
  };

  for (const ev of events) {
    const mapped = EVENT_MAP[ev.event];
    if (!mapped) continue;   // ignore delivered/processed/deferred — not useful signal here
    try {
      await supabaseAdmin.rpc("log_scan_event", {
        p_event: mapped,
        p_card_name: ev.email ? String(ev.email).slice(0, 200) : null,
        p_used_back: false,
        p_is_owner: false
      });
    } catch (e) { /* one bad event must not block the rest of the batch */ }
  }
});

/* ── CAN THIS SERVER REACH TCGDEX? ──────────────────────────
   Diagnostic, not a feature. TCGdex is unreachable from the browser
   this was tested in, but a browser's network is not Render's — a
   local DNS or firewall problem looks identical to a dead service from
   where you are sitting, and the two need completely different
   responses.

   This runs the fetch FROM Render and reports exactly what came back:
   status, timing, and the first slice of the body. That is the only
   test that decides anything, because Render is where the code would
   live.

   Delete it once the question is answered. A permanent endpoint that
   calls a third party on demand is a small liability. */
app.get("/api/tcgdex-check", async (req, res) => {
  var urls = [
    "https://api.tcgdex.net/v2/en/sets/swsh3",
    "https://api.tcgdex.net/v2/en/sets"
  ];
  var out = [];

  for (var i = 0; i < urls.length; i++) {
    var started = Date.now();
    var ctrl = new AbortController();
    var timer = setTimeout(function(){ ctrl.abort(); }, 12000);
    try {
      var r = await fetch(urls[i], { signal: ctrl.signal });
      var text = await r.text();
      out.push({
        url: urls[i],
        ok: r.ok,
        status: r.status,
        ms: Date.now() - started,
        bytes: text.length,
        sample: text.slice(0, 300)
      });
    } catch (e) {
      out.push({
        url: urls[i],
        ok: false,
        ms: Date.now() - started,
        /* An abort here means Render could not reach them either, which
           rules out a problem local to the browser. */
        error: (e && e.name === "AbortError") ? "timed out after 12s" : (e.message || String(e))
      });
    } finally {
      clearTimeout(timer);
    }
  }

  res.json({ success: true, checkedAt: new Date().toISOString(), results: out });
});

app.use((req, res) => {
  res.status(404).json({ success: false, error: "Endpoint not found" });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`CardGauge backend running on port ${PORT}`);
  console.log(`eBay EPN affiliate active — campid: ${EPN_CAMPAIGN_ID}`);
  console.log("Sold filter logic version: " + SOLD_LOGIC_VERSION);
  console.log(
    "Stripe Pro webhook: " +
    (STRIPE_SECRET_KEY && STRIPE_WEBHOOK_SECRET ? "configured" : "NOT configured — set STRIPE_SECRET_KEY + STRIPE_WEBHOOK_SECRET")
  );
});
