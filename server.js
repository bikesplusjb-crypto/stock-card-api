/* ===============================
   CARDGAUGE / TRACK THE MARKET
   AI SCANNER + EBAY CARD MARKET BACKEND
   server.js — eBay EPN Affiliate v2
   + median pricing + graded/raw split
   + TIERED PARALLEL-AWARE PRICING
   + STRIPE PRO SUBSCRIPTIONS
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
          } else {
            console.log("[stripe] checkout.session.completed with NO resolvable email — session " + (obj.id || "?"));
          }
        }
      }

      else if (type === "customer.subscription.deleted") {
        const email = await emailFromCustomer(obj.customer);
        if (email) await setProStatus(email, false, "Stripe subscription canceled");
        else console.log("[stripe] cancel event but no email for customer " + obj.customer);
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

function parseCardQuery(query) {
  const raw = String(query || "").replace(/\s+/g, " ").trim();
  const out = { year: null, brand: null, set: null, player: null, parallel: null };
  if (!raw) return out;

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

const PARALLEL_WORDS = COLOR_WORDS.concat(TEXTURE_WORDS).concat(POKEMON_WORDS);

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
  return PARALLEL_WORDS.some(w => t.includes(" " + w));
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

/* The cache key must carry the limit. Without it a 50-record compact pull
   gets stored under the same key as a full lookup and is then served back
   as though it were one. */
function cacheKeyFor(query, limit) {
  const base = normalizeCardQuery(query).toLowerCase().replace(/\s+/g, " ").trim().slice(0, 280);
  const n = Number(limit || CARDAPI_LIMIT);
  return n === CARDAPI_LIMIT ? base : base + "#" + n;
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
      limitUsed: limitUsed || CARDAPI_LIMIT
    };
  }

  const prices = clean.map(r => r.price).sort((a, b) => a - b);

  /* If the card being priced IS a parallel, stripping parallels would
     leave nothing to price it from. Only base-card lookups get filtered.
     The query carries the parallel terms, so it answers this directly. */
  const targetIsParallel = titleLooksParallel(query, "");

  /* Base-only applies ONLY when enough base sales survive it. Below the
     floor the sample is noise, so it falls back to every ungraded sale —
     the same fallback pattern selectListings uses on the ask side. */
  const narrow = function (group) {
    if (targetIsParallel) return group;
    const base = group.filter(looksBaseSale);
    return base.length >= MIN_GROUP ? base : group;
  };

  const gradedAll = clean.filter(r => r.grader && r.grade);
  const rawAll    = clean.filter(r => !r.grader);

  const raw    = narrow(rawAll);
  const graded = narrow(gradedAll);

  /* The grade ladder needs the same treatment. A PSA 10 of a Gold /50
     landing on the PSA 10 rung of a base card is what makes the scanner
     tell somebody to spend $25 grading a common. */
  const ladderSrc = narrow(clean);

  const rawBasis = (raw.length !== rawAll.length) ? "base" : "ungraded";

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
    /* The frontend prints "100+" when the count hits the limit, because a
       count sitting exactly at the ceiling is a ceiling and not a total.
       It needs to know what the ceiling actually was. */
    limitUsed:     limitUsed || CARDAPI_LIMIT,
    soldRaw:    { count: raw.length,    median: median(rawP) },
    soldGraded: { count: graded.length, median: median(grP) },
    soldRawBasis:       rawBasis,
    soldGradeBreakdown: soldGradeBreakdown(ladderSrc),
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

  let note;
  if (mismatch) {
    note = 'Asking prices and recent sales are too far apart to compare — '
         + 'the listings and the sales look like different versions of this card. '
         + 'Narrow the search before trusting either number.';
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
        { type: "text", text: "Identify this card as precisely as possible. Return ONLY a JSON object with these exact keys: cardName, player, year, brand, set, setCode, cardNumber, sport, parallel, serialNumber, language, isRookie, isAutograph, isPatch, gradeCompany, gradeValue, signal, confidence, summary.\n\nTHE SINGLE MOST IMPORTANT FIELD IS player. Never leave it empty.\n- On a sports card it is the athlete's name.\n- ON A POKEMON OR TCG CARD IT IS THE CREATURE'S NAME, including its suffix exactly as printed: 'Coalossal VMAX', 'Charizard V', 'Umbreon VMAX', 'Pikachu ex', 'Mewtwo GX'. Set sport to 'Pokemon' and brand to 'Pokemon'. Without the name every price lookup fails, so read it off the top of the card even if the rest of the card is unclear.\n\nCRITICAL — PARALLEL IDENTIFICATION. Parallels change a card's value by 10x or more, so look carefully before concluding a card is base:\n- Border color is the main tell. Panini Prizm/Select/Optic parallels are named by color: Silver, Red, Blue, Green, Orange, Purple, Gold, Black, Pink, Camo, Mojo, Wave, Hyper, Disco, Shimmer, Ice.\n- Topps Chrome parallels: Refractor, X-Fractor, Prism, Atomic, Sepia, Gold, Orange, Red, SuperFractor, Negative, Speckle.\n- POKEMON: the variant matters as much as any colour parallel. Report it in the parallel field. Vintage: 1st Edition (look for the black stamp to the left of the artwork), Shadowless (no drop shadow on the right of the art box). Any era: Reverse Holo (the CARD BODY is foil, the artwork is not), Full Art, Alt Art, Rainbow Rare, Gold Secret Rare, Illustration Rare. Do NOT write Unlimited or Regular \u2014 that is the base printing, so leave parallel empty.\n- Look for rainbow/foil sheen, cracked-ice texture, sparkle, or a colored border that differs from the base design.\n- Look for serial numbering printed on the front or back, usually small, formatted like 25/99 or /99. Report it exactly as printed in serialNumber. POKEMON CARD NUMBERS ARE NOT SERIAL NUMBERING: 074/073, 4/102 and SV107/SV122 are the card's number within its set. Put those in cardNumber and leave serialNumber EMPTY.\n- '1/1' or 'One of One' is critical — always report it.\n- If you see a colored border or foil pattern but cannot name the exact parallel, use the color plus the word Parallel, e.g. 'Blue Parallel'.\n- Use an empty string for parallel ONLY if the card is clearly a plain base card.\n\nSET FIELD RULES — IMPORTANT:\n- The 'set' field must be the actual product/subset name as it would appear in an eBay listing title, for example 'Update Series', 'Draft Picks', 'Downtown', 'Kaboom'.\n- If the card is just the base set of the product, return an EMPTY STRING for set. Never return 'Base', 'Base Set', 'Base Rookie', or 'Common' — those words do not appear in listing titles and break the price search.\n- POKEMON IS THE EXCEPTION TO THAT RULE. Pokemon set names are real products and must ALWAYS be returned in full, even when they sound generic: 'Base Set', 'Jungle', 'Fossil', 'Team Rocket', 'Neo Genesis', 'Evolving Skies', 'Champions Path', 'Darkness Ablaze', 'Rebel Clash', 'Hidden Fates', 'Obsidian Flames', '151'. Use the set symbol and the card number to identify it. Never return an empty set for a Pokemon card if you can name the set at all.\n- POKEMON SET CODES \u2014 REPORT WHAT IS PRINTED, SEPARATELY FROM WHAT YOU THINK IT MEANS. Modern Pokemon cards print a 2-4 letter code in the bottom corner beside the card number: SVI, PAL, OBF, EVS, SSP, MEW, ASC, PFL.\n  \u2022 Put the code EXACTLY as printed in setCode. This is something you can read \u2014 report it even if the set is unfamiliar.\n  \u2022 Put the set name in set ONLY IF YOU ARE CERTAIN which set that code belongs to. If you are not certain, LEAVE set EMPTY. Do not reach for the closest set you happen to know.\n  \u2022 A wrong set name is far worse than no set name. It pulls comps for a different card and looks authoritative doing it. 'I read PFL and I do not know that set' is a correct and useful answer; guessing 'Obsidian Flames' because OBF is similar is not.\n  \u2022 The year must match the set you name. If you are unsure of the set, do not adjust the year to fit a guess \u2014 read the copyright year off the card.\n\nLANGUAGE:\n- Return 'Japanese' if the card text is Japanese, or 'Chinese' or 'Korean' where those apply. Otherwise return 'English'.\n- Japanese Pokemon cards trade as a separate market at different prices, so getting this wrong misprices the card badly. They are a slightly different size, carry Japanese characters in the name and attack text, and usually print the card number without a set total.\n\nOTHER RULES:\n- If a back image is provided, TRUST THE BACK for card number, set name, and copyright year — printed text beats inferring from the front design.\n- If the card is in a graded slab, read the label for company, grade, year, player, set, and card number.\n- isRookie, isAutograph, isPatch must be true or false booleans.\n- signal must be one of: GRADE, WATCH, SELL RAW, HOT, VERIFY.\n- confidence must be High, Medium, or Low. Use Low if the image is blurry or you are unsure about the parallel.\n- Never guess a dollar value. Never include price fields." },
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

      const cleanCardName = buildDisplayName(ai);
      const market        = await getCardMarketForCard(ai);
      const searchQuery   = market.searchQuery || buildCardQuery(ai) || cleanCardName;
      const sold          = await getSoldComps(searchQuery, market.avgPrice);

      console.log(
        "[scan] " + cleanCardName +
        " | back=" + (back ? "yes" : "no") +
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
        /* Resolved from the code the model READ, not the name it
           inferred. See resolvePokemonSet — the model guessing at
           unfamiliar codes was producing confidently wrong set names. */
        set:               resolvePokemonSet(ai) || "Unknown",
        setCode:           String(ai.setCode || "").trim().toUpperCase() || null,
        brand:             ai.brand      || "Unknown",
        cardNumber:        ai.cardNumber || "Unknown",
        sport:             ai.sport      || "Unknown",
        parallel:          ai.parallel      || "",
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
    model: "gpt-4o-mini",
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
      recordLimitCompact: CARDAPI_LIMIT_COMPACT
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
const CATALOG_TIMEOUT   = 9000;

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
  } finally {
    clearTimeout(timer);
  }
}

app.get("/api/set-lookup", async (req, res) => {
  const raw = String(req.query.q || "").trim();
  const q   = normaliseSetQuery(raw);
  if (q.length < 3) {
    return res.json({ success: true, cached: false, sets: [], note: "Give us a bit more to go on." });
  }

  /* Cache first, always. This is the branch that runs almost every
     time once the common sets have been seen once. */
  if (supabaseAdmin) {
    try {
      const hit = await supabaseAdmin
        .from("catalog_set_queries").select("ucid,found").eq("q", q).maybeSingle();
      if (hit.data) {
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

  if (!CARDAPI_KEY) {
    return res.json({ success: true, cached: false, sets: [], note: "Catalog not configured." });
  }

  try {
    const params = new URLSearchParams({ q: raw, limit: String(CATALOG_PAGE_SIZE) });
    const { body, remaining } = await catalogFetch("/sets?" + params.toString());
    const rows = Array.isArray(body && body.data) ? body.data : [];

    const sets = rows.map(r => ({
      ucid:        r.ucid || r.set_ucid || null,
      set_name:    r.set_name || r.name || "",
      year:        r.year != null ? Number(r.year) : null,
      sport:       r.sport || null,
      /* The docs describe this endpoint as returning card counts; the
         field name is read defensively because a rename upstream should
         degrade to "we don't know" rather than to a wrong number. */
      card_count:  Number(r.card_count || r.total_cards || r.cards || 0) || null,
      parent_name: r.parent_set_name || null,
      slug:        r.slug || null
    })).filter(x => x.ucid && x.set_name);

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
          fetched_at: new Date().toISOString()
        }, { onConflict: "q" });
      } catch (e) {
        console.warn("[catalog] cache write failed:", e.message);
      }
    }

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
    res.json({ success: true, cached: false, sets: [], note: error.message });
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
  console.log(
    "Stripe Pro webhook: " +
    (STRIPE_SECRET_KEY && STRIPE_WEBHOOK_SECRET ? "configured" : "NOT configured — set STRIPE_SECRET_KEY + STRIPE_WEBHOOK_SECRET")
  );
});
