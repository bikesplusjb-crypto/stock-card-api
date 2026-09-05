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

/* Event ids Stripe has already delivered. Insertion-ordered, so the
   oldest entry is the one evicted when the cap is reached. */
const seenStripeEvents = new Set();

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

    /* STRIPE RETRIES, SO THE SAME EVENT ARRIVES MORE THAN ONCE.

       Stripe redelivers any event it did not get a 2xx for, and will
       retry for up to three days. Without a check on the event id, one
       payment could grant Pro repeatedly and, more visibly, log several
       subscription_paid events for a single sale -- so revenue counted
       off analytics would be wrong in the direction that flatters.

       Held in memory rather than a table. That is a deliberate limit
       and worth naming: a restart forgets, so an event redelivered
       across a deploy could still double-log. Stripe's retries are
       minutes apart and deploys are not, so this catches the realistic
       case; a Supabase table would catch all of them and is the upgrade
       if this ever proves insufficient.

       Capped so a long-running process cannot grow the set unbounded. */
    if (event.id) {
      if (seenStripeEvents.has(event.id)) {
        console.log("[stripe] duplicate event " + event.id + " (" + type + ") — already handled");
        return res.json({ received: true, duplicate: true });
      }
      seenStripeEvents.add(event.id);
      if (seenStripeEvents.size > 500) {
        const oldest = seenStripeEvents.values().next().value;
        seenStripeEvents.delete(oldest);
      }
    }

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
/* Fixed-price base sales needed before they can carry the headline. */
const MIN_FIXED = 3;

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

  /* Leading zeros in a card-number fraction ("#004/130") kill real
     matches — sellers write "4/130", not "004/130", even for a card
     that prints the padded version. Confirmed directly: the same
     Charizard search returned 100 sold comps without the padding and
     zero with it, on a genuinely common, heavily-traded card. This
     covers TYPED searches, which never touch cardNumberToken() —
     that function only runs on AI-scan output, so a raw typed number
     needs the identical fix applied separately here. Strips leading
     zeros from BOTH sides of any digit/digit fraction found anywhere
     in the text; a genuine "0" (from "000/999") survives since \d+
     still needs at least one digit left after the zeros are consumed. */
  /* NOTE the missing \s* before the slash, and why it matters.

     This used to allow whitespace on BOTH sides, which meant it also
     joined two tokens that were never one fraction. A real scan
     produced:

       2023 Panini Select Suite Level Michael Strahan Prizm #472/25

     from a card numbered #472 with a print run of /25. Those entered
     the query as separate tokens -- "#472 /25" -- and this rule fused
     them into a card number that does not exist. The query returned
     nothing and the card showed no price.

     Nobody types "004 / 130" with a leading space; they type
     "004/130". Requiring the slash to follow the digits directly keeps
     the padding fix working and stops it reaching across a gap into
     the next token. */
  out = out.replace(/\b0*(\d+)\/\s*0*(\d+)\b/g, "$1/$2");

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
  /* A SEALED BOX IS NOT A CARD, AND IT USED TO PASS AS ONE.

     "hobby box" and "sealed" sat in the POSITIVE list, so a $1 listing
     for a 2025 Bowman Pro Debut hobby box counted as a listing for the
     single card being scanned. On a card with no completed sales that
     one box became the entire ask pool, and the app built a full
     recommendation on it: "not worth selling, fees cost more than the
     card", a grade ladder of $1/$1/$3/$7, and a sell calculation --
     for a green /99 autograph.

     Wrong in the most damaging direction. A hobby box costs more than
     most singles, so it can just as easily invent a card that is worth
     hundreds. Sealed product, packs, cases, breaks and lots all price
     on entirely different logic and none of them are the card in
     somebody's hand. */
  const positive = [
    "card","cards","psa","bgs","cgc","sgc","rookie","rc",
    "topps","bowman","panini","prizm","select","optic",
    "pokemon","pokémon","holo","reverse holo",
    "chrome","refractor","auto","autograph",
    "patch","parallel","graded","slab"
  ];
  const negative = [
    "poster","plush","figure","toy","shirt","t-shirt","costume",
    "sticker only","keychain","funko","blanket","pillow","wallet",
    "phone case","digital","code card only",
    /* Sealed product and multi-card listings. Negative wins over
       positive below, so these override a title that also says
       "topps" or "chrome" -- which every box does. */
    "hobby box","blaster box","mega box","booster box","booster bundle",
    "booster pack","factory sealed","sealed box","sealed case","hobby case",
    "wax pack","wax box","fat pack","hanger box","tin sealed",
    "break slot","random team","case break","box break",
    "lot of","card lot","bulk lot","repack","mystery box","mystery pack"
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
  "lot", "lot of", "card lot", "bulk lot", "mystery", "repack", "break",
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
function notTheCardWord(title) {
  const t = " " + String(title || "").toLowerCase().replace(/[^a-z0-9 -]/g, " ")
                    .replace(/\s+/g, " ") + " ";
  return NOT_THE_CARD.find(w => hasWord(t, w)) || null;
}

function notTheCard(title) {
  return notTheCardWord(title) !== null;
}

const REJECT_LABELS = [
  [/\blot\b|\blots\b|\bbundle\b|\bset of\b|\bcards?\b\s*\d+\s*\bcount\b/i, "Multi-card lot"],
  [/auto|sign/i,        "Autograph"],
  [/patch|relic|jersey|memorabilia|game.?used/i, "Relic or patch"],
  [/reprint|custom|proxy|aceo|novelty/i,         "Reprint or custom"],
  [/redemption/i,       "Redemption"],
  [/break|repack|mystery|pack\b|box\b|case\b/i, "Break or repack"]
];

function rejectLabelFor(word) {
  const w = String(word || "");
  for (let i = 0; i < REJECT_LABELS.length; i++) {
    if (REJECT_LABELS[i][0].test(w)) return REJECT_LABELS[i][1];
  }
  return "Not this card";
}

function saleRejectReason(r) {
  if (r.printRun != null && r.printRun > 0) {
    return { rule: "print_run", reason: "Numbered /" + r.printRun };
  }
  const w = notTheCardWord(r.title);
  if (w) return { rule: "not_the_card:" + w, reason: rejectLabelFor(w) };
  if (titleLooksParallel(r.title, "")) {
    return { rule: "parallel", reason: "Different parallel" };
  }
  return null;
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
  if (bare.indexOf("/") > -1) {
    /* Real listings write "4/130", not "004/130" — sellers drop the
       leading zeros a modern card prints, even when the card itself
       pads them. Confirmed directly: the identical Charizard search
       returned 100 sold comps without the padded fraction and ZERO
       with it — a common, heavily-traded card silently showing no
       data because of this one formatting mismatch. Lookahead keeps
       every digit after the zeros intact (a naive replace risked
       eating a real digit from "073" and turning it into "73" the
       wrong way, or worse). */
    return bare.replace(/(^|\/)0+(?=\d)/g, "$1");
  }

  /* INSERT-SET LETTER-CODE NUMBERS DO NOT SEARCH WELL.

     Insert and parallel subsets are numbered against the INSERT, not the
     player — "RA-THN" (Rookie Auto), "EOZ-11" (Emperors of the Zone),
     "CLA-JP" (Class Act), "ISPR-SSS" (Immaculate Signature Patch Rookie).
     Confirmed directly against real cache data: roughly a quarter of
     EVERY zero-sold-result lookup on CardGauge over a 7-day window
     carried exactly this shape of card number — a letter prefix, a
     hyphen, then more letters or digits.

     Including it verbatim does not narrow a search, it poisons it.
     Sellers almost never type these letter-for-letter in a listing
     title; they name the insert and the player instead — which the
     insert field already folds into `set` before this function runs.
     A plain numeric card number like "#269" is something sellers do
     reliably type, so that case is untouched. This only drops the
     letter-hyphen-code shape, which behaves completely differently in
     practice.

     Dropped from the SEARCH token only. The raw value is untouched
     everywhere else it's read (display, verification against the
     catalog, the saved binder record). */
  if (/^[A-Za-z]{1,6}-[A-Za-z0-9]{1,8}$/.test(bare)) {
    return "";
  }

  /* A "CARD NUMBER" WITH NO DIGITS IN IT IS NOT A CARD NUMBER.

     Real case, 2026-08-28: a common Topps Finest Ohtani came back with
     cardNumber "SO" — the player's initials read off the card, not a
     number. That went into the query as "#SO", the search found zero
     sold comps for a card that does not exist, the price fell through
     to active listings, and the tile rendered $19,000.00 on a card
     that trades at $3. It reached production inventory.

     The same scan read #50 correctly earlier in the day and #30 in
     between, so this is model drift, not a fixed misread — which means
     it will happen again on other cards and cannot be handled by
     correcting one value.

     A letters-only token is a non-answer. Dropping it from the SEARCH
     falls back to the year/brand/set/player query, which is broader but
     genuinely about this card, instead of a precise query about nothing.
     Everything else — display, catalog verification, the inventory row
     — still sees the raw value, exactly as with the letter-hyphen case
     above. */
  if (!/[0-9]/.test(bare)) {
    return "";
  }

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

/* PARALLEL CLAIMS NEED EVIDENCE, NOT JUST CONFIDENCE.

   The model can set parallelCertain=true on a claim it has no real basis
   for — confirmed case: a 2023 Donruss Optic Jaxson Dart base card was
   read as "Blue Parallel" with parallelCertain true. Optic's base finish
   is genuinely shiny/prismatic, which is exactly the kind of surface the
   prompt already warns can be mistaken for a named parallel. The model's
   own certainty flag did not catch it.

   So certainty is no longer taken on the model's word alone. A parallel
   is only trusted for SEARCH purposes when there is objective evidence:
   a serial number, or the model explicitly reporting it read the name
   from printed text on the card. Color/sheen alone — however confident
   the model sounds — is not enough on its own.

   An untrusted parallel is not thrown away. It still displays (people can
   see what the model guessed) but it does not enter the eBay/thecardapi
   query, so a wrong guess can no longer produce a wrong, empty, or
   contaminated price. */
function parallelIsTrustworthy(ai) {
  const par = cleanVal(ai.parallel);
  if (!par || GENERIC_SET.test(par)) return true; // nothing to distrust

  // A serial number is real evidence regardless of what the model claims.
  if (serialDenominator(ai)) return true;

  // The model must say it read this from printed text, not inferred it
  // from color/sheen. See prompt field `parallelEvidence`.
  const evidence = String(ai.parallelEvidence || "").toLowerCase();
  if (evidence === "printed" || evidence === "serial") return true;

  return false;
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
  const par    = (GENERIC_SET.test(parRaw) || !parallelIsTrustworthy(ai)) ? "" : parRaw;
  const num    = cardNumberToken(ai);
  const grade  = (cleanVal(ai.gradeCompany) && cleanVal(ai.gradeValue))
                 ? cleanVal(ai.gradeCompany) + " " + cleanVal(ai.gradeValue) : "";

  /* A Japanese card and its English twin are different cards at very
     different prices, and they were being blended into one number.
     Sellers reliably put "Japanese" in the title; almost nobody writes
     "English", so only the Japanese case becomes a keyword. English
     stays implicit, which is also what the ask side already assumes. */
  const lang = /^(jap|jpn)/i.test(cleanVal(ai.language)) ? "Japanese" : "";

  /* AN AUTOGRAPH HAS TO REACH THE QUERY, OR IT GETS PRICED AS A BASE CARD.

     isAutograph came back from the scan and was then used nowhere. The
     query was built from year, brand, set, player, parallel, number and
     grade -- so a signed card searched eBay exactly as if it were the
     base rookie.

     The sold filter then completed the damage. NOT_THE_CARD contains
     "auto", "autograph", "signed" and "signature", and looksBaseSale()
     drops any sale whose title matches. So every genuine autograph sale
     was stripped from the pool as "not the card", and the auto was
     priced from base-card comps -- a four-figure card valued off a $70
     one.

     There IS a guard for this. targetIsSpecial = notTheCard(query) is
     meant to stop the stripping when the card being priced is itself
     special, and the comment above it says exactly that. But it tests
     the QUERY STRING, and on a scan the query never contained an auto
     word. It only ever fired when somebody typed "auto" themselves.
     Typed searches priced correctly; scans of the same card did not.

     Putting the word in the query fixes both halves at once: eBay
     returns autograph listings, and targetIsSpecial sees "auto" and
     stops filtering them out.

     Kept out of the loose tier deliberately. Loose exists for when
     nothing else matched, and an auto with no sales of its own is
     better shown as "no data" than priced off base cards -- which is
     precisely the failure this fixes. Same reasoning for patch. */
  const auto  = ai.isAutograph ? "auto"  : "";
  const patch = ai.isPatch     ? "patch" : "";

  /* THE PRINT CODE, WHERE IT CAN ACTUALLY CHANGE THE ANSWER.

     TIGHT ONLY, and for the same reason the serial number is tight
     only: if this term finds nothing, the broadening chain falls back
     to a query without it and the person still gets a price. A wrong
     variation call costs one empty query rather than a wrong number.

     ai.printCode is set by the scan handler from lookupPrintCode().
     Nothing else populates it, so a typed search or a card from a
     product we have no codes for carries no term at all. */
  const variation = variationSearchTerm(ai.printCode);

  /* THE SERIAL DENOMINATOR IS THE MOST IDENTIFYING TOKEN ON THE CARD,
     AND IT WAS ONLY EVER USED TO FILTER, NEVER TO SEARCH.

     serialDenominator() already existed and is careful -- it pulls "/75"
     out of "55/75" and refuses "/1" because it substring-matches /10,
     /15 and /199. But it was only called by the parallel-trust check
     and the sold-side matcher. The query never carried it.

     A real scan showed the cost. A Cody Williams Hoops Hyper Signatures
     Green Parallel 55/75 searched as "2026 Topps Hoops Hyper Signatures
     Cody Williams #HHS-CW auto" and came back with 41 listings spanning
     $6 to $150 -- a Chrome auto, a graded Shrouded, a Singularity
     Signatures. All genuinely Cody Williams autographs, none of them
     this card. The spread warning fired and the price was correctly
     refused, which is the system working, but it never needed to get
     that far: "/75" would have cut the field to one card.

     TIGHT ONLY, deliberately. A serial is read off small print and is
     exactly the kind of field a photograph gets wrong. If the tight
     query returns nothing, the broadening chain already drops back to
     set-noNum and core, which do not carry it. So a misread serial
     costs one empty query rather than a wrong price -- and a correct
     one identifies the card outright. */
  const serial = serialDenominator(ai);

  let tight, core, loose;
  if (poke) {
    // "pokemon" is forced in so eBay lands in the right category, and the
    // variant is deliberately left out of the keywords.
    tight = joinParts(["pokemon", lang, player, set, num, serial, auto, patch, grade]);
    core  = joinParts(["pokemon", lang, player, num, auto, patch, grade]);
    loose = joinParts(["pokemon", lang, player, auto]);
  } else {
    tight = joinParts([year, brand, set, player, par, num, serial, variation, auto, patch, grade]);
    core  = joinParts([year, brand, player, num, auto, patch, grade]);
    loose = joinParts([year, brand, player, auto]);
  }

  /* THE SET IS THE LAST THING TO DROP, NOT THE FIRST.

     Found on a real flatbed batch. The sold retry stepped from
     "2022 Topps Chrome Willy Adames #140" straight to
     "2022 Topps Willy Adames" -- dropping the card number AND the set
     in one move -- and came back with fourteen sales: a Generation Now
     Blue, an In the Name Relic 1/1 at $92, an Allen & Ginter Chrome,
     a Stadium Club Orange /25, a Foilboard /875 and a 1987 insert.
     Every Topps product that player appeared in that year, and not one
     of them the card being priced.

     After year and player, the SET is the strongest thing separating
     one card from another -- Chrome, Heritage and Stadium Club are
     different products at different prices. The card number is the
     weakest, because sellers routinely leave it out of a title.

     So there is now a step between them: same set, no card number.
     Broad enough to find the sales a strict number query misses,
     narrow enough that it cannot wander into a different product.
     "set-noNum" is tried before anything drops the set. */
  const setNoNum = poke
    ? joinParts(["pokemon", lang, player, set, auto, patch, grade])
    : joinParts([year, brand, set, player, variation, auto, patch, grade]);

  const tiers = [];
  if (tight) tiers.push({ tier: "tight", query: tight });
  if (setNoNum && setNoNum !== tight) tiers.push({ tier: "set-noNum", query: setNoNum });
  if (core && core !== tight && core !== setNoNum) tiers.push({ tier: "core", query: core });
  if (loose && loose !== core && loose !== tight && loose !== setNoNum) tiers.push({ tier: "loose", query: loose });
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

/* TEAM NAMES THAT CONTAIN A COLOUR WORD.

   Found 2026-08-28 against a real sold pool. A Munetaka Murakami base
   rookie priced at $1.00 while identical fixed-price copies sold at
   $13. The cause was not contamination — the parallels were being
   dropped correctly. It was the opposite: three of the cheapest real
   BASE sales were thrown out because their titles say "White Sox",
   and "white" is in COLOR_WORDS.

   This is the same family as the Blackmon-matched-as-"black" bug fixed
   in August, but it is NOT the same cause and the earlier fix cannot
   catch it. There the boundary matching was broken; here "white" is a
   genuine standalone word that happens to be half of a team name.

   Measured blast radius, base cards flagged as parallels purely by
   team name: White Sox, Red Sox, Blue Jays, Green Bay, Red Wings.
   Every sold median for those teams, everywhere in this file, has been
   computed from a depleted pool.

   Stripping the PHRASE, not the colour, is what keeps this safe. A
   genuine parallel of a White Sox card still reads as one: "White Sox
   Gold Refractor" loses "white sox" and is still caught by "gold" and
   "refractor". A White parallel of a White Sox card — "White Sox White
   Parallel" — loses the team phrase and is still caught by the
   remaining "white". Only the team name itself stops voting. */
const TEAM_COLOR_PHRASES = [
  "white sox", "red sox", "blue jays", "red wings", "green bay",
  "blue jackets", "golden knights", "golden state", "silver knights",
  "red bulls", "red raiders", "green wave", "black hawks", "blue devils",
  "orange bowl", "big red"
];
function stripTeamColorPhrases(t) {
  let out = t;
  for (let i = 0; i < TEAM_COLOR_PHRASES.length; i++) {
    out = out.split(TEAM_COLOR_PHRASES[i]).join(" ");
  }
  return out;
}
function titleLooksParallel(title, brandName) {
  let t = " " + String(title || "").toLowerCase() + " ";
  String(brandName || "").toLowerCase().split(/\s+/).forEach(w => {
    if (w.length > 2) t = t.split(w).join(" ");
  });
  if (looksLikeSerialNumbering(t)) return true;
  // Team names go before the colour test, not after — see
  // stripTeamColorPhrases(). "Chicago White Sox" must not vote "white".
  t = stripTeamColorPhrases(t);
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
   cost and it is deliberate.

   v2 -> v3 (2026-08-29). Four changes landed since v2 and every one of
   them alters what comes back for the same query, so every v2 row is
   now an answer from logic that no longer exists:

     - the year-correction retry stopped being gated on a zero sold
       count, since a wrong year fuzzy-matches into a full result set
       rather than an empty one
     - a broadening retry was added for exact queries that find nothing
     - a set-preserving tier was added between tight and core, after
       dropping the set in one step swept a relic, a Foilboard and a
       1987 insert into one card's pool
     - the broadening retry now refuses contaminated and limited pools
       instead of adopting the first tier with any records

   Without this bump the cache serves v2 answers for twelve hours and
   the new logic looks like it is doing nothing -- which is exactly what
   happened while testing today, and cost an afternoon of reading query
   patterns to work out that the code was fine and the cache was old.

   The cost is one fresh API call per card tomorrow instead of a cache
   hit. Today's usage was around 2% of the daily allowance, so this is
   not the thing to economise on. */
const SOLD_LOGIC_VERSION = 3;

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

  /* A VARIATION IS NOT A BASE CARD EITHER.

     targetIsSpecial already stops NOT_THE_CARD emptying the pool when
     the card being priced IS an auto or a patch. A variation needs the
     same protection for a different reason: titleLooksParallel() sees
     the word "Variation" and drops the sale as a parallel, so a query
     that finally found the right comps would have them filtered out
     one step later.

     Read off the QUERY, exactly as the other two guards are, so it
     only fires when the variation term genuinely made it into the
     search rather than on anything the model merely guessed. */
  const targetIsVariation = /\b(variation|ssp|sssp)\b/i.test(String(query || ""));

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
  const filt = { rawBase: 0, rawAll: 0, rawFellBack: false, rawThin: false };
  const rejected = [];
  const narrow = function (group, tag) {
    if (targetIsParallel || targetIsSpecial || targetIsVariation) return group;
    const base = [];
    group.forEach(function (r) {
      const why = saleRejectReason(r);
      if (!why) { base.push(r); return; }
      if (tag === "raw") {
        rejected.push({ price: r.price, title: r.title,
                        rule: why.rule, reason: why.reason });
      }
    });
    if (tag === "raw") { filt.rawBase = base.length; filt.rawAll = group.length; }
    if (base.length >= MIN_GROUP) return base;
    /* THE FALLBACK NO LONGER RUNS FOR THE RAW BASE POOL.

       It used to hand back the ENTIRE ungraded group when too few base
       sales survived — parallels, inserts and lots included — and the
       headline was then computed from that. The warning said so, but a
       shop reads the number, not the caveat, and a contaminated median
       under any label still ends up on a price sticker.

       A thin clean pool is now returned thin, even empty. Downstream
       treats that as "not enough clean comps to price from" and flags
       for review rather than substituting a number built from the wrong
       cards. Graded and ladder keep the old behaviour: they are reported
       alongside, never as the headline shop price. */
    if (tag === "raw") { filt.rawThin = true; return base; }
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

  /* HOW THE SALE HAPPENED, APPLIED TO THE HEADLINE.

     Measured on a real card (2026 Topps Series Two Murakami #503):
     auction median $1, fixed-price median $13, from the same 55 sold
     records. Thirty-four auction closes outvoted twelve fixed-price
     sales and the shop price came out at $1.00 on a card changing
     hands around $13.

     Deliberate note, because this file already argues the other way a
     few lines below: a fixed-price median IS closer to an asking price
     than an auction close is, and that comment stays true. This is a
     product decision for shop pricing specifically — a shop is setting
     a sticker, not predicting an auction floor — not a claim that
     fixed-price sales are better evidence in general. */
  /* Classified through the SAME bucket() rules listingMix() already
     uses, not an exact-string match on the field.

     Caught against a real response, not in review: the API returns
     "fixed_price", while an earlier version of this tested for the
     literal "fixed". Every fixed-price sale therefore fell through as
     neither fixed nor auction, the fixed pool was permanently empty,
     and the fixed-price headline could never engage on any card. It
     would have looked exactly like "there were never enough fixed
     sales" — a silent no-op, not an error.

     Sharing listingMix's own classifier is what stops the two from
     ever disagreeing again: if a new listing type appears, both sides
     learn about it at once. */
  const typeBucket = t => {
    const v = String(t || "").toLowerCase();
    if (v.indexOf("auction") > -1) return "auction";
    if (v.indexOf("best_offer") > -1 || v.indexOf("best offer") > -1) return "fixed";
    if (v.indexOf("fixed") > -1 || v.indexOf("buy") > -1) return "fixed";
    return "other";
  };
  const rawFixed     = raw.filter(r => typeBucket(r.listingType) === "fixed");
  const rawAuction   = raw.filter(r => typeBucket(r.listingType) === "auction");
  const fixedP       = rawFixed.map(r => r.price).sort((a, b) => a - b);
  const auctionP     = rawAuction.map(r => r.price).sort((a, b) => a - b);
  const fixedMed     = median(fixedP);
  const auctionMed   = median(auctionP);
  const dates = clean.map(r => r.saleDate).filter(Boolean).sort();

  const ladder = soldGradeBreakdown(ladderSrc);
  const rawMed = median(rawP);

  /* The headline number must describe ONE thing. A raw card is not worth
     the median of raw sales and PSA 10 slabs mixed together — that median
     drifts upward with every slab in the window. When there are enough raw
     sales, they are the headline; the graded side is reported separately. */
  const useRaw   = rawP.length >= MIN_GROUP;
  /* Fixed-price base sales are the headline when there are enough of
     them. Below MIN_FIXED the fixed sample is too small to be a market
     read on its own, so the full clean base pool stands instead — and
     the limited-sample flag below decides whether that number can be
     trusted at all. */
  const useFixed = fixedP.length >= MIN_FIXED;
  const headline = useFixed ? fixedP : (useRaw ? rawP : []);
  let   basis    = (useFixed || useRaw) ? "raw" : "none";
  const range    = trimmedRange(headline);

  /* SELF-CONSISTENCY CHECK.

     A base card cannot be worth most of its own graded copy — the gap is
     the entire reason grading exists. When the raw median lands near the
     PSA 9, the raw pool is not raw base cards, whatever the filter
     concluded. Both numbers are already computed here, so this costs
     nothing to check and catches contamination the word lists miss.

     THE THRESHOLD SCALES WITH SAMPLE SIZE. A fixed 0.7 line treats a
     2-sale sample and a 46-sale sample as equally trustworthy, which
     they are not: 46 independent sales landing near each other is real
     evidence a 2-sale sample simply cannot offer. A popular, heavily
     traded card (confirmed case: a 2018 Ohtani RC with 46 confirmed
     base-card sales) was getting flagged as contaminated on every
     single lookup despite the data being genuinely solid — a stricter
     line makes sense on thin data, where one mixed-in parallel can
     swing the whole median, but the same line punishes exactly the
     cards with the most evidence behind them. */
  let warning = "";
  let contaminated = false;
  let limited = false;
  const psa9  = ladder.find(g => g.grade === "PSA 9");
  const psa10 = ladder.find(g => g.grade === "PSA 10");
  const rung  = (psa9 && psa9.median) || (psa10 && psa10.median ? psa10.median * 0.34 : 0);
  const contamThreshold = raw.length >= 35 ? 0.85
                        : raw.length >= 20 ? 0.78
                        : raw.length >= 10 ? 0.70
                        : 0.60;

  if (useRaw && rung > 0 && rawMed >= rung * contamThreshold) {
    contaminated = true;
    basis = "mixed";
    warning = "These ungraded sales look like they include parallels or inserts — " +
              "the raw price sits too close to the graded price to be one card. " +
              "Narrow the search before trusting this number.";
  } else if (filt.rawThin) {
    /* Replaces the old rawFellBack branch. That one apologised for a
       contaminated median; this one exists because there no longer is
       one. The pool is thin or empty and nothing was substituted. */
    limited = true;
    warning = "Only " + filt.rawBase + " clean base-card sale" +
              (filt.rawBase === 1 ? "" : "s") + " out of " + filt.rawAll +
              " ungraded. Too few to price from — review before pricing.";
  } else if (!useFixed && useRaw && fixedP.length > 0 && fixedMed >= rawMed * 3) {
    /* The penny-auction split. Fixed-price copies are selling for
       several times what auctions close at, but there are too few
       fixed sales to headline. Publishing the auction median here is
       exactly the $1-on-a-$13-card failure, so it gets flagged rather
       than presented as a clean read. */
    limited = true;
    warning = "Auction closes (median $" + auctionMed + ") sit far below fixed-price sales " +
              "(median $" + fixedMed + ", only " + fixedP.length + " of them). " +
              "Too thin to call a market price — review before pricing.";
  }
  /* LIMITED IS NOT CONTAMINATED. Kept as two separate facts on purpose.

     soldContaminated means what it has always meant: records that are
     not this card are still inside the pool the headline was computed
     from. After this change that is a narrower claim than it used to
     be, because the base filter no longer falls back to the whole
     ungraded group — so contamination now means the self-consistency
     check caught something the word lists missed, not that a fallback
     substituted the wrong cards.

     soldLimited means the opposite situation: the exclusions all
     WORKED, and what survived is too small to call a market price.
     Nothing contaminated is in the number; there is just not enough of
     it. Reporting that as contamination would say something false
     about the comps that were selected.

     They are independent, and both can be false, either can be true. */

  return {
    soldCount:     clean.length,
    soldMedian:    median(headline),
    soldLow:       range.low,
    soldHigh:      range.high,
    /* A limited result must not reach the UI wearing a clean "sold"
       label. resolvePriceAndBasis() in the frontend decides clean-vs-
       flagged from soldContaminated alone, and soldContaminated is
       deliberately false here (see above), so the honest signal has to
       ride on the basis string instead: "limited" is not "raw", and
       anything reading this cannot mistake it for a confident median. */
    soldBasis:     limited ? "limited" : basis,
    soldWarning:   warning,
    soldContaminated: contaminated,
    /* COMPGUARD — the sales that were NOT used, and why.

       Every one of these was already being excluded; the only change is
       that the reason is kept instead of discarded. Nothing new is
       fetched. `verified` is deliberately not called "exact": these
       sales passed the rejection rules, which is a weaker and more
       honest claim than establishing identical identity.

       Graded sales are listed as excluded rather than rejected when the
       headline is raw — they are a different condition of the same card,
       not the wrong card. */
    compGuard: (function () {
      const groups = {};
      rejected.forEach(function (x) {
        if (!groups[x.reason]) groups[x.reason] = { reason: x.reason, count: 0, rules: {} };
        groups[x.reason].count++;
        groups[x.reason].rules[x.rule] = (groups[x.reason].rules[x.rule] || 0) + 1;
      });
      if (basis === "raw" && gradedAll.length) {
        gradedAll.forEach(function (r) {
          const label = "Graded" + (r.grader ? " " + r.grader : "") +
                        (r.grade ? " " + r.grade : "");
          if (!groups[label]) groups[label] = { reason: label, count: 0, rules: {} };
          groups[label].count++;
          groups[label].rules["graded"] = (groups[label].rules["graded"] || 0) + 1;
        });
      }
      const reasons = Object.keys(groups).map(function (k) { return groups[k]; })
        .sort(function (a, b) { return b.count - a.count; });
      const leftOut = reasons.reduce(function (a, g) { return a + g.count; }, 0);
      return {
        verified:  headline.length,
        considered: clean.length,
        leftOut:   leftOut,
        reasons:   reasons,
        samples:   rejected.slice(0, 6).map(function (x) {
                     return { price: x.price, reason: x.reason };
                   })
      };
    })(),
    soldMedianAll: median(prices),
    soldCountUsed: headline.length,
    /* The frontend prints "100+" when the count hits the limit, because a
       count sitting exactly at the ceiling is a ceiling and not a total.
       It needs to know what the ceiling actually was. */
    limitUsed:     limitUsed || CARDAPI_LIMIT,
    soldRaw:    { count: raw.length,    median: rawMed },
    soldFixed:   { count: fixedP.length,   median: fixedMed },
    soldAuction: { count: auctionP.length, median: auctionMed },
    soldHeadlineBasis: useFixed ? "fixed_base" : useRaw ? "all_base" : "none",
    soldLimited: limited,
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

  /* THE MEDIAN AND THE COUNTS ARE TWO DIFFERENT DECISIONS.

     Both gates below still refuse to write a median, for the reasons
     they give. But they used to return before writing ANYTHING, and the
     rejection counts are most interesting on exactly the scans they
     reject: a contaminated pool is a pool full of wrong cards, and a
     limited one is a pool the rules emptied. Those are the rows that
     say what CompGuard is actually catching, and they were the rows
     being thrown away.

     So the counts are written on every scan with sold data. The median
     stays gated. A row with counts and a null median is not a gap in
     the series -- it is the record of a day the number could not
     honestly be called. */
  const guard = (sold && sold.compGuard) || null;
  const guardCols = guard ? {
    verified_count:   guard.verified,
    considered_count: guard.considered,
    left_out_count:   guard.leftOut,
    reasons:          guard.reasons || null
  } : {};

  async function writeCountsOnly(why) {
    if (!guard) return;
    try {
      await supabaseAdmin.from("card_price_history").upsert(Object.assign({
        cache_key:  key,
        card_query: query,
        sale_date:  new Date().toISOString().slice(0, 10),
        sold_count: sold.soldCount || 0
        /* No median, no low, no high. Withheld on purpose -- see the
           gate that sent us here. */
      }, guardCols), { onConflict: "cache_key,sale_date" });
      console.log("[history] counts-only row for " + query + " — " + why);
    } catch (e) {}
  }
  /* A contaminated median must not enter the permanent series. The
     cached payload expires in twelve hours; a history row does not, and
     a bad point poisons every movement arrow computed against it. */
  if (sold.soldContaminated) {
    console.log("[history] skipped CONTAMINATED median for " + query +
                " — wrong cards remain in the headline pool");
    await writeCountsOnly("contaminated");
    return;
  }
  /* Limited is a different reason for the same decision, and it needs
     its own gate rather than riding on soldContaminated — the two were
     deliberately separated, so a limited result reaches here with
     soldContaminated false and would otherwise be written as a clean
     point.

     A thin-sample median is still shown to the person, with its
     warning, because a flagged number they can weigh beats no number.
     It must not become PERMANENT. The cached payload expires in twelve
     hours; a history row never does, and every movement arrow drawn
     against it inherits the error. The measured case: a Murakami base
     rookie reading $1 off six penny auctions, on a card whose
     fixed-price copies were selling far higher. */
  if (sold.soldLimited) {
    console.log("[history] skipped LIMITED median for " + query +
                " — comps were clean but too thin to price from");
    await writeCountsOnly("limited");
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
      graded_median: (sold.soldGraded && sold.soldGraded.median) || null,
      verified_count:   guard ? guard.verified   : null,
      considered_count: guard ? guard.considered : null,
      left_out_count:   guard ? guard.leftOut    : null,
      reasons:          guard ? (guard.reasons || null) : null
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
        { type: "text", text: "Identify this card as precisely as possible. Return ONLY a JSON object with these exact keys: cardName, player, year, brand, set, setCode, cardNumber, sport, parallel, parallelOptions, parallelCertain, parallelEvidence, insert, serialNumber, language, isRookie, isAutograph, isPatch, isRedemption, printCode, gradeCompany, gradeValue, signal, confidence, summary.\n\nHOW TO READ A CARD \u2014 DO THIS FIRST, BEFORE ANY OF THE RULES BELOW:\nEverything you need is PRINTED ON THE CARD. Read it. Do not infer it from what the card looks like or from what cards like this usually are.\n1. BRAND \u2014 find the manufacturer logo. It is almost always on the front, and the copyright line on the back names it outright: 'Topps', 'Panini', 'Upper Deck', 'Donruss', 'Bowman', 'Fleer', 'Leaf'. These logos look nothing alike. Read the one that is actually there. Do NOT guess a brand because the design reminds you of one \u2014 a wrong brand sends the whole lookup to a different company's product.\n2. YEAR \u2014 the copyright line on the back, usually next to the manufacturer name. Use that, not the season the player was active.\n3. CARD NUMBER \u2014 usually on the back, top or bottom corner. Copy it exactly, including any letters or slashes.\n4. PLAYER \u2014 printed on the front. Full name as shown.\n5. SET \u2014 the product line, printed on the front or named in the back's copyright line.\n\nIf the photo is too blurry or cropped to read one of these, return 'Unknown' for that field. A field you could not read is far better than one you invented \u2014 a made-up brand or year produces a confident price for a completely different card.\n\nGLARE ON SHINY SURFACES \u2014 A SPECIFIC AND COMMON FAILURE MODE:\n- Chrome, Prizm, Optic, and other holographic-finish cards reflect light unpredictably, and the reflection moves with the angle of the photo. The SAME physical card photographed twice, seconds apart, can show glare over completely different parts of the card each time.\n- This means small printed text \u2014 the copyright year especially, since it's small and often near the border \u2014 can be partially washed out by glare in one photo and fully legible in another, even for the identical card.\n- If glare, reflection, or a bright hotspot covers ANY part of the year, card number, or set text, do not guess the obscured digit or character from context (\"it's probably 2023 because these usually are\"). Return 'Unknown' for that field instead. A guess made confident by pattern-matching against typical years is exactly the kind of invented answer this whole instruction set exists to prevent.\n- Do not let a shiny/holographic FINISH be mistaken for a named PARALLEL. \"Prizm\" is a specific Panini product line, not a generic word for \"shiny\" \u2014 a card can have a holographic look without actually being a Prizm-branded parallel. Only report a parallel name you can tie to actual printed text, a serial number, or a color scheme specific to that product's known parallel list. A generic shine is not evidence of any particular named parallel.\n\nTHE SINGLE MOST IMPORTANT FIELD IS player. Never leave it empty.\n- On a sports card it is the athlete's name.\n- ON A POKEMON OR TCG CARD IT IS THE CREATURE'S NAME, including its suffix exactly as printed: 'Coalossal VMAX', 'Charizard V', 'Umbreon VMAX', 'Pikachu ex', 'Mewtwo GX'. Set sport to 'Pokemon' and brand to 'Pokemon'. Without the name every price lookup fails, so read it off the top of the card even if the rest of the card is unclear.\n\nCRITICAL \u2014 PARALLEL IDENTIFICATION. Parallels change a card's value by 10x or more, so look carefully before concluding a card is base:\n- Border color is the main tell. Panini Prizm/Select/Optic parallels are named by color: Silver, Red, Blue, Green, Orange, Purple, Gold, Black, Pink, Camo, Mojo, Wave, Hyper, Disco, Shimmer, Ice.\n- Topps Chrome parallels: Refractor, X-Fractor, Prism, Atomic, Sepia, Gold, Orange, Red, SuperFractor, Negative, Speckle.\n- POKEMON: the variant matters as much as any colour parallel. Report it in the parallel field. Vintage: 1st Edition (look for the black stamp to the left of the artwork), Shadowless (no drop shadow on the right of the art box). Any era: Reverse Holo (the CARD BODY is foil, the artwork is not), Full Art, Alt Art, Rainbow Rare, Gold Secret Rare, Illustration Rare. Do NOT write Unlimited or Regular \u2014 that is the base printing, so leave parallel empty.\n- Look for rainbow/foil sheen, cracked-ice texture, sparkle, or a colored border that differs from the base design.\n- Look for serial numbering printed on the front or back, usually small, formatted like 25/99 or /99. Report it exactly as printed in serialNumber. POKEMON CARD NUMBERS ARE NOT SERIAL NUMBERING: 074/073, 4/102 and SV107/SV122 are the card's number within its set. Put those in cardNumber and leave serialNumber EMPTY.\n- '1/1' or 'One of One' is critical \u2014 always report it.\n- If you see a colored border or foil pattern but cannot name the exact parallel, use the color plus the word Parallel, e.g. 'Blue Parallel'.\n- Use an empty string for parallel ONLY if the card is clearly a plain base card.\n\nWHEN YOU CANNOT TELL WHICH PARALLEL \u2014 SAY SO INSTEAD OF PICKING ONE:\n- Some parallels differ only by a colour TINT across a foil surface, and a photograph taken under ordinary indoor light frequently cannot separate them. On Topps Chrome, a base Refractor, Sepia, Prism, Aqua and Rose Gold all look like 'a shiny refractor' in a phone photo. On Panini Prizm the Silver, Hyper and Disco parallels are similarly close.\n- In that situation do NOT choose the most likely one. Put the family in parallel \u2014 'Refractor' \u2014 AND list every candidate you genuinely cannot rule out in parallelOptions, most likely first, maximum six.\n- THE RULE RUNS BOTH WAYS, AND THE SECOND DIRECTION IS THE ONE THAT MATTERS: if your parallelEvidence is 'color' or 'uncertain', then by your own admission you are reading a sheen rather than reading the card, and parallelOptions MUST NOT be empty. List the candidates that finish could plausibly be, most likely first. Returning a named parallel with 'color' evidence and an empty parallelOptions is a contradiction: it says you are guessing and simultaneously offers nothing to choose between. If you truly cannot name a second candidate, your evidence is 'printed' or 'serial', not 'color'.\n- Set parallelCertain to false whenever parallelOptions has entries. Set it to true only when the card names its own parallel in printed text, carries a serial number that identifies it, or has a colour so distinct there is nothing to confuse it with.\n- If the card is plainly base, parallel is empty, parallelOptions is empty, and parallelCertain is true.\n- WHY THIS MATTERS: a wrong parallel is not a small error. A base Refractor and a Superfractor of the same card differ by a hundred times in price, so naming the wrong one produces a confident valuation that is wrong by orders of magnitude. Listing three candidates the buyer can choose between is worth far more than one guess that reads as certain.\n\nPARALLEL EVIDENCE \u2014 SAY WHERE YOUR ANSWER CAME FROM:\n- Whenever you report a non-empty parallel, also set parallelEvidence to exactly one of: 'serial' (you read a serial number that identifies it), 'printed' (the parallel name or color is printed as text on the card itself, not just visually apparent), 'color' (you are going only on the visual color/sheen of the card), or 'uncertain' (you are guessing from a general impression).\n- A parallel you identify from 'color' or 'uncertain' evidence is very often wrong on cards with a naturally shiny or prismatic BASE finish \u2014 this is not a small risk, it is the single most common parallel-identification error. Report your best guess honestly, but do not set parallelCertain to true unless your evidence is 'serial' or 'printed'.\n- DONRUSS OPTIC SPECIFICALLY: the BASE card in Donruss Optic already has a holographic/prismatic finish that changes color under different lighting and camera angles. Do not report a Blue, Purple, Pink, or other named color parallel on an Optic card unless the color is a strong, saturated, UNIFORM tint across the entire card border with no rainbow/prismatic shift \u2014 a sheen or shimmer alone is the base card, not a parallel. When in doubt on Optic, report parallel as empty and set parallelEvidence to 'uncertain' rather than naming a color.\n\nINSERT SETS \u2014 REPORT THESE TOO, IN THE insert FIELD:\n- An insert is a themed subset printed alongside the base set, with its own name printed on the card front: 'Freshman Flash', 'Future Stars', 'Kaboom', 'Downtown', 'Diamond Kings', 'Stars of MLB', 'Home Field Advantage'.\n- An insert is NOT the base card and does not trade at base-card prices, so a base price on an insert is wrong in both directions.\n- Read the name off the front and put it in insert EXACTLY as printed. If the card carries no insert name, return an empty string.\n- Do not confuse an insert with a parallel. A parallel is the same card in a different finish; an insert is a different card design entirely. A card can be both.\n\nSET FIELD RULES \u2014 IMPORTANT:\n- The 'set' field must be the actual product/subset name as it would appear in an eBay listing title, for example 'Update Series', 'Draft Picks', 'Downtown', 'Kaboom'.\n- If the card is just the base set of the product, return an EMPTY STRING for set. Never return 'Base', 'Base Set', 'Base Rookie', or 'Common' \u2014 those words do not appear in listing titles and break the price search.\n- POKEMON IS THE EXCEPTION TO THAT RULE. Pokemon set names are real products and must ALWAYS be returned in full, even when they sound generic: 'Base Set', 'Jungle', 'Fossil', 'Team Rocket', 'Neo Genesis', 'Evolving Skies', 'Champions Path', 'Darkness Ablaze', 'Rebel Clash', 'Hidden Fates', 'Obsidian Flames', '151'. Use the set symbol and the card number to identify it. Never return an empty set for a Pokemon card if you can name the set at all.\n- POKEMON SET CODES \u2014 REPORT WHAT IS PRINTED, SEPARATELY FROM WHAT YOU THINK IT MEANS. Modern Pokemon cards print a 2-4 letter code in the bottom corner beside the card number: SVI, PAL, OBF, EVS, SSP, MEW, ASC, PFL.\n  \u2022 Put the code EXACTLY as printed in setCode. This is something you can read \u2014 report it even if the set is unfamiliar.\n  \u2022 Put the set name in set ONLY IF YOU ARE CERTAIN which set that code belongs to. If you are not certain, LEAVE set EMPTY. Do not reach for the closest set you happen to know.\n  \u2022 A wrong set name is far worse than no set name. It pulls comps for a different card and looks authoritative doing it. 'I read PFL and I do not know that set' is a correct and useful answer; guessing 'Obsidian Flames' because OBF is similar is not.\n  \u2022 The year must match the set you name. If you are unsure of the set, do not adjust the year to fit a guess \u2014 read the copyright year off the card.\n\nSPORT \u2014 ALWAYS FILL THIS IN:\n- One of: Baseball, Basketball, Football, Hockey, Soccer, Pokemon, Racing, Wrestling, Golf, Tennis, MMA, Non-Sport.\n- Read it off the card: the team, the league logo, the uniform, the position, the equipment in the photo.\n- This is NOT optional and 'Unknown' is not an acceptable answer. Two sets can share a name, a year and a brand and still be different sets \u2014 1986 Topps is 792 cards in baseball and 396 in football. Without the sport there is no way to tell them apart, so a collector gets the wrong set size for the rest of time.\n- If the card is genuinely ambiguous, pick the most likely sport rather than leaving it blank.\n\nLANGUAGE:\n- Return 'Japanese' if the card text is Japanese, or 'Chinese' or 'Korean' where those apply. Otherwise return 'English'.\n- Japanese Pokemon cards trade as a separate market at different prices, so getting this wrong misprices the card badly. They are a slightly different size, carry Japanese characters in the name and attack text, and usually print the card number without a set total.\n\nOTHER RULES:\n- If a back image is provided, TRUST THE BACK for card number, set name, and copyright year \u2014 printed text beats inferring from the front design.\n- If the card is in a graded slab, read the label for company, grade, year, player, set, and card number.\n- isRookie, isAutograph, isPatch must be true or false booleans.\n\nAUTOGRAPHS AND MEMORABILIA \u2014 GET isAutograph AND isPatch RIGHT, THEY CHANGE THE PRICE MORE THAN ALMOST ANYTHING ELSE:\n- A REAL AUTOGRAPH is ink applied to the physical card after printing. Tells: the ink sits ON TOP of the printed image and can overlap it unevenly; it catches light differently from the card surface; stroke width varies; it may run past the intended area or sit crooked. Many are on a clear or white STICKER \u2014 look for a rectangular panel with visible edges, often slightly different in gloss from the card around it. That is still a real autograph; set isAutograph true.\n- THE MOST COMMON MISTAKE IS A FACSIMILE SIGNATURE. Huge numbers of ordinary base cards print a copy of the player's signature as part of the design. It is part of the artwork: perfectly placed, identical gloss to the rest of the card, often in gold, silver or white foil, and frequently in the same spot on every card in the set. That is NOT an autograph \u2014 set isAutograph FALSE. If a signature looks like it was designed onto the card rather than written on it, it is a facsimile.\n- The back of a genuine autograph card almost always says so: 'Certified Autograph Issue', 'Authentic Autograph', or wording about the player having personally signed. If a back image is provided, read it \u2014 it settles the question outright.\n- Card numbers beginning with letters like RA-, AU-, CA-, A- or RPA- usually indicate an autograph or autograph-relic subset.\n- isPatch is true when the card has a window cut into it with fabric, jersey material or a swatch visible, or when the card says 'Game-Used', 'Player-Worn', 'Memorabilia' or 'Relic'. A printed picture of a jersey is not a patch.\n- A card can be both \u2014 a rookie patch auto is common. Set both flags.\n- When you genuinely cannot tell whether a signature is real or printed, set isAutograph FALSE and say so in summary. A card wrongly marked as an autograph gets priced against signed copies worth many times more, which is a worse error than missing one.\nTHE YEAR IS ON THE BACK IN THE COPYRIGHT LINE. USE IT.\n- TODAY IS IN " + new Date().getFullYear() + ". CARDS FROM THIS YEAR AND LAST YEAR EXIST AND YOU WILL NOT RECOGNISE MANY OF THEM. Your training ended before the newest products were released, so a set you have never heard of is the EXPECTED case for a recent card, not a sign you have misread something. If the copyright line says a year later than any product you know, the copyright line is right and you are out of date.\n- NEVER substitute an earlier year because the product is unfamiliar. A card reading \u00a9 " + new Date().getFullYear() + " is from " + new Date().getFullYear() + ", even if you know nothing about that set. Reporting an older year finds sales for a card that is not the one in the photo, and it looks authoritative doing it.\n- ANNIVERSARY AND THROWBACK INSERTS ARE THE WORST CASE FOR THIS. Names like '75 Years of Baseball', '35th Anniversary', '1989 Design' or 'Silver Pack' describe what the insert CELEBRATES, not when it was printed \u2014 a 75-year anniversary set is printed in the anniversary year, which is recent. Never derive the year from the insert's theme, its retro artwork, or the era it commemorates. Read the copyright.\n- The bottom of almost every modern card back carries a line like '\u00a9 2026 THE TOPPS COMPANY, INC.' or '\u00a9 2026 PANINI AMERICA'. THAT is the year of the card. Read it and use it.\n- DO NOT take the year from the DESIGN. Manufacturers constantly reissue old designs: a 2026 Topps insert can copy the 1991 Topps look exactly, down to the border and the logo. A 2022 card can look like 1987. If the artwork says one year and the copyright says another, THE COPYRIGHT WINS, every time.\n- Statistics on the back are a second check. A batting record running through 2025 cannot be a 1991 card. If the newest season listed is later than the year you were about to report, you have read the design year, not the real one.\n- This is the single most common serious error made on these cards. A wrong year finds no sales at all, because the card being searched for was never printed.\n\nCARD NUMBERS: READ THEM EXACTLY, INCLUDING LETTERS AND LINE BREAKS.\n- The card number is usually in a corner of the back, often inside a circle, box or coloured shape.\n- IT FREQUENTLY WRAPS ONTO TWO LINES because the shape is small. A number printed as '91B2-' on the first line and '40' on the second is ONE card number: 91B2-40. Join the lines, keep the hyphen, and DO NOT insert a slash, space or any other character where the line break was.\n- NEVER convert a wrapped number into a fraction. '91B2-' over '40' is not 91/82, not 91/40, and not 9182. Reproduce exactly what is printed.\n- Insert and subset numbers routinely contain LETTERS mixed with digits: 91B2-40, BCR-1, HHS-CW, MLM-CC, US285, RA-JD. Read letters as letters. B is not 8 and not 1; I is not 1; O is not 0; S is not 5. If a character is genuinely ambiguous, prefer the letter, because a number with a letter in it is far more common in inserts than the reverse.\n- If the number is unreadable, return an empty cardNumber rather than a guess. A missing number broadens the search; a wrong one finds nothing at all.\n\nREDEMPTION CARDS \u2014 SET isRedemption AND DO NOT READ THE CODE:\n- A redemption is not a card, it is a voucher. The manufacturer could not finish the real card in time, so the pack contains a slip that is exchanged on their website for the actual card later.\n- Tells: the word 'REDEMPTION' printed prominently, usually large on the front. Wording like 'Redeem at toppsredemption.com', 'panini redemption', 'expires', 'this card may be redeemed for'. A scratch-off panel, or a printed alphanumeric code. Often the player photo is a silhouette, a generic image, or absent entirely.\n- Set isRedemption true when you see any of that. Set it false otherwise.\n- NEVER transcribe, repeat, or partially quote the redemption code \u2014 not in cardName, not in cardNumber, not in summary, not anywhere. That code is bearer value: whoever enters it first receives the card, whether or not they own the slip. Repeating it back is the same as giving it away.\n- Do not attempt to value a redemption from the slip. What it is worth depends entirely on the card it redeems FOR, and that card is not pictured. Fill in the player and year if they are printed, leave the rest as you find it, and let the app handle the rest.\nTHE PRODUCTION CODE ON THE BACK \u2014 READ IT IF YOU CAN, LEAVE IT EMPTY IF YOU CANNOT:\n- Topps cards print a production code in the fine print at the very bottom of the back, on the same line as the topps.com address. It looks like 'CODE#CMP037284'.\n- Put the digits in printCode, exactly as printed. If you can only make out the last few characters, report what you can read.\n- This is SMALL, LOW-CONTRAST TEXT and it is frequently unreadable in a photo, especially on a shiny back where glare lands on it. An empty printCode is a completely fine answer. DO NOT GUESS ANY DIGIT. A wrong code says the card is a different version than it is, which is worse than no code at all \u2014 the app asks the person to type it themselves when it is missing.\n- Leave it empty for any non-Topps card and for any card where you cannot actually read the digits.\n- signal must be one of: GRADE, WATCH, SELL RAW, HOT, VERIFY.\n- confidence must be High, Medium, or Low. Use Low if the image is blurry or you are unsure about the parallel.\n- Never guess a dollar value. Never include price fields." },
        ...images
      ]}
    ],
    temperature: 0.1,
    /* 700 was tight for 25 keys plus a summary, and parallelOptions is an
       array that only appears when the model has something to say. Room to
       list three or four candidates costs a fraction of a cent. */
    max_tokens: 900
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

/* ══════════════════════════════════════════════════════════════
   LISTING-YEAR CORRECTION

   A real miss, 2026-08-28: a Munetaka Murakami base rookie scanned as
   "2023 Topps Series Two ... #503" with confidence High. Player right,
   set right, card number right — the year invented. His MLB rookie card
   is 2026 Topps Series 2. Every one of the six eBay listings the price
   was taken from had 2026 in the title. Not one said 2023.

   The cost was not cosmetic. getSoldComps() is handed the same query
   the listings search used, so the sold lookup went out asking for a
   card that has never existed, matched nothing (soldCount 0), and the
   card fell back to an asking median. A hallucinated year turns into a
   worse number on a shop's shelf, not just a wrong label.

   The correction is free and already in hand: the active listings are
   real marketplace titles written by people holding the card. When the
   year the model claims appears in NONE of them and a different year
   carries most of them, the listings are the better evidence.

   Deliberately narrow, because a wrong "correction" is worse than a
   missed one:
     - only runs when the sold lookup as-read found NOTHING. A card that
       already priced off real sold comps is never second-guessed, and
       the retry costs exactly one extra call in the only case that
       needs it;
     - needs 3+ listings that actually contain a year;
     - one single listing supporting the model's year cancels it
       outright — no argument, no weighing;
     - the replacement year has to carry 70% of the listings that have
       one, not merely be the most common;
     - the retry is ADOPTED only if it comes back with real sales. A
       corrected query that also finds nothing proves nothing, so the
       original result stands.

   What this deliberately does NOT do: overwrite ai.year, cardName, or
   searchQuery. Same principle as verifyAgainstCatalog above — a second
   opinion is reported alongside the read, never folded silently into
   it. The response carries yearCorrection so the client can show what
   happened and a human decides. The other half of this (offering the
   corrected year as a one-tap fix that rewrites the card's identity)
   belongs in the UI, not here.  */
function yearsInText(t) {
  var found = String(t || "").match(/\b(?:19|20)\d{2}\b/g);
  if (!found) return [];
  var seen = {}, out = [];
  for (var i = 0; i < found.length; i++) {
    if (!seen[found[i]]) { seen[found[i]] = 1; out.push(found[i]); }
  }
  return out;
}
function detectListingYear(ai, listings) {
  var claimed = String((ai && ai.year) || "").trim();
  if (!/^(?:19|20)\d{2}$/.test(claimed)) return null;
  if (!Array.isArray(listings) || listings.length < 3) return null;

  var withYears = 0, supporting = 0, tally = {};
  for (var i = 0; i < listings.length; i++) {
    var years = yearsInText(listings[i] && listings[i].title);
    if (!years.length) continue;
    withYears++;
    if (years.indexOf(claimed) !== -1) { supporting++; continue; }
    for (var j = 0; j < years.length; j++) tally[years[j]] = (tally[years[j]] || 0) + 1;
  }
  if (withYears < 3) return null;
  if (supporting > 0) return null;

  var best = null, bestN = 0;
  for (var y in tally) { if (tally[y] > bestN) { best = y; bestN = tally[y]; } }
  if (!best || bestN < Math.ceil(withYears * 0.7)) return null;

  return { claimedYear: claimed, listingYear: best, agreeing: bestN, total: withYears };
}
/* Swaps the year token in place rather than rebuilding the query from
   scratch, so every other term the tier logic decided on — set, card
   number, parallel, the junk it already stripped — survives untouched.
   Returns null when the year isn't actually in the query string, since
   there is then nothing to correct and guessing where to insert it
   would be inventing a search nobody chose. */
function swapYearInQuery(query, fromYear, toYear) {
  var q = String(query || "");
  if (!q || !fromYear || !toYear) return null;
  var re = new RegExp("\\b" + fromYear + "\\b", "g");
  if (!re.test(q)) return null;
  return q.replace(new RegExp("\\b" + fromYear + "\\b", "g"), toYear);
}

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

      /* RESOLVED BEFORE THE MARKET LOOKUP, NOT AFTER.

         lookupPrintCode() is pure -- a table read, no network -- so it
         costs nothing to run here, and buildQueryTiers() needs the
         answer to put the variation into the search. Resolving it
         afterwards (which is where it started life, purely for
         display) meant the price was already wrong by the time we knew
         what the card was. */
      ai.printCode = lookupPrintCode(ai.printCode, ai.year, ai.brand, ai.set);

      /* Verification runs alongside the price lookup rather than before
         it. Sequencing them would add its latency to every scan for a
         check that usually passes; in parallel it is nearly free in
         wall-clock time and the result is ready when the response is
         assembled. */
      const verifyPromise = verifyAgainstCatalog(ai);

      const market        = await getCardMarketForCard(ai);
      const searchQuery   = market.searchQuery || buildCardQuery(ai) || cleanCardName;

      let sold      = await getSoldComps(searchQuery, market.avgPrice);
      let soldQuery = searchQuery;

      /* See detectListingYear() above. Only fires when the sold lookup
         as-read came back empty, which is exactly the signature a bad
         year leaves behind. */
      /* THE GATE USED TO BE "only retry when the sold lookup found
         NOTHING". That was wrong, and a real scan proved it.

         2026-08-29: a Murakami base rookie was read as 2023 again. The
         query "2023 Topps Munetaka Murakami" came back with 100
         records -- eBay fuzzy-matches a wrong year into a full result
         set rather than returning nothing -- so soldCount was high,
         the retry never ran, and the card landed in a shop's inventory
         priced at $9.00 under a year that does not exist for it.

         A wrong year does not become right because the marketplace
         returned something for it. If anything a fuzzy-matched pool is
         worse than an empty one: an empty result at least shows as
         "Ask only" and invites a second look, while 100 mixed records
         produce a confident median for a card nobody scanned.

         detectListingYear() is already strict enough to carry this on
         its own -- 3+ listings carrying a year, NOT ONE supporting the
         year claimed, and 70% agreeing on a single different year. If
         that fires, the year is wrong regardless of what the wrong
         query happened to match. So the retry now runs whenever the
         listings disagree, and the result is still only ADOPTED if the
         corrected query returns real sales.

         Cost is one extra API call per detected mismatch. Today's
         usage is 1,122 records against a 50,000/day allowance -- 2%.
         This is not the thing to economise on. */
      let yearCorrection = null;
      const yearHint = detectListingYear(ai, market.listings);
      if (yearHint) {
        const retryQuery = swapYearInQuery(searchQuery, yearHint.claimedYear, yearHint.listingYear);
        yearCorrection = {
          claimedYear:  yearHint.claimedYear,
          listingYear:  yearHint.listingYear,
          agreeing:     yearHint.agreeing,
          total:        yearHint.total,
          retried:      false,
          adopted:      false,
          retryQuery:   retryQuery || null,
          note:         ""
        };
        if (retryQuery && retryQuery !== searchQuery) {
          const retrySold = await getSoldComps(retryQuery, market.avgPrice);
          yearCorrection.retried = true;
          if (retrySold && retrySold.soldCount > 0) {
            /* Adopted for the SOLD figure only. The identification the
               model returned is left exactly as it read it — this
               changes which sales were counted, not what the card is
               claimed to be. */
            sold      = retrySold;
            soldQuery = retryQuery;
            yearCorrection.adopted = true;
            yearCorrection.note =
              "No sales found for " + yearHint.claimedYear + ". " +
              yearHint.agreeing + " of " + yearHint.total + " listings say " +
              yearHint.listingYear + ", and that year has real sold comps — " +
              "the sold price shown is from " + yearHint.listingYear + ".";
          } else {
            yearCorrection.note =
              yearHint.agreeing + " of " + yearHint.total + " listings say " +
              yearHint.listingYear + ", not " + yearHint.claimedYear +
              ", but neither year found sold comps. Check the year before pricing.";
          }
        } else {
          yearCorrection.note =
            yearHint.agreeing + " of " + yearHint.total + " listings say " +
            yearHint.listingYear + ", not " + yearHint.claimedYear +
            ". The year wasn't in the search terms, so it couldn't be retried.";
        }
      } else if (false) {
        /* Unreachable since the gate above widened -- every detected
           mismatch is now retried. Left in place rather than deleted so
           the shape of the branch survives if the gate ever narrows
           again; deleting it would lose the reasoning with it. */
        yearCorrection = {
          claimedYear: yearHint.claimedYear,
          listingYear: yearHint.listingYear,
          agreeing:    yearHint.agreeing,
          total:       yearHint.total,
          retried:     false,
          adopted:     false,
          retryQuery:  null,
          note:        yearHint.agreeing + " of " + yearHint.total + " listings say " +
                       yearHint.listingYear + ", not " + yearHint.claimedYear +
                       ", but sold comps were found as read — price left as is."
        };
      }

      /* ASK-ONLY SANITY CEILING.

         When no sold comps exist, the headline falls back to the median
         of ACTIVE listings — and an active listing can be anything a
         seller types. The $19,000 Ohtani came through here: zero sold
         records, and the ask median landed on a sealed case or a lot
         sitting in the same keyword results.

         A sold median is disciplined by completed transactions; an ask
         median has no such floor, so it is the one number in this
         response that can be wrong by four orders of magnitude. When
         asks are the only evidence AND they disagree wildly with each
         other, that is not a price — it is a search that matched
         several different things.

         Flags, does not suppress: the number still shows with its
         existing "Ask only" badge, and the person decides. It just
         stops arriving as a confident figure with nothing said about
         it. Uses market.raw (low/high across the listings) which is
         already computed. */
      if ((!sold || !sold.soldCount) && market && market.raw) {
        const lo = Number(market.raw.low), hi = Number(market.raw.high);
        if (isFinite(lo) && isFinite(hi) && lo > 0 && hi / lo >= 20) {
          market.priceNote = "No completed sales found, and the asking prices for this " +
            "search range from $" + lo + " to $" + hi + " — that spread means the search " +
            "is matching different things, not one card. Treat this number as unverified.";
          market.askOutlier = true;
        }
      }

      /* WHEN AN EXACT QUERY FINDS NOTHING, ASK A BROADER ONE.

         Found the moment flatbed scanning started working. Better
         identification produced WORSE prices, which reads like a
         contradiction until you see the two queries side by side:

           "Topps Chrome Willy Adames"            -> 100 sold records
           "2022 Topps Chrome Willy Adames #140"  ->   0 sold records

         Same card, same scan session. The precise read is correct and
         the loose one is vague, and the vague one is the only one that
         finds any sales -- because plenty of sellers do not put the year
         or the card number in a title. Seven cards in one flatbed batch
         came back "Ask only" for exactly this reason while their looser
         equivalents had a hundred sales each.

         So identifying the card better must not cost the shop its
         price. If the exact query returns nothing, drop the narrowing
         terms a step at a time -- card number first, then set and
         parallel -- and take the first level that finds real sales.

         Ordering matters and is not arbitrary. The card number is the
         term most often missing from a seller's title, so it goes
         first; year and player are the terms almost always present, so
         they are never dropped. A query that has lost the year would be
         pricing a different card, which is the failure this whole
         weekend was spent removing.

         Reported, never silent: soldBroadened carries the query that
         actually produced the number, so nothing downstream has to
         guess how wide a net it came from. Costs at most three extra
         calls -- one per remaining tier -- and only on cards that would
         otherwise show no price at all. It stops at the first tier that
         produces a usable number, so the common case is one. */
      let soldBroadened = null;
      if ((!sold || !sold.soldCount) && !yearCorrection) {
        const tiers   = buildQueryTiers(ai) || [];
        const already = new Set([searchQuery]);
        for (let i = 0; i < tiers.length; i++) {
          const q = tiers[i].query;
          if (!q || already.has(q)) continue;
          already.add(q);
          const broader = await getSoldComps(q, market.avgPrice);
          /* A broader query only counts as an answer if it produced a
             number worth showing. soldCount is the raw record count --
             fourteen sales of six different products still reads as
             fourteen. What matters is whether anything survived the
             base filter, which is what soldLimited reports.

             Without this, a broadened query that came back entirely
             contaminated would end the search: the retry would stop at
             the first level with ANY records, adopt a pool that prices
             nothing, and never try the narrower tier that might have
             worked. Judging on the usable result rather than the raw
             count keeps looking. */
          const usable = broader && broader.soldCount > 0
                         && !broader.soldLimited
                         /* soldContaminated has to be here too, and its
                            absence was a real hole. A LIMITED pool comes
                            back with a median of 0, so the median check
                            below happened to catch it. A CONTAMINATED
                            pool does not -- it keeps its median and just
                            flags that the sales describe more than one
                            version of the card. So a broadened query
                            that swept in three different parallels would
                            have passed this gate, been adopted, and
                            published a median the server had already
                            said not to trust.

                            Broadening is exactly the operation most
                            likely to produce contamination, since every
                            step widens what can match. Refusing a
                            contaminated pool here is what keeps the
                            retry from defeating the filter it depends
                            on. */
                         && !broader.soldContaminated
                         && Number(broader.soldMedian) > 0;
          if (usable) {
            sold      = broader;
            soldQuery = q;
            soldBroadened = {
              from: searchQuery,
              to:   q,
              tier: tiers[i].tier,
              found: broader.soldCount,
              note: "No sales matched the exact card details, so the sold price " +
                    "shown is from a broader search (" + q + "). It may include " +
                    "other versions of this card."
            };
            break;
          }
        }
      }

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
        /* WHICH QUERY THE PRICE ACTUALLY CAME FROM.

           The line already printed q=<the exact query> and then a sold
           figure that might have come from a completely different,
           broader search. Reading it back, there was no way to tell --
           and an afternoon went into inferring the answer from cache
           rows when one field here would have said it outright.

           soldLimited is printed for the same reason: a card that found
           records but had them all filtered out looks identical to a
           priced card unless the log says otherwise. */
        (soldBroadened
          ? " | BROADENED " + soldBroadened.tier + " -> \"" + soldBroadened.to + "\" (" + soldBroadened.found + " sales)"
          : "") +
        (sold && sold.soldLimited ? " | LIMITED (too few clean base sales)" : "") +
        (sold && sold.soldContaminated ? " | CONTAMINATED" : "") +
        (yearCorrection ? " | YEAR? " + yearCorrection.claimedYear + "->" + yearCorrection.listingYear +
           (yearCorrection.adopted ? " (adopted)" : yearCorrection.retried ? " (retried, no sales)" : " (not retried)") : "") +
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
        /* THE BACKEND DECIDES THIS, NOT THE MODEL.

           This was ai.parallelCertain !== false, which makes anything
           other than an explicit false read as certain -- including a
           field the model omitted entirely. An optimistic default on
           the one attribute that moves price by 10x to 100x.

           The prompt already asks for parallelEvidence: 'serial' when a
           serial number identifies the parallel, 'printed' when the name
           is printed on the card, 'color' when it is going on sheen
           alone, 'uncertain' when it is a general impression. Colour and
           impression are exactly where Optic and Chrome base cards get
           read as parallels, so neither earns certainty no matter what
           the model claims alongside it.

           Certain now requires three things at once: the model said so,
           the evidence is something readable rather than inferred, and
           it did not simultaneously list alternatives it could not rule
           out. A base card with no parallel at all stays certain, since
           there is nothing to be uncertain about. */
        /* A voucher, not a card. Carried through so the front end can
           refuse to price it and warn about the code rather than
           publishing a number for a slip of cardboard. */
        isRedemption:      ai.isRedemption === true,
        /* What the code on the back says, when the model could read it.
           Null rather than an empty object when there is nothing to
           report, so the frontend can tell "unread" from "read and
           unknown" — those need different prompts to the user. */
        /* Already resolved above so the query could use it -- passed
           straight through rather than looked up a second time. */
        printCode:         ai.printCode,
        parallelCertain:   (function(){
          var claimed  = ai.parallelCertain === true;
          var hasPar   = !!String(ai.parallel || "").trim();
          var opts     = Array.isArray(ai.parallelOptions) ? ai.parallelOptions.length : 0;
          var evidence = String(ai.parallelEvidence || "").toLowerCase();
          if (!hasPar) return claimed;
          if (opts > 0) return false;
          return claimed && (evidence === "serial" || evidence === "printed");
        })(),
        parallelConfidence: (function(){
          var hasPar   = !!String(ai.parallel || "").trim();
          var opts     = Array.isArray(ai.parallelOptions) ? ai.parallelOptions.length : 0;
          var evidence = String(ai.parallelEvidence || "").toLowerCase();
          if (!hasPar) return "n/a";
          if (evidence === "serial" || evidence === "printed") return opts > 0 ? "MEDIUM" : "HIGH";
          if (evidence === "color") return "LOW";
          return "LOW";
        })(),
        serialNumber:      ai.serialNumber  || "",
        isRookie:          !!ai.isRookie,
        isAutograph:       !!ai.isAutograph,
        isPatch:           !!ai.isPatch,
        usedBack:          !!back,
        searchQuery:       searchQuery,
        /* The query the SOLD figure actually came from. Equals
           searchQuery unless a year correction was adopted — see
           yearCorrection below. Separate field so nothing has to
           infer which search produced which number. */
        soldQuery:         soldQuery,
        /* A SERIAL READ OFF THE CARD AND THEN DROPPED BEFORE THE PRICE.
           THIS IS THE $2 BUG.

           serialDenominator() correctly turns "03/20" into "/20" and
           puts it in the TIGHT query. When that query finds nothing --
           and eBay frequently will not match "/20" -- the broadening
           chain falls back to set-noNum, core or loose, none of which
           carry the serial. The card then prices against base copies.

           The comment above the tier builder claims a misread serial
           "costs one empty query rather than a wrong price." That is
           wrong, and this is the proof: a real user saved a 2025 Topps
           Finest Bo Nix 03/20 on 23 August and CardGauge valued it at
           $2. A numbered /20 rookie is not a $2 card. They put 25
           high-end cards in that day and never came back.

           It is the same shape as an unverified parallel being dropped
           and the same shape as the auto bug in August: a field the
           model read CORRECTLY, removed before the search, and the
           fallback silently prices a different card. Nothing downstream
           catches it, because the comps really are clean -- they are
           just the wrong card's comps.

           So say it. The flag is true only when a serial was actually
           read AND the query that produced the price does not contain
           it -- never on a guess, never on a card with no serial. */
        serialDropped:     !!(serialDenominator(ai)
                              && String(soldQuery || "").indexOf(serialDenominator(ai)) < 0
                              && String(searchQuery || "").indexOf(serialDenominator(ai)) >= 0),
        serialRead:        serialDenominator(ai) || "",
        yearCorrection:    yearCorrection,
        soldBroadened:     soldBroadened,
        sold:              sold || null,
        askVsSold:         askVsSold(market, sold),
        matchQuality:      market.matchQuality || "exact",
        tierUsed:          market.tierUsed     || "",
        priceNote:         market.priceNote    || "",
        spreadNote:        market.spreadNote   || "",
        askOutlier:        !!market.askOutlier,
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
        /* Built from soldQuery, not searchQuery: when a year
           correction was adopted, a "see the comps" link built from
           the original query would show the shop an empty eBay page
           for the sold number it is being asked to trust. */
        soldCompsUrl:      ebayUrl(soldQuery, true),
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

  /* A PASTED TOKEN CAN CARRY WHITESPACE, AND IT GOES STRAIGHT INTO THE
     HEADER. Copying from a web page into Render's environment field
     routinely picks up a trailing newline or space. The value looks
     correct in the dashboard and produces a malformed Authorization
     header that no amount of regenerating fixes. Costs nothing to rule
     out. */
  const token = String(PSA_API_TOKEN).trim();

  try {
    const r = await fetch(PSA_API_BASE + "/cert/GetByCertNumber/" + clean, {
      /* THE REQUEST WAS TECHNICALLY CORRECT AND STILL REFUSED.

         PSA's own documentation says a 4xx means the request path is
         wrong -- and it is not: a freshly generated token, a valid cert
         number and the documented URL all returned 403, repeatedly,
         from Render.

         What the old request did NOT send is everything a normal client
         sends. node-fetch identifies itself as "node-fetch/1.0" and
         supplies no Accept header at all. Coming from a datacenter IP,
         that is the exact signature a WAF drops before the application
         ever sees it -- which is consistent with a 403 that ignores the
         credentials entirely.

         PSA's own examples are jQuery and curl, both of which send an
         ordinary client identity. This makes the request look like the
         examples they document. If it still 403s, the block is on the
         IP or the account and no header will move it. */
      headers: {
        Authorization: "bearer " + token,
        "Accept":       "application/json",
        "Content-Type": "application/json",
        "User-Agent":   "CardGauge/1.0 (+https://www.cardgauge.com)"
      }
    });
    if (!r.ok) {
      /* The body usually says WHY. A WAF block reads as an HTML
         challenge page; an application-level refusal reads as JSON with
         a message. Those need completely different responses and the
         old log could not tell them apart. */
      let detail = "";
      try { detail = (await r.text()).slice(0, 300).replace(/\s+/g, " "); } catch (e) {}
      console.log("[psa] HTTP " + r.status + " for cert " + clean +
                  (detail ? " | body: " + detail : " | (empty body)"));

      /* SAY WHAT HAPPENED IN WORDS SOMEBODY CAN ACT ON.

         "PSA API returned 403" told the person nothing and told us
         nothing either -- it took a body log to discover PSA's actual
         answer: {"Message":"Access to this API is limited to approved
         customers."} The account is not approved for API use. A token
         generates for anyone signed in; using it needs permission we do
         not have, which is why this has never worked since the day it
         shipped.

         Nothing here can fix that. What this CAN do is stop the app
         looking broken over somebody else's permission setting, and
         point at the path that still works -- the cert number and grade
         are printed on the label, so typing the card in loses very
         little. */
      if (r.status === 403 || /approved customers/i.test(detail)) {
        return { ok: false, unavailable: true,
                 reason: "PSA lookup isn't available right now. The grade and card details "
                       + "are printed on the label \u2014 type the card in and it'll price "
                       + "the same way." };
      }
      if (r.status === 429) {
        return { ok: false, unavailable: true,
                 reason: "PSA is rate-limiting lookups right now. Try again shortly, or type "
                       + "the card in from the label." };
      }
      if (r.status >= 500) {
        return { ok: false, unavailable: true,
                 reason: "PSA's server isn't responding. Type the card in from the label "
                       + "and it'll price the same way." };
      }
      return { ok: false, reason: "PSA couldn't look that cert up (" + r.status + ")." };
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
    /* unavailable distinguishes "PSA is not answering us" from "that
       cert does not exist". The first is our problem and should not
       look like the person typed something wrong. */
    return res.json({ success: false, error: psa.reason, unavailable: !!psa.unavailable });
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
/* v6 -> v7 (2026-09-01). The Catalog add-on was cancelled for several
   days and then renewed. Every lookup made while it was off returned
   nothing and was cached as found:false -- a recorded failure that would
   succeed now. Those rows are the reason the instruments page showed 16
   of 18 sets unmatched; the real hit rate on answers cached while the
   add-on WAS active is 12 of 17.

   Bumping the version discards the whole cache rather than trying to
   distinguish a genuine miss from an outage, which is not something the
   stored row can tell us. Same reasoning as the sold-comps bump. */
/* v7 -> v8 (2026-09-02). Two reasons at once.

   The cache key was colliding (see /api/set-lookup) so some misses
   were recorded against a query that was never actually asked. And
   thecardapi renamed set identifiers from UC- to US- during this
   window -- every set cached before the rename carries an id in the
   old scheme, and anything looked up mid-transition may have been
   recorded as a miss for a set that exists. Neither is something a
   stored row can tell us apart, so the whole cache goes. */
const CATALOG_LOGIC_VERSION = 8;
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
  /* THE SEPARATOR WAS BEING ERASED BY THE FUNCTION IT WAS PASSED TO.

     This used to be normaliseSetQuery(raw + " :" + sport). That
     function strips every non-alphanumeric character, so " :Basketball"
     became " basketball" -- and a lookup for "Collector's Choice" with
     sport=Basketball produced the IDENTICAL key to one for
     "Collector's Choice Basketball" with the same sport.

     Found 2026-09-02: a miss cached under the second phrasing was
     served back for the first, so a retry with the sport word removed
     could never reach the catalog to test whether that was the
     problem. Any set whose name ends in a sport word collides with
     itself the same way.

     Normalising the two halves separately and joining with a character
     that survives keeps them distinct. */
  const q     = normaliseSetQuery(raw) + (sport ? "@" + normaliseSetQuery(sport) : "");
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

    /* THE SPORT IS A FILTER. IT DOES NOT ALSO BELONG IN THE TEXT.

       "1997 Upper Deck Collector's Choice Basketball" was sent as the
       search text WITH sport=Basketball alongside it. The catalog files
       the set without the sport in its name, so the extra token could
       only narrow the match to nothing -- the same failure shape as the
       CMP116854 SKU that killed sold-comp coverage.

       Only stripped when the sport is actually being passed as a
       filter, since then the word is provably redundant. A query with
       no sport filter keeps every word it was given. */
    let qText = catalogSetQuery(raw);
    if (sport) {
      const sportWord = String(sport).trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      qText = qText.replace(new RegExp("\\b" + sportWord + "\\b\\s*$", "i"), "").trim() || qText;
    }

    const params = new URLSearchParams({ q: qText, limit: String(CATALOG_PAGE_SIZE) });
    if (wantYear) params.set("year", String(wantYear));
    if (sport)    params.set("sport", catalogSport(sport));

    const { body, remaining } = await catalogFetch("/sets?" + params.toString());
    const rows = Array.isArray(body && body.data) ? body.data : [];

    let sets = rows.map(r => ({
      /* usid FIRST. Their set responses now return "usid" (US-...);
         "ucid" was the older field name and set_ucid an older one still.
         Reading only the old names mapped every set row to null, the
         filter below dropped them all, and the query cached as
         found:false -- a set that exists recorded permanently as one
         that does not. All three are accepted so this works either
         side of their rename. */
      ucid:        r.usid || r.ucid || r.set_ucid || null,
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

/* ── THE CMP CODE ON THE BACK TELLS YOU IF IT'S A SHORT PRINT ────

   Topps prints a production code in the fine print at the bottom of
   the back, next to the topps.com URL: CODE#CMP037284. The last three
   digits identify which version of the card you are holding -- base,
   SP, SSP, or a numbered subset.

   This matters more than almost anything else the scanner reads. An
   image variation SP looks identical to the base card from the front;
   the photo is different but you have to know the base photo to spot
   it. Price one as the other and you are wrong by a large multiple, in
   whichever direction.

   THERE IS NO ALGORITHM. The codes are per-product and arbitrary: 543
   is base in 2022 Series 1, 539 is base in 2026 Chrome, 565 is base in
   2023 Series 1. A code means nothing without that product's table, so
   an unknown product must return "I don't know" rather than a guess --
   telling somebody they hold an SP when they don't is the same class
   of error as pricing an autograph off base comps.

   EVERY ENTRY BELOW IS SOURCED, and the source is named. Nothing goes
   in this table from memory or inference. A wrong row here is worse
   than a missing one, because a missing row says so and a wrong row
   sounds authoritative.

   The search query never carries this code. stripQueryJunk() removes
   it deliberately -- a Brock Bowers listing carrying CMP116854 returned
   0 sold comps and 51 without it, because sellers do not type it. Read
   it, report it, keep it out of the query. */
const PRINT_CODES = {
  // Cardlines, "Guide to 2022 Topps Series 1 Variations"
  "2022|topps series 1": { "543": "Base", "560": "SP Variation",
                           "561": "SSP Variation", "562": "SSSP (Ultra Short Print)" },
  // Cardboard Connection, 2022 Topps Series 1 / 2023 Topps Series 1 guides
  "2023|topps series 1": { "565": "Base", "585": "SSP Variation",
                           "587": "Advanced Stats (/300)" },
  // Beckett, otia.com and Sports Card Portal all give the same three
  // for 2026 Chrome -- the best-corroborated entry in this table.
  "2026|topps chrome":   { "539": "Base Refractor", "752": "Image Variation SP",
                           "156": "Super Short Print Image Variation" },
  /* ChecklistInsider, 2025 Topps Chrome: Image Variations carry
     #CMP104560. No base code found in any guide, which is why only the
     variation is listed -- a table that guesses a base code would
     report every base card as "unlisted" and look broken.

     NOTE THE COLLISION, IT IS REAL AND NOT A MISTAKE: 560 is also the
     SP Variation code in 2022 Topps Series 1. Two unrelated products,
     same three digits. That is the whole reason this table is keyed by
     product rather than by code -- a bare "560" means nothing without
     knowing which set it came off. */
  "2025|topps chrome":   { "560": "Image Variation SP" },
  // ChecklistInsider, 2025 Topps Chrome Update Series: #CMP115697.
  "2025|topps chrome update": { "697": "Image Variation SP" },
  /* The best-sourced entry here. Beckett's variations guide and an
     SI.com piece both state it outright: "if the number ends in 715,
     this is just a base card... a card ending in 853, you have one of
     the 25 players that have a variation."

     Kept separate from 2024 Topps Chrome (the flagship), which is a
     DIFFERENT product with different codes. Conflating the two is an
     easy mistake -- one AI-written guide gave these same 715/853
     figures for 2024-25 Chrome BASKETBALL, which is a third product
     again and almost certainly wrong. */
  "2024|topps chrome update": { "715": "Base / Refractor", "853": "Image Variation SP" }
};

/* The key has to survive how differently the same product gets named.
   "2022 Topps Series One", "Topps Series 1", "Series 1" all mean the
   same shelf. Deliberately narrow: if it does not reduce to something
   in the table, the answer is "unknown product", which is correct. */
function printCodeKey(year, brand, setName) {
  var y = String(year || "").trim();
  if (!/^(19|20)\d{2}$/.test(y)) return null;
  var t = (String(brand || "") + " " + String(setName || "")).toLowerCase()
    .replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
  t = t.replace(/\bseries one\b/g, "series 1").replace(/\bseries two\b/g, "series 2");
  /* Update BEFORE plain Chrome. "2025 Topps Chrome Update Series"
     contains "chrome", so testing chrome first would swallow it and
     report Update cards against the wrong product's codes -- which,
     given 560 and 697 are different variations, would be a confidently
     wrong short-print call. */
  if (/\btopps\b/.test(t) && /\bchrome\b/.test(t) && /\bupdate\b/.test(t))
    return y + "|topps chrome update";
  if (/\btopps\b/.test(t) && /\bchrome\b/.test(t))    return y + "|topps chrome";
  if (/\btopps\b/.test(t) && /\bseries 1\b/.test(t))  return y + "|topps series 1";
  if (/\btopps\b/.test(t) && /\bupdate\b/.test(t))    return y + "|topps update";
  return null;
}

/* Returns what the code means, or says plainly that it cannot tell.
   Three shapes of answer and they are kept distinct on purpose:
   a known product and a known code, a known product and an unlisted
   code, and a product not in the table at all. */
function lookupPrintCode(rawCode, year, brand, setName) {
  var digits = String(rawCode || "").replace(/[^0-9]/g, "");
  if (digits.length < 3) return null;
  var last3 = digits.slice(-3);

  var key = printCodeKey(year, brand, setName);
  var out = { code: last3, fullCode: String(rawCode || "").trim(),
              known: false, label: null, note: "" };

  if (!key || !PRINT_CODES[key]) {
    out.note = "We don't have the code list for this product yet, so this "
             + "doesn't tell us whether it's a short print.";
    return out;
  }

  var table = PRINT_CODES[key];
  if (table[last3]) {
    out.known = true;
    out.label = table[last3];
    out.isBase = /^base/i.test(table[last3]);
    out.note = out.isBase
      ? "Code " + last3 + " is the base card for this product."
      : "Code " + last3 + " means this is a " + table[last3] + " \u2014 not the base card. "
        + "Short prints trade well above base, so check the price is for the right version.";
    return out;
  }

  out.note = "Code " + last3 + " isn't in our list for this product. It may be a "
           + "subset or parallel we haven't catalogued.";
  return out;
}

/* GET /api/print-code?code=284&year=2022&brand=Topps&set=Series 1
   For when the camera couldn't read the fine print and somebody types
   the last three digits off the card themselves. Glare on a Chrome
   back lands exactly on this text, so a manual path is not a fallback
   here, it is the common case. */
app.get("/api/print-code", (req, res) => {
  const r = lookupPrintCode(req.query.code, req.query.year, req.query.brand, req.query.set);
  if (!r) return res.json({ success: false, error: "Give us at least three digits." });
  res.json(Object.assign({ success: true }, r));
});

/* THE CODE WAS BEING DISPLAYED AND THEN IGNORED.

   lookupPrintCode() resolves "this is an Image Variation SP" and the
   scanner prints it. The query never saw it -- so a card confirmed as
   an SSP was still priced against base comps, which is the exact
   failure the feature exists to prevent.

   It is the same bug isAutograph had in August: a field read correctly
   off the card, reported to the user, and then dropped before the
   search. A four-figure auto priced off a $70 base card, because the
   query never carried the word "auto".

   VARIATIONS ARE WORSE THAN AUTOS ON THIS, not better. An image
   variation is visually identical to the base card from the front, so
   nothing downstream can catch the mistake -- there is no spread
   warning, no contamination check, no ladder gap. The pool looks clean
   because it IS clean; it is just the wrong card's pool.

   ONLY A CONFIRMED CODE FROM A KNOWN PRODUCT EARNS A TERM. An unknown
   product, an unlisted code, or a base-card code all return nothing.
   A guess here prices a common as a short print, which is wrong by a
   multiple in the direction that flatters. */
function variationSearchTerm(pc) {
  if (!pc || !pc.known || !pc.label) return "";
  if (pc.isBase) return "";            // base is the default; adding it narrows for nothing

  /* Sellers do not write "Image Variation SP" in a title. They write
     "Image Variation", "SP", "SSP", or "Variation". Mapped to the
     words that actually appear on eBay rather than to our own label. */
  var L = String(pc.label).toLowerCase();
  if (L.indexOf("super short print") > -1 || /\bsssp\b/.test(L)) return "SSP Variation";
  if (/\bssp\b/.test(L))                                          return "SSP Variation";
  if (L.indexOf("image variation") > -1)                          return "Image Variation";
  if (L.indexOf("advanced stats") > -1)                           return "Advanced Stats";
  if (L.indexOf("variation") > -1 || /\bsp\b/.test(L))            return "Variation";
  return "";
}

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
    /* Set when the catalog found the same product under a different
       year. The caller can re-price against it. */
    yearCorrected: null,
    candidates: []
  };

  if (!CARDAPI_KEY) {
    out.note = "No card-catalog key is configured on the server.";
    return out;
  }

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
    /* THE COMMENT HERE USED TO SAY THIS SHARED THE SET-SIZE CACHE.
       IT DID NOT.

       It claimed that any set somebody had already looked up cost
       nothing here. The code underneath called catalogFetch directly
       and never touched catalog_set_queries -- not to read it, not to
       write it. So every scan paid 5 records for a set lookup that
       /api/set-lookup had already answered and stored, 3 more for the
       card, and up to 25 more again when the year scan ran. Around 33
       records per scan against a 500/day catalog allowance: roughly
       fifteen scans to exhaust the day.

       That is what emptied the allowance on 1 September, with the v7
       cache wipe removing the one thing that would have softened it.

       The cache is now genuinely read and genuinely written, against
       the same table and the same key shape /api/set-lookup uses, so
       the two share entries in both directions. */
    const setQuery = [year || "", brand, setNm].filter(Boolean).join(" ").trim();
    if (!setQuery) {
      /* Was a bare return, which surfaced as "not checked" with no
         reason at all -- indistinguishable from a catalog failure. */
      out.note = "Not enough of the set was read to look it up.";
      return out;
    }

    /* Same key shape as /api/set-lookup. Sport is part of it because
       "1986 Topps" is 792 cards in baseball and 396 in football, and
       one cached answer for both would hand a football collector a
       target they can never reach. */
    const sportRaw = String(ai.sport || "").trim();
    /* Same separator bug as /api/set-lookup -- see the note there. The
       two halves are normalised apart so the sport cannot merge into
       the set name. Both sides must build the key identically or they
       stop sharing entries, which is the whole point of the cache. */
    const cacheQ   = normaliseSetQuery(setQuery) + (sportRaw ? "@" + normaliseSetQuery(sportRaw) : "");
    const cacheOk  = !!supabaseAdmin && cacheQ.length >= 3;

    /* Write-through, used from two places below: once when the set was
       found, once when it was not. Both record the FINAL answer -- see
       the note at the miss branch for why that matters. */
    const cacheSetAnswer = async function (best) {
      if (!cacheOk) return;
      try {
        const bestUcid = best ? (best.usid || best.ucid || best.set_ucid || null) : null;
        if (best && bestUcid) {
          await supabaseAdmin.from("catalog_sets").upsert([{
            ucid:        bestUcid,
            set_name:    best.set_name || best.name || "",
            year:        best.year != null ? Number(best.year) : null,
            sport:       best.sport || null,
            card_count:  Number(best.card_count || best.total_cards || best.cards || 0) || null,
            parent_name: best.parent_set_name || best.parent_name || null,
            slug:        best.slug || null,
            fetched_at:  new Date().toISOString()
          }], { onConflict: "ucid" });
        }
        await supabaseAdmin.from("catalog_set_queries").upsert({
          q:             cacheQ,
          ucid:          bestUcid,
          found:         !!bestUcid,
          logic_version: CATALOG_LOGIC_VERSION,
          fetched_at:    new Date().toISOString()
        }, { onConflict: "q" });
      } catch (e) {
        console.warn("[verify] cache write failed:", e.message);
      }
    };

    /* null = nobody has answered yet. [] = answered, and the answer
       was nothing. The difference decides whether the year scan below
       is worth 25 records. */
    let sets      = null;
    let fromCache = false;

    if (cacheOk) {
      try {
        const hit = await supabaseAdmin
          .from("catalog_set_queries")
          .select("ucid,found,logic_version")
          .eq("q", cacheQ)
          .maybeSingle();

        /* An answer produced by logic we have since decided was wrong
           is not trusted -- the same rule /api/set-lookup applies, and
           the reason CATALOG_LOGIC_VERSION exists. */
        if (hit.data && Number(hit.data.logic_version || 0) >= CATALOG_LOGIC_VERSION) {
          if (!hit.data.found) {
            fromCache = true;
            sets = [];
          } else if (hit.data.ucid) {
            const row = await supabaseAdmin
              .from("catalog_sets")
              .select("ucid,set_name,year,sport,card_count,parent_name")
              .eq("ucid", hit.data.ucid)
              .maybeSingle();
            if (row.data) {
              fromCache = true;
              sets = [row.data];
              /* THE YEAR CORRECTION HAS TO SURVIVE A CACHE HIT.

                 If the stored set sits under a different year than the
                 model read, that IS the correction -- it is the reason
                 this query was recorded as found rather than missed.
                 Losing it on the second scan of the same card would
                 make the fix look intermittent. */
              if (year && row.data.year && Number(row.data.year) !== year) {
                out.yearCorrected = { from: year, to: Number(row.data.year), sets: 1 };
              }
            }
          }
        }
      } catch (e) {
        /* A cache that is down is a slower scan, not a broken one. */
        console.warn("[verify] cache read failed:", e.message);
      }
    }

    if (sets === null) {
      const params = new URLSearchParams({ q: setQuery, limit: String(VERIFY_MAX_CANDIDATES) });
      if (year)      params.set("year", String(year));
      if (ai.sport)  params.set("sport", catalogSport(ai.sport));

      const setRes = await catalogFetch("/sets?" + params.toString());
      sets = Array.isArray(setRes.body && setRes.body.data) ? setRes.body.data : [];
    }

    /* THE SET ISN'T THERE. ASK WHETHER THE YEAR IS WRONG.

       This used to give up here, and giving up was expensive. A real
       scan read a Nick Kurtz as "2020 Topps Tier One" -- Kurtz was
       drafted in 2024, so no such card was ever printed. Every query
       returned nothing, the broadening chain found nothing, and the
       card ended with no price at all.

       The listing-based year correction cannot help in that case. It
       needs three or more active listings that agree on a different
       year, and a card that does not exist has no listings to agree.

       The catalog does not need listings. It knows what was printed. So
       when the set cannot be found for the claimed year, ask the
       catalog for the same brand and set WITHOUT a year and see what
       years it actually comes back with. One year, or one clearly
       dominant year, is the answer.

       Deliberately narrow. It only runs when the first lookup found
       nothing at all, it requires a card number to have been read, and
       it only adopts a year when the catalog is unambiguous. A guess
       here would price a different card, which is the failure this
       whole system exists to avoid. */
    /* !fromCache MATTERS AND IS NOT DEFENSIVE PADDING.

       A cached miss is written AFTER this branch has run, so a stored
       found:false means the direct lookup and the year scan both came
       back empty. Re-running the scan on it would spend 25 records to
       learn the same nothing, on every scan of every card in a set the
       catalog does not carry -- which is the most expensive shape this
       function has. */
    let yearFixed = null;
    if (!sets.length && !fromCache && (brand || setNm)) {
      try {
        /* A MUCH WIDER SAMPLE THAN THE VERIFY LOOKUP, ON PURPOSE.

           VERIFY_MAX_CANDIDATES is 5, which is right for "does this
           card number exist in this set" -- but wrong here. This query
           asks the catalog for every year a product ran, and a product
           like Topps Chrome or Tier One has run for a decade. Five
           arbitrary rows out of twenty would let whichever years
           happened to come back first look like a majority, and the
           card would be "corrected" to a year on no real evidence.

           Twenty-five is enough to see the shape of a normal product's
           run. If the catalog still returns a full page, the sample is
           truncated and the distribution cannot be trusted -- see the
           unanimity requirement below. */
        const YEAR_SCAN_LIMIT = 25;
        const p2 = new URLSearchParams({
          q: [brand, setNm].filter(Boolean).join(" ").trim(),
          limit: String(YEAR_SCAN_LIMIT)
        });
        if (ai.sport) p2.set("sport", catalogSport(ai.sport));
        const anyYear = await catalogFetch("/sets?" + p2.toString());
        const cand = Array.isArray(anyYear.body && anyYear.body.data) ? anyYear.body.data : [];

        const years = {};
        cand.forEach(c => { const y = Number(c.year); if (y >= 1860 && y <= 2100) years[y] = (years[y] || 0) + 1; });
        const distinct = Object.keys(years);

        /* One year, or one that outnumbers the rest two to one. Any
           closer than that and the catalog is not actually telling us
           which card this is. */
        if (distinct.length) {
          distinct.sort((a, b) => years[b] - years[a]);
          const top = Number(distinct[0]);

          /* A full page back means there are probably more we did not
             see, so the counts are a slice rather than the picture. In
             that case only unanimity counts -- if every row we got says
             the same year, the ones we missed are unlikely to disagree.
             Otherwise the ordinary two-to-one margin applies. */
          const truncated = cand.length >= YEAR_SCAN_LIMIT;
          const clear = distinct.length === 1
                     || (!truncated && years[top] >= 2 * (years[distinct[1]] || 0));

          if (clear && top !== year) {
            sets = cand.filter(c => Number(c.year) === top);
            yearFixed = { from: year || null, to: top, sets: sets.length };
            out.yearCorrected = yearFixed;
            console.log("[verify] catalog year correction: " + (year || "?") + " -> " + top +
                        " for " + [brand, setNm].filter(Boolean).join(" "));
          }
        }
      } catch (e) { /* the original answer stands */ }
    }

    if (!sets.length) {
      /* CACHE THE MISS, and cache it HERE rather than before the year
         scan, so what gets stored is the final answer: the set was not
         found under the claimed year and the catalog could not name a
         better one. A later hit can then skip both calls without
         losing anything.

         Same reasoning /api/set-lookup already applies to its own
         misses -- without it, a set the catalog does not carry is
         re-queried on every scan of every card in it. */
      if (!fromCache) await cacheSetAnswer(null);
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
    /* usid first -- see the note in /api/set-lookup. A cached row read
       back from catalog_sets carries "ucid" because that is the column
       name, so both have to work here. */
    const setUcid = set.usid || set.ucid || set.set_ucid;
    if (!setUcid) {
      /* Also a bare return before this, which printed "not checked"
         with nothing after it. */
      out.note = "The card catalog returned a set with no id, so it couldn't be checked.";
      return out;
    }

    /* Written after the sort, not before it, so what is cached is the
       set this function actually used -- not whichever row the catalog
       happened to return first. */
    if (!fromCache) await cacheSetAnswer(set);

    /* THE CHECKLIST ALREADY HOLDS THIS ANSWER, FOR NOTHING.

       buildChecklist() stores every card of a set in catalog_cards and
       records in catalog_checklist_progress whether the list is
       finished. Where a checklist exists, "is there a #274 in this
       set" is a Supabase read rather than 3 catalog records -- and for
       Pokemon it is always free, because those checklists come from
       TCGdex and never touched the allowance in the first place.

       THE TWO DIRECTIONS ARE NOT EQUALLY SAFE, so they are not treated
       the same:

       - A local HIT is always trustworthy. The row is in the table
         because the catalog put it there.
       - A local MISS is only trustworthy when the checklist is
         COMPLETE. A half-built list is missing cards that genuinely
         exist, and answering "no" off one would tell somebody their
         correct scan was wrong -- the exact failure this function was
         written to catch, produced by the function itself.

       So an incomplete checklist falls through to the paid lookup,
       exactly as before. Matching uses sameCardNumber(), the same
       normaliser the rest of this file uses, rather than trying to
       guess which formatting the row was stored under. */
    let cards = null;

    if (supabaseAdmin) {
      try {
        const LOCAL_CAP = 2000;
        const local = await supabaseAdmin
          .from("catalog_cards")
          .select("ucid,card_number,subject")
          .eq("set_ucid", setUcid)
          .limit(LOCAL_CAP);
        const rows = (local.data || []);
        const found = rows.filter(c => sameCardNumber(c.card_number, number));

        if (found.length) {
          cards = found.slice(0, 3);
        } else if (rows.length && rows.length < LOCAL_CAP) {
          /* Nothing matched, and we know we saw the whole stored list
             rather than the first 2000 of it. Only a checklist marked
             complete makes that absence meaningful. */
          const prog = await supabaseAdmin
            .from("catalog_checklist_progress")
            .select("complete")
            .eq("set_ucid", setUcid)
            .maybeSingle();
          if (prog.data && prog.data.complete === true) cards = [];
        }
      } catch (e) {
        console.warn("[verify] checklist read failed:", e.message);
      }
    }

    if (cards === null) {
      const cardRes = await catalogFetch("/?" + new URLSearchParams({
        set_id: setUcid, card_number: number, limit: "3"
      }).toString());
      cards = Array.isArray(cardRes.body && cardRes.body.data) ? cardRes.body.data : [];

      /* Keep what was paid for. The same card scanned twice should not
         cost records twice, and these rows are the same shape
         buildChecklist writes, so a checklist built later merges with
         them rather than fighting them. */
      if (supabaseAdmin && cards.length) {
        try {
          const rows = cards.map(c => ({
            ucid:        c.ucid,
            set_ucid:    setUcid,
            card_number: c.card_number != null ? String(c.card_number) : null,
            subject:     c.subject || null,
            is_rookie:   c.is_rookie === true,
            print_run:   c.print_run != null ? Number(c.print_run) : null,
            image_url:   c.image_url_front || null,
            fetched_at:  new Date().toISOString()
          })).filter(c => c.ucid);
          if (rows.length) {
            await supabaseAdmin.from("catalog_cards").upsert(rows, { onConflict: "ucid" });
          }
        } catch (e) {
          console.warn("[verify] card cache write failed:", e.message);
        }
      }
    }

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
       it was; a second opinion we could not get is not an error.

       But SAY WHICH. The result line reads "Card catalog: not checked"
       and, with no reason attached, that looked identical whether the
       add-on had lapsed, the day's allowance was gone, or the network
       simply failed. Diagnosing it meant going to the server log for a
       message the app already had in its hand. */
    console.warn("[verify] skipped:", e.message);
    out.note = String(e && e.message || "").indexOf("plan") > -1
      ? "The card catalog isn't active on this API key."
      : (String(e && e.message || "").indexOf("allowance") > -1
          ? "The card catalog's daily allowance is used up."
          : "The card catalog didn't answer (" + (e && e.message || "unknown") + ").");
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

    /* THE WHOLE SET, TICKED -- not just what is absent.

       The missing list answers "what do I still need", which is the
       harder question and the one this was built for. It is also,
       on a set somebody has just started, a screen listing 110 things
       they do not own. That reads as a wall.

       The same data ordered the other way reads as progress: five
       ticks among a hundred is a collection begun, and the ticks are
       the reason to add a sixth. Same rows, same match, one extra
       boolean -- no additional catalog records, since this is the
       list already in hand.

       Behind ?full=1 rather than always sent: the missing list is
       capped at 500 for a reason, and a 792-card set is a much larger
       payload that only the checklist view needs. */
    const full = String(req.query.full || "") === "1";
    const checklist = full
      ? cards.slice(0, 1200).map(c => ({
          card_number: c.card_number,
          subject:     c.subject,
          is_rookie:   c.is_rookie === true,
          print_run:   c.print_run,
          have:        have.has(normCardNumber(c.card_number))
        }))
      : null;

    res.set("Cache-Control", "no-store");
    res.json({
      success:  true,
      checklist: checklist,
      checklistTruncated: !!(full && cards.length > 1200),
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

/* Cards refreshed per nightly run.

   Each card costs one thecardapi records pull (CARDAPI_LIMIT, default
   100) against the Builder tier's 50,000/day allowance. 113 cards at
   the full limit is 11,300 records -- about a quarter of the day's
   budget spent before anybody has scanned anything. Affordable, but
   the watchlist should not be the reason a shop hits a wall at 3pm.

   Oldest-checked-first plus a cap means every card gets covered over a
   couple of nights instead of the first N being covered every night.
   Raise it if the allowance grows; lower it if daytime scans start
   competing for budget. */
const REFRESH_MAX_PER_RUN = Number(process.env.REFRESH_MAX_PER_RUN || 80);

async function refreshWatchlistPrices() {
  if (!supabaseAdmin) {
    console.log("[watchlist-refresh] skipped — no Supabase client");
    return;
  }

  const startTime = Date.now();
  console.log("[watchlist-refresh] starting…");

  try {
    /* Oldest first. Combined with the per-run cap this rotates through
       the whole watchlist rather than repeatedly refreshing whichever
       rows the database happened to return first. nullsFirst so a card
       that has never been checked jumps the queue. */
    const { data: items, error } = await supabaseAdmin
      .from("watchlist_items")
      .select("id, card_name, last_checked_at")
      .order("last_checked_at", { ascending: true, nullsFirst: true })
      .limit(REFRESH_MAX_PER_RUN);

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
    let failed  = 0;
    /* Counted separately so the log distinguishes "no sold data" from
       "the write failed" -- they need different responses. */
    let skipped = 0;
    let budgetStopped = false;

    for (const item of items) {
      try {
        /* SOLD, NOT ASKING.

           THE BUG THIS REPLACES: this read `market.sold`, but
           getEbayCardMarket() returns summarizeListings() or
           EMPTY_MARKET(), and neither carries a `sold` property -- sold
           comps come from getSoldComps(), which was never called here.
           So `sold` was always {}, newPrice was always 0, and EVERY
           card took the skip branch. The nightly refresh had not
           written a price since the field was introduced, and because
           skipped cards now get stamped with last_checked_at, all 113
           rows looked freshly checked every morning.

           It was invisible downstream too: price alerts compare against
           a current_price that never moved, so nothing ever crossed the
           10% threshold, and the weekly digest summed frozen numbers.

           Why it must be sold and not asking: cards enter the binder at
           a sold price. Re-pricing them nightly against live LISTINGS
           compares two different kinds of number, and asking prices run
           above what buyers pay, unevenly. A portfolio total built that
           way drifts further from reality the longer it runs.

           A contaminated or limited pool is refused outright -- the
           pricing engine already declined to stand behind those medians
           on screen, and a value written overnight with nobody watching
           deserves the same refusal. The card keeps yesterday's price.
           A stale number is honest about being old; an asking price
           wearing a sold label is not. */
        const market = await getEbayCardMarket(item.card_name);
        const sold   = await getSoldComps(item.card_name, market.avgPrice);

        /* Allowance exhausted. Stop the run rather than grinding
           through the remaining cards collecting 429s -- they will be
           first in the queue tomorrow, since their last_checked_at is
           still the oldest. */
        if (sold && sold.rateLimited) {
          budgetStopped = true;
          console.log("[watchlist-refresh] thecardapi daily allowance reached — stopping early");
          break;
        }

        const s = sold || {};
        const contaminated = !!s.soldContaminated;

        /* LIMITED IS A REFUSAL TOO. Contaminated means the wrong
           records got in. Limited means the filtering worked and what
           survived is too thin to call a market price -- one clean base
           sale out of thirteen is not a valuation. Price history
           already refuses both; this keeps the nightly refresh
           consistent with it. */
        const limited = !!s.soldLimited;

        const soldMed = (contaminated || limited) ? 0 : safeNumber(
          (s.soldRaw && s.soldRaw.count >= 3 ? s.soldRaw.median : 0) || s.soldMedian, 0);
        const newPrice = soldMed;

        if (!newPrice) {
          if (contaminated) {
            console.log("[watchlist-refresh] skipped CONTAMINATED — " + item.card_name);
          } else if (limited) {
            console.log("[watchlist-refresh] skipped LIMITED — " + item.card_name);
          }
          skipped++;

          /* STAMP THE ROW EVEN WHEN THE PRICE IS REFUSED.

             current_price is deliberately untouched -- yesterday's
             number stands, which is the entire point of the skip. Only
             the timestamp moves, so the field answers the question it
             appears to answer: when did we last look at this card.

             It also drives the ordering above, so a skipped card goes
             to the back of the queue rather than being retried every
             night at the expense of cards that have not been seen. */
          try {
            await supabaseAdmin
              .from("watchlist_items")
              .update({ last_checked_at: new Date().toISOString() })
              .eq("id", item.id);
          } catch (e) {
            console.warn("[watchlist-refresh] could not stamp skipped card " + item.id + ":", e.message);
          }
        } else {
          const { error: updateError } = await supabaseAdmin
            .from("watchlist_items")
            .update({
              current_price:   newPrice,
              last_checked_at: new Date().toISOString()
            })
            .eq("id", item.id);

          if (updateError) {
            console.error(`[watchlist-refresh] update failed for ${item.id}:`, updateError.message);
            failed++;
          } else {
            updated++;
          }
        }
      } catch (e) {
        console.error(`[watchlist-refresh] error on card ${item.id}:`, e.message);
        failed++;
      }

      /* Paced on EVERY path, not just the success path.

         The old placement sat inside the else branch and was skipped
         entirely by the refusal path, so a run where every card was
         refused hit eBay 113 times with no gap at all -- which is
         exactly what the 81-second run was. Every card costs an eBay
         call whether or not a price gets written, so the pacing has to
         cover every card too. */
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    const elapsed = Math.round((Date.now() - startTime) / 1000);
    console.log(
      "[watchlist-refresh] done. updated=" + updated +
      " skipped=" + skipped + " (kept previous price)" +
      " failed=" + failed +
      (budgetStopped ? " STOPPED-ON-BUDGET" : "") +
      " elapsed=" + elapsed + "s"
    );
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

/* ══════════════════════════════════════════════════════════════
   PRICE ALERTS WITHOUT AN ACCOUNT

   The account was the only way to receive anything, and the account
   costs an emailed code: enter an address, leave the app, find the
   mail, copy six digits, come back. Measured over 30 days, 25 people
   started that and 6 finished. Three quarters of the intent was spent
   on the round trip, not on the decision.

   So the address is now enough on its own. One field, no code, no
   password. The card is already kept on the device by then, so this
   buys exactly one thing and says so: we tell you when it moves.

   WHAT THIS DELIBERATELY IS NOT: an account. There is no login, no
   binder, no sync to another phone. Those still need the real thing,
   and the difference is the honest reason to sign up later rather
   than a wall in front of the first useful moment.

   NO CONFIRMATION STEP, WHICH IS THE WHOLE POINT AND ALSO THE RISK.
   A double opt-in is an emailed link, which is the same round trip
   this exists to remove. Instead: every message carries a one-click
   unsubscribe on a per-row token, addresses are never displayed back
   to anyone, and the table is service-role only. If somebody typos a
   stranger's address, that stranger gets one email with a working
   unsubscribe rather than a stream of them.
══════════════════════════════════════════════════════════════ */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

app.post("/api/watch-email", async (req, res) => {
  try {
    if (!supabaseAdmin) return res.json({ success: false, error: "Not configured" });

    const email = String((req.body && req.body.email) || "").trim().toLowerCase();
    const card  = String((req.body && req.body.cardName) || "").trim().slice(0, 200);
    const query = String((req.body && req.body.query) || "").trim().slice(0, 280) || null;
    const price = safeNumber(req.body && req.body.price, 0) || null;

    if (!EMAIL_RE.test(email) || email.length > 254) {
      return res.json({ success: false, error: "That doesn't look like an email address." });
    }
    if (!card) return res.json({ success: false, error: "No card to watch." });

    /* ALREADY HAS AN ACCOUNT? SAY SO RATHER THAN BUILDING A SHADOW ONE.

       Two places holding alerts for the same person is how somebody
       ends up getting the same card twice, and unsubscribing from one
       of them. The account is the better record, so it wins. */
    let hasAccount = false;
    try {
      const { data: pro } = await supabaseAdmin
        .from("pro_users").select("id").eq("email", email).maybeSingle();
      hasAccount = !!(pro && pro.id);
    } catch (e) {}

    const { error } = await supabaseAdmin.from("email_watches").upsert({
      email:            email,
      card_name:        card,
      card_query:       query,
      price_when_added: price,
      current_price:    price,
      source:           String((req.body && req.body.source) || "scanner").slice(0, 40),
      unsubscribed:     false
    }, { onConflict: "email,card_name", ignoreDuplicates: false });

    /* The unique index is on lower(email), lower(card_name), which
       onConflict cannot name directly. A duplicate is not a failure --
       they already asked for this card -- so it is reported as success
       rather than as an error the person can do nothing about. */
    if (error && String(error.message || "").indexOf("duplicate") < 0) {
      console.log("[watch-email] insert failed:", error.message);
      return res.json({ success: false, error: "Couldn't save that just now." });
    }

    try {
      await supabaseAdmin.rpc("log_scan_event", {
        p_event: "email_watch_added", p_card_name: card,
        p_used_back: false, p_is_owner: false
      });
    } catch (e) {}

    return res.json({ success: true, hasAccount: hasAccount });
  } catch (e) {
    console.error("[watch-email] error:", e.message);
    return res.json({ success: false, error: "Couldn't save that just now." });
  }
});

/* One click, no login, no confirmation screen that asks again. The
   token identifies the address; every row for it stops. Anything less
   than that is not really an unsubscribe. */
app.get("/api/email-unsub", async (req, res) => {
  const token = String(req.query.t || "").trim();
  res.set("Content-Type", "text/html");
  if (!supabaseAdmin || !token) {
    return res.send("<p style='font-family:sans-serif;padding:40px'>Invalid link.</p>");
  }
  try {
    const { data } = await supabaseAdmin
      .from("email_watches").select("email").eq("unsub_token", token).maybeSingle();
    if (!data || !data.email) {
      return res.send("<p style='font-family:sans-serif;padding:40px'>That link has expired.</p>");
    }
    await supabaseAdmin.from("email_watches")
      .update({ unsubscribed: true }).eq("email", data.email);
    try {
      await supabaseAdmin.rpc("log_scan_event", {
        p_event: "email_watch_unsub", p_card_name: null,
        p_used_back: false, p_is_owner: false
      });
    } catch (e) {}
    res.send("<div style=\"font-family:sans-serif;padding:40px;max-width:420px;margin:0 auto\">"
      + "<h2>Unsubscribed</h2><p>You won't get any more price alerts from CardGauge. "
      + "Nothing else to do.</p></div>");
  } catch (e) {
    res.send("<p style='font-family:sans-serif;padding:40px'>Something went wrong.</p>");
  }
});

function buildWatchAlertHtml(rows, token) {
  const unsub = "https://stock-card-api.onrender.com/api/email-unsub?t=" + encodeURIComponent(token);
  const body = rows.map(function (r) {
    const up = r.pct >= 0;
    return '<tr style="border-bottom:1px solid #1e2d45;">'
      + '<td style="padding:10px 0;color:#f1f5f9;font-family:sans-serif;font-size:14px;">'
        + String(r.item.card_name || "Card") + '</td>'
      + '<td style="padding:10px 0;text-align:right;color:' + (up ? "#22c55e" : "#ef4444")
        + ';font-family:monospace;font-size:14px;font-weight:700;white-space:nowrap;">'
        + (up ? "\u25B2 " : "\u25BC ") + Math.abs(Math.round(r.pct)) + '%</td>'
      + '</tr>';
  }).join("");

  return '<div style="background:#0a0e1a;padding:32px 16px;font-family:Arial,sans-serif;">'
    + '<div style="max-width:480px;margin:0 auto;background:#111827;border:1px solid #1e2d45;border-radius:14px;padding:28px;">'
    + '<div style="font-size:20px;font-weight:800;color:#f1f5f9;margin-bottom:4px;">CARD<span style="color:#f59e0b;">GAUGE</span></div>'
    + '<p style="color:#94a3b8;font-size:13px;margin:0 0 20px;">'
      + rows.length + ' card' + (rows.length === 1 ? '' : 's') + ' you\u2019re watching moved.</p>'
    + '<table style="width:100%;border-collapse:collapse;">' + body + '</table>'
    + '<div style="margin-top:22px;padding:14px;background:rgba(34,197,94,.08);border:1px solid rgba(34,197,94,.25);border-radius:10px;">'
      + '<div style="color:#22c55e;font-weight:700;font-size:12.5px;margin-bottom:4px;">Want them in a binder?</div>'
      + '<div style="color:#94a3b8;font-size:11.5px;line-height:1.5;">Right now we just email you. '
      + 'A free account keeps your cards across phones and shows what a set is missing.</div></div>'
    + '<a href="https://www.cardgauge.com" style="display:block;margin-top:20px;background:#22c55e;color:#052e16;text-decoration:none;text-align:center;padding:13px;border-radius:10px;font-weight:800;font-size:14px;">Open CardGauge \u2192</a>'
    + '<p style="color:#64748b;font-size:11px;line-height:1.6;margin-top:20px;">'
      + 'You asked us to watch these cards. <a href="' + unsub + '" style="color:#64748b;">Unsubscribe</a></p>'
    + '</div></div>';
}

/* Same shape as runPriceAlerts, same threshold, same per-row baseline
   so a card that moved once is not reported every night afterwards.
   Runs on its own rather than inside that function because the two
   read different tables and neither should be able to break the
   other. */
const WATCH_REFRESH_MAX = Number(process.env.WATCH_REFRESH_MAX || 60);

async function runEmailWatchAlerts() {
  if (!supabaseAdmin || !SENDGRID_API_KEY) return;
  console.log("[watch-alerts] starting\u2026");

  try {
    const { data: rows, error } = await supabaseAdmin
      .from("email_watches")
      .select("id,email,card_name,card_query,price_when_added,current_price,last_alerted_price,unsub_token")
      .eq("unsubscribed", false)
      .order("last_checked_at", { ascending: true, nullsFirst: true })
      .limit(WATCH_REFRESH_MAX);

    if (error) { console.error("[watch-alerts] fetch:", error.message); return; }
    if (!rows || !rows.length) return;

    const movers = {};
    let priced = 0;

    for (const row of rows) {
      try {
        const q = row.card_query || row.card_name;
        const market = await getEbayCardMarket(q);
        const sold   = await getSoldComps(q, market.avgPrice);

        if (sold && sold.rateLimited) {
          console.log("[watch-alerts] allowance reached \u2014 stopping early");
          break;
        }

        const s = sold || {};
        /* Refuses contaminated and limited pools, exactly as the
           watchlist refresh does. An alert is a push notification
           about money; a median the engine already declined to stand
           behind must not become one. */
        const usable = !s.soldContaminated && !s.soldLimited;
        const newPrice = usable ? safeNumber(
          (s.soldRaw && s.soldRaw.count >= 3 ? s.soldRaw.median : 0) || s.soldMedian, 0) : 0;

        const patch = { last_checked_at: new Date().toISOString() };
        if (newPrice) { patch.current_price = newPrice; priced++; }
        await supabaseAdmin.from("email_watches").update(patch).eq("id", row.id);

        if (newPrice) {
          const base = safeNumber(row.last_alerted_price, 0) || safeNumber(row.price_when_added, 0);
          if (base) {
            const pct = ((newPrice - base) / base) * 100;
            if (Math.abs(pct) >= PRICE_ALERT_PCT) {
              const k = row.email;
              (movers[k] = movers[k] || []).push({ item: row, pct: pct, newPrice: newPrice });
            }
          }
        }
      } catch (e) {
        console.error("[watch-alerts] card error:", e.message);
      }
      await new Promise(r => setTimeout(r, 1000));
    }

    let sent = 0;
    for (const email of Object.keys(movers)) {
      const list = movers[email];
      const subject = list.length === 1
        ? (list[0].pct >= 0 ? "\uD83D\uDCC8 " : "\uD83D\uDCC9 ") + list[0].item.card_name
            + " moved " + Math.abs(Math.round(list[0].pct)) + "%"
        : list.length + " cards you're watching moved";

      const ok = await sendResendEmail(email, subject,
        buildWatchAlertHtml(list, list[0].item.unsub_token));

      if (ok) {
        sent++;
        for (const m of list) {
          await supabaseAdmin.from("email_watches").update({
            last_alerted_price: m.newPrice,
            last_alerted_at:    new Date().toISOString()
          }).eq("id", m.item.id);
        }
      }
    }

    console.log("[watch-alerts] done. checked=" + rows.length + " priced=" + priced + " sent=" + sent);
  } catch (e) {
    console.error("[watch-alerts] fatal:", e.message);
  }
}

/* 4:45am ET \u2014 after the watchlist refresh and the account price
   alerts, so the three never contend for the record allowance. */
cron.schedule("45 4 * * *", runEmailWatchAlerts, { timezone: "America/New_York" });
console.log("Email-only watch alerts scheduled for 4:45 AM ET");

app.get("/api/run-watch-alerts", async (req, res) => {
  if (!process.env.REFRESH_SECRET || req.query.key !== process.env.REFRESH_SECRET) {
    return res.status(403).json({ success: false, error: "Forbidden" });
  }
  res.json({ success: true, message: "Watch alerts started \u2014 check server logs" });
  runEmailWatchAlerts();
});

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
        /* THE PROMO SLOT GOES TO WHOEVER IS READING.

           This is a digest for somebody who saves cards, so the thing
           advertised in it should be the thing a card-saver would use
           next. Set completion is that: it reads their binder, matches
           on card number, and tells them what is still missing from a
           set they are already part-way through.

           The shop tools are deliberately NOT here. Multi-Scan is for
           a breaker processing hundreds of cards after a box, and
           putting a $49.99 business pitch in front of nine collectors
           spends the only email audience there is on an ask that does
           not fit the reader. That pitch belongs in the shop outreach
           list, where the audience is right. */
        '<div style="margin-top:18px;padding:14px;background:rgba(251,191,36,.08);border:1px solid rgba(251,191,36,.25);border-radius:10px;">' +
          '<div style="color:#fbbf24;font-weight:700;font-size:12.5px;margin-bottom:4px;">\ud83d\udcd2 Finish a set</div>' +
          '<div style="color:#94a3b8;font-size:11.5px;line-height:1.5;">Pick a set in your binder and we\u2019ll show you the full checklist \u2014 which cards you already have, and exactly which ones you still need.</div>' +
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
