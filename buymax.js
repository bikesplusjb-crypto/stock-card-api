'use strict';

/* =====================================================================
 * BUYMAX v0.1 — SINGLE FILE BUILD
 *
 * Identical engine to the modular buymax/ folder, bundled into one file
 * so it can be pasted straight into GitHub from a phone.
 *
 * INSTALL — add these two lines to the existing server.js:
 *
 *     const { mountBuyMax } = require('./buymax');
 *     mountBuyMax(app, { pool });        // pool optional
 *
 * Registers new routes only:
 *     POST /api/buymax
 *     POST /api/buymax/outcome
 *     GET  /api/buymax/health
 *
 * Touches no existing route, response shape, table or scanner behaviour.
 * Delete the two lines above and BuyMax is gone.
 *
 * Requires Node 18+ (global fetch) and express, both already present.
 *
 * Sold comps are primary when the CardGauge provider supplies them; eBay
 * Browse ACTIVE listings are a supply/depth signal only and never fill a
 * missing resale estimate.
 * ===================================================================== */

const __mods = {};
const __cache = {};

function __def(name, fn) { __mods[name] = fn; }

function __resolve(from, request) {
  if (!request.startsWith('.')) return null;
  const baseParts = from.split('/').slice(0, -1);
  const reqParts = request.split('/');
  const out = baseParts.slice();
  for (const p of reqParts) {
    if (p === '.' || p === '') continue;
    else if (p === '..') out.pop();
    else out.push(p);
  }
  let key = out.join('/').replace(/\.js$/, '');
  if (!__mods[key] && __mods[key + '/index']) key = key + '/index';
  return key;
}

function __require(from) {
  return function (request) {
    const key = __resolve(from, request);
    if (key === null) return require(request);       // real node_modules
    if (!__mods[key]) throw new Error('BuyMax bundle: missing module ' + key + ' (from ' + from + ')');
    if (__cache[key]) return __cache[key].exports;
    const mod = { exports: {} };
    __cache[key] = mod;
    __mods[key](mod, mod.exports, __require(key));
    return mod.exports;
  };
}

// ==================== config.js ====================
__def('config', function (module, exports, require) {

  /**
   * BUYMAX CONFIG
   *
   * Every threshold, weight and assumption the engine uses lives in this file.
   * No other module may hardcode a tunable number.
   *
   * Anything marked ASSUMPTION is not provider-supplied data. It is a modelling
   * choice and must be documented as such in any output shown to a user.
   */

  const num = (v, d) => {
    if (v === undefined || v === null || v === '') return d;
    const n = Number(v);
    return Number.isFinite(n) ? n : d;
  };
  const bool = (v, d) => (v === undefined || v === '' ? d : String(v) === 'true' || String(v) === '1');

  module.exports = {
    engine: { name: 'BuyMax', version: '0.1.0' },

    // ---------------------------------------------------------------------
    // SELLING COSTS (used when the caller does not supply their own)
    // ---------------------------------------------------------------------
    costs: {
      // ASSUMPTION: blended marketplace take rate (final value fee + payment %).
      sellFeeRate: num(process.env.BUYMAX_SELL_FEE_RATE, 0.1325),
      // ASSUMPTION: fixed per-order payment fee.
      paymentFixed: num(process.env.BUYMAX_PAYMENT_FIXED, 0.30),
      // ASSUMPTION: default outbound shipping when caller sends none.
      defaultShipping: num(process.env.BUYMAX_DEFAULT_SHIPPING, 0),
      // ASSUMPTION: default profit target as a share of expected resale.
      defaultProfitMargin: num(process.env.BUYMAX_DEFAULT_PROFIT_MARGIN, 0.30),
      // Opening offer sits this far below the maximum buy price, leaving
      // negotiating room. Purely a negotiation posture, not a valuation input.
      targetOfferBand: num(process.env.BUYMAX_TARGET_OFFER_BAND, 0.12),
    },

    // ---------------------------------------------------------------------
    // ACTIVE MARKET MODEL
    // ---------------------------------------------------------------------
    market: {
      // Listings the eBay provider is asked for.
      fetchLimit: num(process.env.BUYMAX_EBAY_LIMIT, 50),
      // Below this many accepted listings we do NOT produce a resale estimate.
      minListingsForEstimate: num(process.env.BUYMAX_MIN_LISTINGS, 5),
      // Below this many we produce nothing at all beyond raw counts.
      minListingsForStats: num(process.env.BUYMAX_MIN_LISTINGS_STATS, 3),
      // Robust outlier trim: drop points more than N median-absolute-deviations out.
      madMultiplier: num(process.env.BUYMAX_MAD_MULTIPLIER, 3),
      // Spread gate: p90/p10 above this and the market is too incoherent to model.
      maxSpreadRatio: num(process.env.BUYMAX_MAX_SPREAD_RATIO, 3.0),
      // ASSUMPTION, the single biggest one in V0.1:
      // active ASK prices are converted to an expected SALE price by this factor.
      // Asks are not sales. This number is a guess until sold comps are wired in.
      askToSaleRatio: num(process.env.BUYMAX_ASK_TO_SALE_RATIO, 0.80),
      // Which percentile of the trimmed active pool anchors the estimate.
      anchorPercentile: num(process.env.BUYMAX_ANCHOR_PERCENTILE, 40),
      // Prefer provider-supplied SOLD data over the active model when available.
      preferSoldWhenAvailable: bool(process.env.BUYMAX_PREFER_SOLD, true),
      // When sold comps are the basis, these govern evidence depth instead of
      // the active-listing counts above. Completed sales are stronger evidence,
      // so fewer of them are needed.
      minSoldComps: num(process.env.BUYMAX_MIN_SOLD_COMPS, 4),
      veryThinSoldComps: num(process.env.BUYMAX_VERY_THIN_SOLD_COMPS, 2),
    },

    // ---------------------------------------------------------------------
    // RISK  (0 = very low risk, 100 = very high risk)
    // Each entry is the penalty added when that condition is present.
    // ---------------------------------------------------------------------
    risk: {
      weights: {
        noIdentityConfidence: 15,   // provider gave us no identity confidence
        lowIdentityConfidence: 25,  // provider identity confidence below floor
        unknownParallel: 12,        // parallel not resolved and set has parallels
        unknownCondition: 10,       // raw/graded not stated
        thinMarket: 25,             // accepted listings under minListingsForEstimate
        veryThinMarket: 15,         // extra penalty when accepted listings <= 1
        wideSpread: 20,             // p90/p10 above maxSpreadRatio
        highRejectRate: 12,         // most candidate listings failed CompGuard
        noSoldData: 15,             // resale derived from asks, not sales
        providerDegraded: 20,       // one or more providers FAILED
        // The upstream deliberately withheld its median. Real information
        // about the card, and NOT the same event as a provider failing.
        soldCompsRefused: 12,
      },
      identityConfidenceFloor: num(process.env.BUYMAX_IDENTITY_FLOOR, 60),
      // Share of expected resale withheld as a haircut at risk = 100.
      maxHaircut: num(process.env.BUYMAX_MAX_RISK_HAIRCUT, 0.25),
    },

    // ---------------------------------------------------------------------
    // DECISION THRESHOLDS
    // ---------------------------------------------------------------------
    decision: {
      // Below this BuyMax confidence we never return BUY or PASS.
      minConfidenceForCall: num(process.env.BUYMAX_MIN_CONFIDENCE, 45),
      // Above this risk score we never return BUY.
      maxRiskForBuy: num(process.env.BUYMAX_MAX_RISK_FOR_BUY, 70),
      // Asking price within this band above max buy price is REVIEW, not PASS.
      borderlineBand: num(process.env.BUYMAX_BORDERLINE_BAND, 0.10),
      /* Above the ceiling but still worth a person's look. Under this
         return, an ask is treated as a refusal rather than a thin deal:
         the margin is inside the fee model's own error bar. */
      minRoiForThinDeal: num(process.env.BUYMAX_MIN_ROI_FOR_THIN_DEAL, 0.05),
      /* SOLD-FIRST, ENFORCED (22 Sept). With no completed sales the resale
         figure is built from asking prices, and an ask is not a sale. Such
         a result is a no-call, not a BUY or a PASS. Set false to restore the
         old behaviour (asks-only estimates could BUY/PASS). */
      requireSoldEvidence: bool(process.env.BUYMAX_REQUIRE_SOLD, true),
      /* A card the scanner could not confirm is not bought on BuyMax's word:
         a BUY becomes REVIEW, "confirm the card first". Only applies when
         the caller says identity is uncertain (request.context.identity). */
      requireConfirmedIdentityForBuy: bool(process.env.BUYMAX_REQUIRE_CONFIRMED_ID, true),
      /* The cheapest-sale test for a withheld (mixed) pool, moved from the
         scanner panel into the engine: BUY only if the ask leaves at least
         this much -- and at least this share of the ask -- even when the
         card sells at the LOWEST recent sale. */
      floorClearMinProfit: num(process.env.BUYMAX_FLOOR_MIN_PROFIT, 3),
      floorClearAskShare: num(process.env.BUYMAX_FLOOR_ASK_SHARE, 0.5),
    },

    // ---------------------------------------------------------------------
    // CONFIDENCE  (0 = none, 100 = full) — confidence in the ANALYSIS,
    // not in authenticity and not in identification.
    // ---------------------------------------------------------------------
    confidence: {
      base: 20,
      perAcceptedListing: 6,        // capped below
      maxFromListings: 40,
      perSoldComp: 3,               // when sold comps are the basis
      maxFromSold: 36,
      soldDataBonus: 25,
      identityBonus: 15,            // scaled by provider identity confidence
      widePenalty: 20,
      degradedProviderPenalty: 25,
      // Smaller than a provider failure: a refusal means the lookup worked
      // and the answer was withheld, which is less bad than not knowing.
      soldRefusedPenalty: 10,
      // IDENTITY PENALTIES. Sold-comp depth cannot buy confidence in a card
      // nobody has named. Without these, a deep sold pool scored 91/100 on an
      // item the same response described as unidentified.
      identityUnknownPenalty: num(process.env.BUYMAX_CONF_IDENTITY_UNKNOWN_PENALTY, 20),
      identityLowPenalty: num(process.env.BUYMAX_CONF_IDENTITY_LOW_PENALTY, 25),
      // Hard ceiling on analysis confidence while identity is unknown.
      maxWithoutIdentity: num(process.env.BUYMAX_CONF_MAX_WITHOUT_IDENTITY, 70),
      /* NOTHING HERE EVER EARNS 100.

         The arithmetic saturates without meaning to. Base 20, plus the
         25 sold-data bonus, plus 36 for comp depth, plus 10 for active
         listings is 91 BEFORE identity is considered at all -- and the
         identity bonus then pushes any well-described card straight into
         the clamp at 100.

         That was invisible while identity_confidence was always null,
         because maxWithoutIdentity capped everything at 70. The moment
         the host supplied a real identity hook, the strongest cards
         jumped from 70 to 100 -- and both numbers were wrong in opposite
         directions.

         100 out of 100 is a claim, not a measurement. This engine works
         from a thirty-day window, a median of other people's sales, and
         an identity read off a photograph; certainty is not available to
         it at any depth of evidence. The ceiling makes the top of the
         scale mean "as good as this gets", which is true, rather than
         "no doubt remains", which is not.

         Applied last, after every bonus and penalty, so it caps the
         answer rather than distorting the reasoning that produced it. */
      maxOverall: num(process.env.BUYMAX_CONF_MAX, 95),
    },

    // ---------------------------------------------------------------------
    // PROVIDERS
    // ---------------------------------------------------------------------
    cardgauge: {
      base: process.env.CARDGAUGE_API_BASE || '',
      identifyPath: process.env.CARDGAUGE_IDENTIFY_PATH || '',
      marketPath: process.env.CARDGAUGE_MARKET_PATH || '',
      apiKey: process.env.CARDGAUGE_API_KEY || '',
      timeoutMs: num(process.env.CARDGAUGE_TIMEOUT_MS, 8000),
    },

    ebay: {
      clientId: process.env.EBAY_CLIENT_ID || '',
      clientSecret: process.env.EBAY_CLIENT_SECRET || '',
      apiBase: process.env.EBAY_API_BASE || 'https://api.ebay.com',
      marketplaceId: process.env.EBAY_MARKETPLACE_ID || 'EBAY_US',
      campaignId: process.env.EBAY_CAMPAIGN_ID || '',
      timeoutMs: num(process.env.EBAY_TIMEOUT_MS, 9000),
    },

    logging: {
      enabled: bool(process.env.BUYMAX_LOG_ANALYSES, true),
      table: process.env.BUYMAX_TABLE || 'buymax_analyses',
      maxStoredListings: num(process.env.BUYMAX_MAX_STORED_LISTINGS, 60),
    },
  };

});

// ==================== core/stats.js ====================
__def('core/stats', function (module, exports, require) {

  /** Small numeric helpers. No business logic lives here. */

  function sortNums(arr) {
    return arr.filter((n) => Number.isFinite(n)).sort((a, b) => a - b);
  }

  function median(arr) {
    const a = sortNums(arr);
    if (!a.length) return null;
    const mid = Math.floor(a.length / 2);
    return a.length % 2 ? a[mid] : (a[mid - 1] + a[mid]) / 2;
  }

  function percentile(arr, p) {
    const a = sortNums(arr);
    if (!a.length) return null;
    if (a.length === 1) return a[0];
    const idx = (p / 100) * (a.length - 1);
    const lo = Math.floor(idx);
    const hi = Math.ceil(idx);
    if (lo === hi) return a[lo];
    return a[lo] + (a[hi] - a[lo]) * (idx - lo);
  }

  function mad(arr) {
    const m = median(arr);
    if (m === null) return null;
    return median(arr.map((n) => Math.abs(n - m)));
  }

  /** Median-absolute-deviation trim. Returns { kept, dropped }. */
  function trimOutliers(values, multiplier) {
    const vals = sortNums(values);
    if (vals.length < 4) return { kept: vals, dropped: [] };
    const m = median(vals);
    const d = mad(vals);
    if (!d) return { kept: vals, dropped: [] };
    const kept = [];
    const dropped = [];
    for (const v of vals) {
      (Math.abs(v - m) <= multiplier * d ? kept : dropped).push(v);
    }
    return kept.length >= 3 ? { kept, dropped } : { kept: vals, dropped: [] };
  }

  function round2(n) {
    return n === null || n === undefined || !Number.isFinite(n) ? null : Math.round(n * 100) / 100;
  }

  function clamp(n, lo, hi) {
    return Math.max(lo, Math.min(hi, n));
  }

  module.exports = { median, percentile, mad, trimOutliers, round2, clamp, sortNums };

});

// ==================== core/normalize.js ====================
__def('core/normalize', function (module, exports, require) {

  /**
   * Normalization layer.
   * Turns a loose BuyMax request into a canonical item identity that every
   * provider and every category module can read. Category-agnostic on purpose:
   * card-specific parsing lives in categories/card.js.
   */

  const clean = (v) => (typeof v === 'string' ? (v.trim().replace(/\s+/g, ' ') || null) : (v === 0 ? '0' : v || null));

  function normalizeNumber(v) {
    if (v === null || v === undefined || v === '') return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }

  /** @returns {{ ok: boolean, errors: string[], request: object }} */
  function normalizeRequest(body) {
    const errors = [];
    const b = body && typeof body === 'object' ? body : {};

    const category = clean(b.category) || 'card';
    const item = b.item && typeof b.item === 'object' ? b.item : {};

    const asking = normalizeNumber(b.asking_price);
    if (asking === null) errors.push('asking_price is required and must be a number');
    else if (asking < 0) errors.push('asking_price must be zero or greater');
    else if (asking > 1000000) errors.push('asking_price is outside the supported range');

    const name = clean(item.name);
    if (!name) errors.push('item.name is required');

    const request = {
      category,
      item: {
        name,
        set: clean(item.set),
        year: clean(item.year),
        card_number: clean(item.card_number),
        parallel: clean(item.parallel),
        serial_number: clean(item.serial_number),
        condition: (clean(item.condition) || '').toLowerCase() || null, // raw | graded | null
        grade: clean(item.grade),
        grader: clean(item.grader),
        player: clean(item.player),
      },
      asking_price: asking,
      grading: b.grading === true,
      grading_cost: normalizeNumber(b.grading_cost) || 0,
      shipping_cost: normalizeNumber(b.shipping_cost),
      other_costs: normalizeNumber(b.other_costs) || 0,
      desired_profit: normalizeNumber(b.desired_profit),
      sell_fee_rate: normalizeNumber(b.sell_fee_rate),
      context: normalizeContext(b.context),
    };

    return { ok: errors.length === 0, errors, request };
  }

  /* WHAT THE CALLER ALREADY KNOWS ABOUT THE CARD (22 Sept).

     The scanner has worked out things BuyMax cannot: whether the card was
     confirmed (its identity label), how fast it sells (computeLiquidity)
     and the lowest recent sale. Passed as facts, never as instructions --
     every field is optional, typed and bounded, and anything else in the
     object is dropped. */
  function normalizeContext(c) {
    const x = c && typeof c === 'object' ? c : {};
    const out = { identity: null, liquidity: null, sold_floor: null };
    const id = x.identity && typeof x.identity === 'object' ? x.identity : null;
    if (id && (id.level === 'strong' || id.level === 'uncertain')) {
      out.identity = {
        level: id.level,
        reasons: (Array.isArray(id.reasons) ? id.reasons : [])
          .filter((r) => typeof r === 'string').slice(0, 5).map((r) => r.slice(0, 160)),
      };
    }
    const lq = x.liquidity && typeof x.liquidity === 'object' ? x.liquidity : null;
    if (lq) {
      const str = (v) => (typeof v === 'string' ? v.slice(0, 200) : null);
      out.liquidity = {
        known: lq.known === true,
        label: str(lq.label),
        plain: str(lq.plain),
        reason: str(lq.reason),
        days_to_clear: normalizeNumber(lq.daysToClear),
        sold_30d: normalizeNumber(lq.sold30),
        listed: normalizeNumber(lq.listed),
      };
    }
    const f = normalizeNumber(x.sold_floor);
    if (f !== null && f > 0 && f < 1000000) out.sold_floor = f;
    return out;
  }

  /** Fill gaps in the caller's identity from provider identity. Never overwrites a stated field. */
  function mergeIdentity(callerItem, providerIdentity) {
    const out = { ...callerItem };
    if (!providerIdentity || typeof providerIdentity !== 'object') return out;
    for (const k of Object.keys(out)) {
      if ((out[k] === null || out[k] === undefined) && providerIdentity[k] != null) {
        out[k] = clean(providerIdentity[k]);
      }
    }
    return out;
  }

  module.exports = { normalizeRequest, mergeIdentity, clean, normalizeNumber };

});

// ==================== core/compguard.js ====================
__def('core/compguard', function (module, exports, require) {

  /**
   * COMPGUARD (BuyMax side)
   *
   * This is the *interface*, not a second implementation. If the CardGauge
   * provider exposes a CompGuard function, it is used and this file only
   * normalizes the shape of its answer. The local rules in categories/card.js
   * are the fallback for when CardGauge is unavailable.
   *
   * Nothing is silently discarded: every rejected listing keeps its reason.
   */

  async function screenListings(listings, identity, categoryModule, providerCompGuard) {
    const accepted = [];
    const rejected = [];

    for (const listing of listings || []) {
      let verdict;
      if (typeof providerCompGuard === 'function') {
        try {
          const r = await providerCompGuard(listing, identity);
          verdict = normalizeVerdict(r);
        } catch (err) {
          verdict = null; // fall through to local rules
        }
      }
      if (!verdict) verdict = categoryModule.evaluateListing(listing, identity);

      if (verdict.accept) {
        accepted.push({ ...listing, match_quality: verdict.quality || 'exact', match_notes: verdict.notes || [] });
      } else {
        rejected.push({
          listing_id: listing.listing_id || null,
          title: listing.title || null,
          price: listing.price === undefined ? null : listing.price,
          rejection_reason: verdict.reason || 'unspecified',
        });
      }
    }

    const reasonCounts = {};
    for (const r of rejected) reasonCounts[r.rejection_reason] = (reasonCounts[r.rejection_reason] || 0) + 1;

    return {
      accepted,
      rejected,
      counts: {
        considered: (listings || []).length,
        accepted: accepted.length,
        rejected: rejected.length,
        by_reason: reasonCounts,
      },
      source: typeof providerCompGuard === 'function' ? 'cardgauge_compguard' : 'buymax_local_rules',
    };
  }

  function normalizeVerdict(r) {
    if (!r || typeof r !== 'object') return null;
    if (typeof r.accept === 'boolean') return r;
    if (typeof r.accepted === 'boolean') return { accept: r.accepted, reason: r.reason || r.rejection_reason, quality: r.quality };
    return null;
  }

  module.exports = { screenListings };

});

// ==================== core/market.js ====================
__def('core/market', function (module, exports, require) {

  /**
   * ACTIVE MARKET MODEL
   *
   * Built from eBay ACTIVE listings. These are asking prices. They are not sales.
   * Every field produced here is named so it cannot be mistaken for sold data.
   */

  const { median, percentile, trimOutliers, round2 } = require('./stats');

  function buildActiveMarket(accepted, cfg) {
    const listings = (accepted || []).filter((l) => Number.isFinite(l.price) && l.price > 0);
    const prices = listings.map((l) => l.price);

    const base = {
      source: 'ebay_active',
      listings_found: (accepted || []).length,
      listings_used: 0,
      minimum_active_price: null,
      maximum_active_price: null,
      median_active_price: null,
      lower_range: null,
      upper_range: null,
      spread_ratio: null,
      trimmed_outliers: 0,
      fixed_price_count: 0,
      auction_count: 0,
      auctions_with_bids: 0,
      median_bid_count: null,
      average_bid_count: null,
      total_watch_count: null,
      condition_distribution: {},
      seller_concentration: null,
      market_confidence: 0,
      active_market_estimate: null,
      quality_gate: { passed: false, reasons: [] },
    };

    if (!prices.length) {
      base.quality_gate.reasons.push('no_usable_listings');
      return base;
    }

    const { kept, dropped } = trimOutliers(prices, cfg.market.madMultiplier);
    const used = kept.length ? kept : prices;

    const bidCounts = listings.map((l) => l.bid_count).filter((n) => Number.isFinite(n));
    const watches = listings.map((l) => l.watch_count).filter((n) => Number.isFinite(n));

    const condDist = {};
    for (const l of listings) {
      const c = (l.condition || 'UNKNOWN').toUpperCase();
      condDist[c] = (condDist[c] || 0) + 1;
    }

    const sellers = {};
    for (const l of listings) {
      const s = l.seller || 'unknown';
      sellers[s] = (sellers[s] || 0) + 1;
    }
    const topSeller = Math.max(...Object.values(sellers));

    const p10 = percentile(used, 10);
    const p90 = percentile(used, 90);
    const spread = p10 && p10 > 0 ? p90 / p10 : null;

    const out = {
      ...base,
      listings_used: used.length,
      minimum_active_price: round2(Math.min(...used)),
      maximum_active_price: round2(Math.max(...used)),
      median_active_price: round2(median(used)),
      lower_range: round2(percentile(used, 25)),
      upper_range: round2(percentile(used, 75)),
      spread_ratio: spread ? round2(spread) : null,
      trimmed_outliers: dropped.length,
      fixed_price_count: listings.filter((l) => l.buying_format === 'FIXED_PRICE').length,
      auction_count: listings.filter((l) => l.buying_format === 'AUCTION').length,
      auctions_with_bids: listings.filter((l) => l.buying_format === 'AUCTION' && (l.bid_count || 0) > 0).length,
      median_bid_count: bidCounts.length ? median(bidCounts) : null,
      average_bid_count: bidCounts.length ? round2(bidCounts.reduce((a, b) => a + b, 0) / bidCounts.length) : null,
      total_watch_count: watches.length ? watches.reduce((a, b) => a + b, 0) : null,
      condition_distribution: condDist,
      seller_concentration: round2(topSeller / listings.length),
    };

    // ---- quality gate: may we turn asks into a resale estimate at all? ----
    const reasons = [];
    if (out.listings_used < cfg.market.minListingsForEstimate) reasons.push('too_few_listings');
    if (out.spread_ratio && out.spread_ratio > cfg.market.maxSpreadRatio) reasons.push('price_spread_too_wide');
    if (out.seller_concentration && out.seller_concentration > 0.6) reasons.push('single_seller_dominates');

    out.quality_gate = { passed: reasons.length === 0, reasons };

    if (out.quality_gate.passed) {
      const anchor = percentile(used, cfg.market.anchorPercentile);
      // ASSUMPTION (config.market.askToSaleRatio): asks run above realised sales.
      out.active_market_estimate = round2(anchor * cfg.market.askToSaleRatio);
    }

    out.market_confidence = marketConfidence(out, cfg);
    return out;
  }

  function marketConfidence(m, cfg) {
    if (!m.listings_used) return 0;
    let c = 10;
    c += Math.min(m.listings_used * 6, 50);
    if (m.spread_ratio && m.spread_ratio <= 1.6) c += 20;
    else if (m.spread_ratio && m.spread_ratio > cfg.market.maxSpreadRatio) c -= 20;
    if (m.seller_concentration && m.seller_concentration > 0.6) c -= 15;
    if (m.auctions_with_bids > 0) c += 5;
    return Math.max(0, Math.min(100, Math.round(c)));
  }

  module.exports = { buildActiveMarket };

});

// ==================== core/risk.js ====================
__def('core/risk', function (module, exports, require) {

  /**
   * BUYMAX RISK SCORE — 0 (very low risk) to 100 (very high risk).
   *
   * This is NOT a probability of loss. It is a weighted sum of named concerns,
   * every weight configurable in config.js. Each contribution is returned so the
   * score can always be explained.
   */

  const { clamp } = require('./stats');

  function scoreRisk({ identity, identityConfidence, market, screen, soldAvailable, soldCount, soldRefusal, providerErrors }, cfg) {
    const w = cfg.risk.weights;
    const reasons = [];
    const add = (points, code, detail) => { reasons.push({ code, points, detail }); };

    if (identityConfidence === null || identityConfidence === undefined) {
      add(w.noIdentityConfidence, 'identity_confidence_unknown', 'No provider identity confidence available');
    } else if (identityConfidence < cfg.risk.identityConfidenceFloor) {
      add(w.lowIdentityConfidence, 'identity_confidence_low', `Provider identity confidence ${identityConfidence}`);
    }

    if (!identity.parallel) add(w.unknownParallel, 'parallel_unknown', 'Parallel/variant not specified or resolved');
    if (!identity.condition) add(w.unknownCondition, 'condition_unknown', 'Condition (raw/graded) not stated');

    // Depth is judged against the pool the resale estimate actually rests on.
    // Counting active listings when the number came from completed sales
    // penalised the stronger evidence.
    if (soldAvailable) {
      const n = Number.isFinite(soldCount) ? soldCount : null;
      if (n === null) {
        add(w.thinMarket, 'sold_count_unknown', 'Sold comps were returned without a count');
      } else {
        if (n < cfg.market.minSoldComps) add(w.thinMarket, 'thin_sold_data', `${n} completed sales`);
        if (n <= cfg.market.veryThinSoldComps) add(w.veryThinMarket, 'very_thin_sold_data', `${n} completed sales`);
      }
    } else {
      const used = market.listings_used || 0;
      if (used < cfg.market.minListingsForEstimate) add(w.thinMarket, 'thin_market', `${used} usable active listings`);
      if (used <= 1) add(w.veryThinMarket, 'very_thin_market', `${used} usable active listings`);

      if (market.spread_ratio && market.spread_ratio > cfg.market.maxSpreadRatio) {
        add(w.wideSpread, 'wide_price_spread', `p90/p10 = ${market.spread_ratio}`);
      }
    }

    const considered = screen.counts.considered || 0;
    if (considered >= 5 && screen.counts.rejected / considered > 0.7) {
      add(w.highRejectRate, 'high_reject_rate', `${screen.counts.rejected} of ${considered} candidate listings rejected`);
    }

    if (!soldAvailable) add(w.noSoldData, 'no_sold_comps', 'Resale estimate derived from active asks, not completed sales');

    /* The upstream had sold data and would not stand behind it. That is a
       real finding about the card and belongs in the score -- but under its
       own name, at its own weight, not as a provider failure. */
    if (soldRefusal) add(w.soldCompsRefused, 'sold_comps_refused', soldRefusal.reason);

    if (providerErrors && providerErrors.length) {
      add(w.providerDegraded, 'provider_degraded', providerErrors.map((e) => e.provider).join(', '));
    }

    const score = clamp(Math.round(reasons.reduce((s, r) => s + r.points, 0)), 0, 100);
    return { score, reasons };
  }

  module.exports = { scoreRisk };

});

// ==================== core/confidence.js ====================
__def('core/confidence', function (module, exports, require) {

  /**
   * BUYMAX ANALYSIS CONFIDENCE — 0 to 100.
   *
   * Deliberately separate from:
   *   - identity confidence (does the provider know what the item is)
   *   - market confidence   (is the market data coherent)
   * Both feed in, neither is returned as if it were this number.
   */

  const { clamp } = require('./stats');

  function scoreConfidence({ market, identityConfidence, soldAvailable, soldCount, basis, soldRefusal, providerErrors }, cfg) {
    const c = cfg.confidence;
    let score = c.base;

    if (soldAvailable) {
      // Evidence points come from completed sales, which are what the estimate
      // rests on. Active listings then add a little on top as corroboration.
      score += c.soldDataBonus;
      score += Math.min((soldCount || 0) * c.perSoldComp, c.maxFromSold);
      score += Math.min((market.listings_used || 0) * 2, 10);
    } else {
      score += Math.min((market.listings_used || 0) * c.perAcceptedListing, c.maxFromListings);
      if (market.spread_ratio && market.spread_ratio > cfg.market.maxSpreadRatio) score -= c.widePenalty;
      // The active quality gate only governs an active-derived estimate.
      if (!market.quality_gate.passed) score -= 15;
    }

    // Identity is not a bonus-only input. Twenty completed sales for a card we
    // cannot name is confident arithmetic on an unknown subject; publishing that
    // as a high number beside 'the card could not be confidently identified' is
    // the analysis contradicting itself on screen.
    let identityUnknown = false;
    if (Number.isFinite(identityConfidence)) {
      score += Math.round((identityConfidence / 100) * c.identityBonus);
      if (identityConfidence < cfg.risk.identityConfidenceFloor) score -= c.identityLowPenalty;
    } else {
      score -= c.identityUnknownPenalty;
      identityUnknown = true;
    }

    if (providerErrors && providerErrors.length) score -= c.degradedProviderPenalty;
    /* A withheld median is worse than a clean one and better than an
       outage: the lookup ran and returned a considered answer. */
    if (soldRefusal) score -= c.soldRefusedPenalty;

    // A cap, not another penalty: no amount of market evidence lifts the
    // analysis past this while the subject of it is unidentified.
    if (identityUnknown) score = Math.min(score, c.maxWithoutIdentity);

    /* And a second ceiling that applies however well the card is known.
       See config.confidence.maxOverall -- the scale reaches 91 on comp
       depth alone, so without this the identity bonus lands every strong
       card on 100. */
    score = Math.min(score, c.maxOverall);

    return clamp(Math.round(score), 0, 100);
  }

  module.exports = { scoreConfidence };

});

// ==================== core/calc.js ====================
__def('core/calc', function (module, exports, require) {

  /**
   * BUYMAX CALCULATION — the one place a maximum buy price is computed.
   *
   *   net_proceeds        = expected_resale * (1 - sell_fee_rate) - payment_fixed
   *   risk_adjustment     = expected_resale * (risk_score / 100) * max_haircut
   *   maximum_buy_price   = net_proceeds
   *                         - shipping_cost
   *                         - grading_cost
   *                         - other_costs
   *                         - desired_profit
   *                         - risk_adjustment
   *
   * It also produces the three numbers a person actually needs standing in front
   * of a seller:
   *
   *   target_offer      — open here (max buy discounted by the offer band)
   *   maximum_buy_price — the last price that still clears desired profit
   *   walk_away_above   — equal to maximum_buy_price; nothing ABOVE it is worth
   *                       taking. Kept as a separate key for the panel, but it
   *                       is the same number, not a third rung.
   *
   * Returns nulls, never guesses, when expected_resale is unavailable.
   */

  const { round2 } = require('./stats');

  function calculate({ expectedResale, request, riskScore }, cfg) {
    const sellFeeRate = request.sell_fee_rate !== null && request.sell_fee_rate !== undefined
      ? request.sell_fee_rate
      : cfg.costs.sellFeeRate;

    const shipping = request.shipping_cost !== null && request.shipping_cost !== undefined
      ? request.shipping_cost
      : cfg.costs.defaultShipping;

    const gradingCost = request.grading ? (request.grading_cost || 0) : 0;
    const otherCosts = request.other_costs || 0;

    if (!Number.isFinite(expectedResale) || expectedResale <= 0) {
      return {
        inputs: {
          expected_resale: null,
          sell_fee_rate: sellFeeRate,
          payment_fixed: cfg.costs.paymentFixed,
          shipping_cost: shipping,
          grading_cost: gradingCost,
          other_costs: otherCosts,
          desired_profit: request.desired_profit,
          risk_score: riskScore,
        },
        selling_cost: null,
        net_proceeds: null,
        desired_profit: null,
        risk_adjustment: null,
        maximum_buy_price: null,
        target_offer: null,
        ask_below_target: false,
        walk_away_above: null,
        expected_profit_at_asking: null,
        expected_profit_at_target: null,
        roi_at_asking: null,
        roi_at_target: null,
        roi_at_max: null,
        margin_at_asking: null,
      };
    }

    const sellingCost = expectedResale * sellFeeRate + cfg.costs.paymentFixed;
    const netProceeds = expectedResale - sellingCost;

    const desiredProfit = Number.isFinite(request.desired_profit)
      ? request.desired_profit
      : expectedResale * cfg.costs.defaultProfitMargin;

    const riskAdjustment = expectedResale * (riskScore / 100) * cfg.risk.maxHaircut;

    const maxBuy = netProceeds - shipping - gradingCost - otherCosts - desiredProfit - riskAdjustment;

    const maxBuyFloored = Math.max(0, maxBuy);

    // Open below the ceiling so there is somewhere to negotiate to — but never
    // above what the seller already asked. A ladder that opens higher than the
    // ask is not a negotiating position, it is a tip.
    const askingPrice = request.asking_price;
    const bandOffer = maxBuyFloored * (1 - cfg.costs.targetOfferBand);
    const targetOffer = Number.isFinite(askingPrice) && askingPrice > 0
      ? Math.min(bandOffer, askingPrice)
      : bandOffer;

    const profitAt = (price) => netProceeds - shipping - gradingCost - otherCosts - price;
    const roiAt = (price) => (price > 0 ? profitAt(price) / price : null);

    const expectedProfitAtAsking = profitAt(request.asking_price);

    return {
      inputs: {
        expected_resale: round2(expectedResale),
        sell_fee_rate: sellFeeRate,
        payment_fixed: cfg.costs.paymentFixed,
        shipping_cost: round2(shipping),
        grading_cost: round2(gradingCost),
        other_costs: round2(otherCosts),
        desired_profit: round2(desiredProfit),
        risk_score: riskScore,
      },
      selling_cost: round2(sellingCost),
      net_proceeds: round2(netProceeds),
      desired_profit: round2(desiredProfit),
      risk_adjustment: round2(riskAdjustment),
      maximum_buy_price: round2(maxBuyFloored),
      target_offer: round2(targetOffer),
      // True when the ask was already at or under the opening offer, i.e. there
      // is nothing to negotiate down to. The panel should not draw a ladder.
      ask_below_target: Number.isFinite(askingPrice) && askingPrice > 0 && askingPrice <= bandOffer,
      walk_away_above: round2(maxBuyFloored),
      expected_profit_at_asking: round2(expectedProfitAtAsking),
      expected_profit_at_target: round2(profitAt(targetOffer)),
      roi_at_asking: roiAt(request.asking_price) === null ? null : round2(roiAt(request.asking_price)),
      roi_at_target: roiAt(targetOffer) === null ? null : round2(roiAt(targetOffer)),
      roi_at_max: roiAt(maxBuyFloored) === null ? null : round2(roiAt(maxBuyFloored)),
      margin_at_asking: expectedResale > 0 ? round2(expectedProfitAtAsking / expectedResale) : null,
    };
  }

  module.exports = { calculate };

});

// ==================== core/explain.js ====================
__def('core/explain', function (module, exports, require) {

  /**
   * PLAIN-ENGLISH EXPLANATION
   *
   * Turns the structured result into sentences a person can act on. It reads
   * only what the other modules already produced — it never computes anything,
   * never rounds differently, and never states a number the engine did not.
   *
   * Rule: if a value is null, the sentence about it does not get written. No
   * hedged prose standing in for a missing number.
   */

  const money = (n) => (Number.isFinite(n) ? `$${Number(n).toFixed(2)}` : null);
  const pct = (n) => (Number.isFinite(n) ? `${Math.round(n * 100)}%` : null);

  const REASON_TEXT = {
    identity_confidence_unknown: 'the card could not be confidently identified',
    identity_confidence_low: 'identification of the card is uncertain',
    parallel_unknown: 'the parallel or variant was never pinned down, and parallels can be worth many times the base card',
    condition_unknown: 'the condition was not stated',
    thin_market: 'there are very few comparable listings to price against',
    very_thin_market: 'there is almost nothing comparable on the market right now',
    wide_price_spread: 'comparable prices are spread far apart, which usually means the listings are not really the same card',
    high_reject_rate: 'most listings found did not actually match this card',
    no_sold_comps: 'there is no completed-sale data here, only what sellers are currently asking',
    sold_comps_refused: 'the completed sales were found and then withheld, because they could not be trusted for this card',
    provider_degraded: 'a data source failed, so this analysis is running on less information than usual',
  };

  const GATE_TEXT = {
    too_few_listings: 'not enough comparable listings to price against',
    price_spread_too_wide: 'the comparable prices are too far apart to trust',
    single_seller_dominates: 'nearly all the listings come from one seller, which is a price they set rather than a market',
    no_usable_listings: 'no usable comparable listings were found',
  };

  function explain({ payload, calc, risk, market, decision, request }) {
    const lines = [];

    // --- what the decision is, in one sentence -------------------------
    if (decision.result === 'BUY' && decision.basis === 'sold_floor') {
      lines.push(decision.reason);
    } else if (decision.result === 'BUY') {
      lines.push(
        `Buy it. At ${money(request.asking_price)} you would clear about ${money(calc.expected_profit_at_asking)} after fees and costs, on an expected resale of ${money(calc.inputs.expected_resale)}.`
      );
    } else if (decision.result === 'PASS') {
      const over = calc.maximum_buy_price !== null ? request.asking_price - calc.maximum_buy_price : null;
      lines.push(
        `Walk away. ${money(request.asking_price)} is ${money(over)} above the most this card can be worth paying${
          calc.inputs.expected_resale ? `, given an expected resale of ${money(calc.inputs.expected_resale)}` : ''
        }.`
      );
    } else {
      lines.push(`Not enough to call it either way — this one needs your own judgement.`);
    }

    // --- the negotiating ladder ------------------------------------------
    if (calc.maximum_buy_price !== null) {
      if (calc.ask_below_target) {
        lines.push(
          `The ask is already below your ceiling of ${money(calc.maximum_buy_price)}, so there is nothing to negotiate down to — ${money(
            request.asking_price
          )} is the price.`
        );
      } else {
        lines.push(
          `Open at ${money(calc.target_offer)}. Do not go above ${money(calc.maximum_buy_price)} — past that the profit stops covering the risk.`
        );
      }

      // The haircut moves the ceiling. Left unsaid, the disclosed formula does
      // not reproduce the disclosed number and the gap looks like a bug.
      if (Number.isFinite(calc.risk_adjustment) && calc.risk_adjustment > 0) {
        lines.push(
          `That ceiling is ${money(calc.risk_adjustment)} lower than the profit target alone would set it — withheld against the risks below, not a market price.`
        );
      }
    }

    // --- where the number came from ---------------------------------------
    if (market.sold_market_value) {
      lines.push(
        `The resale figure is the median of ${market.sold_comp_count || 'recent'} completed sales — what buyers actually paid.`
      );
    } else if (calc.inputs.expected_resale !== null) {
      lines.push(
        `The resale figure is derived from ${market.listings_used} active listings asking a median of ${money(
          market.median_active_price
        )}. Those are asking prices, not sales, so treat the estimate as a working number rather than a fact.`
      );
    } else {
      const gates = (market.quality_gate.reasons || []).map((r) => GATE_TEXT[r] || r);
      if (gates.length) lines.push(`No resale estimate was produced because ${gates.join(', and ')}.`);
    }

    // --- what was thrown out and why ----------------------------------------
    // Two different pools. When the resale figure came from completed sales,
    // the active-listing screen did not produce it, and running the counts
    // together made the surviving actives look like the priced evidence.
    if (market.listings_rejected > 0) {
      if (market.sold_market_value) {
        lines.push(
          `Separately, ${market.listings_rejected} of ${market.listings_found} listings currently for sale were rejected as not the same card, leaving ${market.listings_used}. Those were a depth check only — they did not set the resale figure.`
        );
      } else {
        lines.push(
          `${market.listings_rejected} of ${market.listings_found} listings were rejected as not the same card, leaving ${market.listings_used} to price against.`
        );
      }
    }

    // --- the risks, ranked --------------------------------------------------
    /* The refusal explains why the figure above is an asking-price estimate
       at all, so it leads regardless of its weight. At 12 points it was
       losing a tie for third place and dropping out of the sentence
       entirely -- the one finding the person can act on. */
    const ranked = (risk.reasons || []).slice().sort((a, b) => {
      if (a.code === 'sold_comps_refused') return -1;
      if (b.code === 'sold_comps_refused') return 1;
      return b.points - a.points;
    });
    const top = ranked.slice(0, 3);
    if (top.length) {
      /* The refusal carries its own sentence from upstream and it is more
         specific than anything this table can hold -- 'the recent sales
         describe more than one version of this card' beats a generic line
         about withheld data. */
      const worded = top.map((r) =>
        (r.code === 'sold_comps_refused' && r.detail) ? r.detail : (REASON_TEXT[r.code] || r.code)
      );
      lines.push(`Main things working against this: ${worded.join('; ')}.`);
    }

    // --- honest closing note -------------------------------------------------
    /* NOT EVERY REVIEW IS A DATA PROBLEM.

       This line fired on every REVIEW, so an ask sitting a few percent
       above a ceiling built on twenty completed sales was told 'the data
       is too thin' -- which is false, and sends somebody off to narrow a
       search that was already fine. The decision already records WHY it
       declined; the sentence should say the same thing. */
    if (decision.result === 'REVIEW') {
      const f = decision.factors || [];
      const has = (x) => f.indexOf(x) > -1;
      lines.push(
        has('identity_unconfirmed')
          ? `The numbers work. What stops this being a buy is the card itself: confirm it matches what was priced.`
          : has('no_sold_evidence')
          ? `Nothing here is a recommendation to buy or to pass — there are no completed sales, and asking prices are not a value.`
          : has('borderline')
          ? `Nothing here is a recommendation either way — the ask is close enough to the ceiling that it comes down to how badly you want the card.`
          : has('risk_above_buy_ceiling')
          ? `The price itself works. It is the risks above that stop this being a straight buy.`
          : has('sold_comps_refused')
          ? `Nothing here is a recommendation to buy or to pass — the completed sales exist but are not trustworthy for this card, and asking prices alone are not enough to call it.`
          : `Nothing here is a recommendation to buy or to pass — the data is too thin to support either.`
      );
    }

    return {
      summary: lines[0],
      detail: lines.join(' '),
      lines,
    };
  }

  module.exports = { explain, REASON_TEXT, GATE_TEXT };

});

// ==================== core/decision.js ====================
__def('core/decision', function (module, exports, require) {

  /**
   * DECISION ENGINE — BUY / PASS / REVIEW.
   * Every threshold comes from config.decision. No magic numbers here.
   */

  function decide({ calc, request, riskScore, confidence, market, evidence, soldRefusal, providerErrors, blockers, floor }, cfg) {
    const ctxId = request && request.context && request.context.identity;
    const idUncertain = !!(cfg.decision.requireConfirmedIdentityForBuy && ctxId && ctxId.level === 'uncertain');
    const idWhy = idUncertain && ctxId.reasons && ctxId.reasons.length ? ' (' + ctxId.reasons.join('; ') + ')' : '';
    const d = cfg.decision;

    if (blockers && blockers.length) {
      return { result: 'REVIEW', no_call: true, reason: blockers[0], factors: blockers };
    }

    /* NO DATA IS NOT A CLOSE CALL, AND THE CLIENT COULD NOT TELL THEM APART.

       Every REVIEW rendered as "Your call — not enough to call it either
       way", which is the right sentence when an ask sits a few percent
       above a ceiling built on twenty completed sales. It is the wrong
       sentence when the engine produced no resale estimate at all.

       Observed 12 Sept on a 1999 Base Set Charizard: 50 of 50 listings
       rejected, nothing left to price against, and a $2 ask on a card
       whose own page showed sales from $300 to $819 came back as
       "your call". A person reads that as the engine weighing it up and
       shrugging. It never weighed anything.

       no_call marks the REVIEWs where there was nothing to decide on, so
       the client can say "cannot price this" instead of "too close to
       call". result stays REVIEW — anything switching on BUY/PASS/REVIEW,
       including the outcome endpoint and the CSS class, is untouched. */
    if (calc.maximum_buy_price === null) {
      return {
        result: 'REVIEW',
        no_call: true,
        reason: 'Active marketplace data is insufficient to produce a reliable resale estimate.',
        factors: market.quality_gate.reasons,
      };
    }

    /* Same outcome as before -- REVIEW -- but for the true reason. This used
       to arrive via providerErrors, so a deliberate refusal was reported as
       a degraded provider. If the upstream will not publish its median,
       BuyMax will not turn asking prices into a buy or a pass either. */
    /* THE CHEAPEST-SALE TEST, NOW IN THE ENGINE (22 Sept).

       The panel used to overrule this refusal on its own, with its own copy
       of the fee maths: when even the LOWEST recent sale leaves real money
       at the ask, the answer does not depend on which version the card is.
       Same test, same thresholds, but computed here from calculate() so the
       fees are the engine's, and the answer is a backend decision the
       receipt and the log both see. The refusal still stands for the
       CEILING: maximum_buy_price stays unset on this path. */
    if (soldRefusal && floor && Number.isFinite(floor.keep) && Number.isFinite(request.asking_price)
        && floor.keep >= Math.max(cfg.decision.floorClearMinProfit, request.asking_price * cfg.decision.floorClearAskShare)) {
      if (idUncertain) {
        return {
          result: 'REVIEW',
          basis: 'sold_floor',
          reason: `Even at the lowest recent sale (${fmt(floor.price)}) ${fmt(request.asking_price)} leaves about ${fmt(floor.keep)}, but the card itself is not confirmed${idWhy}. Confirm it first.`,
          factors: ['identity_unconfirmed', 'floor_clear'],
        };
      }
      return {
        result: 'BUY',
        basis: 'sold_floor',
        reason: `Even if it sells at the lowest recent sale (${fmt(floor.price)}), ${fmt(request.asking_price)} leaves about ${fmt(floor.keep)} after fees and postage. The sales mix versions, so there is no ceiling above that.`,
        factors: ['floor_clear'],
      };
    }

    if (soldRefusal) {
      return {
        result: 'REVIEW',
        no_call: true,
        reason: `Completed-sale data was withheld: ${soldRefusal.reason}. BuyMax will not call this off asking prices alone.`,
        factors: ['sold_comps_refused'],
      };
    }

    /* SOLD-FIRST (22 Sept). No completed sales means the resale figure is
       an asking-price estimate. That is context, not evidence: no BUY and
       no PASS off it. */
    if (d.requireSoldEvidence && evidence && !evidence.soldAvailable) {
      return {
        result: 'REVIEW',
        no_call: true,
        reason: 'No completed sales of this card were found. Asking prices alone cannot support a buy or a walk-away.',
        factors: ['no_sold_evidence'],
      };
    }

    const factors = [];
    if (confidence < d.minConfidenceForCall) factors.push(`analysis_confidence_below_${d.minConfidenceForCall}`);
    if (providerErrors && providerErrors.length) factors.push('provider_degraded');

    if (factors.length) {
      return {
        result: 'REVIEW',
        reason: 'Analysis confidence is too low to return a buy or pass recommendation.',
        factors,
      };
    }

    // Evidence floor: a single completed sale with nothing corroborating it is
    // not enough to tell someone to hand over money, however good the price looks.
    /* Tightened 22 Sept: active listings used to count as corroboration
       here, so one sale plus five asks could BUY. Asks are not sales. At or
       below veryThinSoldComps it is a no-call whatever is listed. */
    if (
      evidence &&
      evidence.soldAvailable &&
      Number.isFinite(evidence.soldCount) &&
      evidence.soldCount <= cfg.market.veryThinSoldComps
    ) {
      return {
        result: 'REVIEW',
        no_call: true,
        reason: `Only ${evidence.soldCount} completed sale${evidence.soldCount === 1 ? '' : 's'} to price against. That is not enough to set a value.`,
        factors: ['evidence_floor'],
      };
    }

    const ask = request.asking_price;
    const max = calc.maximum_buy_price;

    if (ask <= max) {
      if (riskScore > d.maxRiskForBuy) {
        return {
          result: 'REVIEW',
          reason: `Price works but BuyMax Risk Score is ${riskScore}, above the ${d.maxRiskForBuy} ceiling for an automatic BUY.`,
          factors: ['risk_above_buy_ceiling'],
        };
      }
      if (idUncertain) {
        return {
          result: 'REVIEW',
          reason: `The price works -- ${fmt(ask)} is at or below the maximum buy price ${fmt(max)} -- but the card is not confirmed${idWhy}. Confirm it before paying.`,
          factors: ['identity_unconfirmed'],
        };
      }
      return {
        result: 'BUY',
        reason: `Asking price ${fmt(ask)} is at or below the maximum buy price ${fmt(max)}.`,
        factors: [],
      };
    }

    if (ask <= max * (1 + d.borderlineBand)) {
      return {
        result: 'REVIEW',
        reason: `Asking price ${fmt(ask)} is within ${Math.round(d.borderlineBand * 100)}% of the maximum buy price ${fmt(max)}. Negotiable, not automatic.`,
        factors: ['borderline'],
      };
    }

    /* ABOVE THE CEILING IS NOT THE SAME AS LOSING MONEY. (23 Sept)

       PASS used to fire on one test -- ask over ceiling -- and the record
       layer turns PASS into WALK_AWAY. But the ceiling is not a
       profitability line: it is net proceeds minus a desired profit of
       30% OF RESALE, minus a risk haircut. On a $330 card it holds back
       $99 before the ceiling is even drawn.

       So a $200 ask on that card came back WALK_AWAY while still clearing
       about $79, a 40% return. That is a thinner deal than the engine
       wants, not a bad one, and "walk away" is the wrong word for it --
       WALK_AWAY is defined two modules down as "we know, and it is a bad
       deal", and this contradicted that definition every time it fired on
       a profitable ask.

       Split on the thing that actually matters. No money in it -> PASS,
       and WALK_AWAY means what it says. Money in it but under the target
       margin -> REVIEW, which is already the vocabulary for "the evidence
       holds, a person decides". Nothing here is softened: an ask that
       loses money still refuses exactly as before, and the ceiling, the
       margin and the risk haircut are untouched. */
    /* "Still profitable" needs a floor, or the split just moves the bad
       call rather than fixing it. At $285 on a $330 card this returned
       98 cents of profit and called it "a thinner deal, not a losing
       one" -- which is false. A return that thin is inside the error bar
       on the fee model and one postage surprise from negative, so it is
       not a deal a person should be nudged toward. Below the floor it
       stays a refusal. */
    const profitAtAsk = calc.expected_profit_at_asking;
    const roiAtAsk    = calc.roi_at_asking;
    const thinFloor   = d.minRoiForThinDeal;
    if (Number.isFinite(profitAtAsk) && profitAtAsk > 0
        && Number.isFinite(roiAtAsk) && roiAtAsk >= thinFloor) {
      /* The margin actually used, read back off the calculation rather than
         the default -- a caller may have supplied its own desired_profit. */
      const inp = calc.inputs || {};
      const marginPct = inp.expected_resale > 0
        ? Math.round((inp.desired_profit / inp.expected_resale) * 100) : null;
      return {
        result: 'REVIEW',
        reason: `Asking price ${fmt(ask)} is over the maximum buy price ${fmt(max)}`
              + (marginPct ? `, because that ceiling holds back a ${marginPct}% margin before risk` : '')
              + `. At ${fmt(ask)} it still clears about ${fmt(profitAtAsk)} — a thinner deal, `
              + `not a losing one. Your call.`,
        factors: ['above_ceiling_still_profitable'],
      };
    }

    return {
      result: 'PASS',
      reason: `Asking price ${fmt(ask)} exceeds the maximum buy price ${fmt(max)} and leaves no profit after costs.`,
      factors: [],
    };
  }

  const fmt = (n) => `$${Number(n).toFixed(2)}`;

  module.exports = { decide };

});

// ==================== core/record.js ====================
__def('core/record', function (module, exports, require) {

  /**
   * THE DECISION RECORD -- ONE CANONICAL SHAPE FOR "WHAT SHOULD I DO" (22 Sept).
   *
   * A projection of what the engine already decided. It computes no price,
   * no fee, no ceiling and no profit: every number is copied from calc,
   * payload or the caller's context. What it adds is vocabulary --
   *
   *   BUY         the evidence holds and the ask is at or under the ceiling
   *   WALK_AWAY   the evidence holds and the ask is over it (engine: PASS)
   *   REVIEW      the evidence holds but something needs a person
   *               (borderline ask, risk ceiling, card not confirmed)
   *   NO_DECISION there is not enough trustworthy evidence to decide at all
   *               (engine: REVIEW with no_call)
   *
   * WALK_AWAY and NO_DECISION are different claims and are never merged:
   * one is "we know, and it is a bad deal", the other is "we do not know".
   *
   * Reserved for callers that decide other things (SELL, HOLD, GRADE,
   * TRADE, LIST, REPRICE, DISCOUNT); nothing produces them yet.
   *
   * CONFIDENCE IS A RATING OF THE EVIDENCE, NOT A PROBABILITY. Nothing here
   * has been calibrated against outcomes, so it is a word (HIGH / MEDIUM /
   * LOW / NONE) with the reasons that put it there -- never "91% chance".
   */

  const ACTIONS = ['BUY', 'SELL', 'HOLD', 'GRADE', 'TRADE', 'LIST', 'REPRICE', 'DISCOUNT',
                   'REVIEW', 'WALK_AWAY', 'NO_DECISION'];
  const CONFIDENCE_MEANING = 'A rating of the evidence behind this decision. It is not a probability of profit.';
  const RECORD_VERSION = 1;
  /* Fewest clean sales for anything better than THIN. 5 is the line the
     scanner's own "Price evidence: STRONG" label has used since 21 Sept
     (EVL_STRONG_MIN_SALES); one number now, used by both. */
  const EVIDENCE_MIN_SALES = 5;

  const n2 = (v) => (v === null || v === undefined || !Number.isFinite(Number(v)) ? null : Math.round(Number(v) * 100) / 100);
  const $ = (v) => (v === null || v === undefined ? '—' : '$' + Number(v).toFixed(2));

  function actionFor(decision) {
    if (!decision) return 'NO_DECISION';
    if (decision.result === 'BUY') return 'BUY';
    if (decision.result === 'PASS') return 'WALK_AWAY';
    return decision.no_call ? 'NO_DECISION' : 'REVIEW';
  }

  /* Evidence quality from the SOLD side only. Same thresholds the engine and
     the scanner already use: veryThinSoldComps / minSoldComps from config,
     the 3x "all over the place" spread, and the panel's old Strong test
     (10+ sales within 1.6x of the median), moved here from the browser. */
  function evidenceQuality({ soldAvailable, sold, soldRefusal, activeEstimate, cfg }) {
    const reasons = [];
    if (soldRefusal) {
      /* Only a pool that was FOUND and judged untrustworthy is REFUSED.
         "No sales at all" and "the lookup allowance was spent" are not
         findings about the sales, and saying REFUSED for them would claim
         a judgement nobody made. */
      const k = soldRefusal.kind;
      reasons.push(soldRefusal.reason || 'completed sales were found but withheld');
      const quality = k === 'no_comps' || k === 'no_identity' || k === 'no_median'
        ? (activeEstimate ? 'ACTIVE_ONLY' : 'NONE')
        : k === 'rate_limited' ? 'UNAVAILABLE'
        : k === 'limited' ? 'INSUFFICIENT'
        : 'REFUSED';
      return { quality, reasons, refusal: soldRefusal.reason || null, refusal_kind: k || null };
    }
    if (soldAvailable) {
      const n = Number.isFinite(Number(sold.count)) ? Number(sold.count) : null;
      const med = Number(sold.median) || 0, lo = Number(sold.low) || 0, hi = Number(sold.high) || 0;
      if (n === null) return { quality: 'THIN', reasons: ['sales were returned without a count'], refusal: null };
      reasons.push(n + ' completed sale' + (n === 1 ? '' : 's'));
      if (n <= cfg.market.veryThinSoldComps) return { quality: 'INSUFFICIENT', reasons, refusal: null };
      if (lo > 0 && hi > 0) reasons.push('sold ' + $(lo) + '–' + $(hi));
      const wide = med > 0 && ((hi > 0 && hi / med >= 3) || (lo > 0 && med / lo >= 3));
      if (wide) { reasons.push('sales run more than 3x apart'); return { quality: 'MIXED', reasons, refusal: null }; }
      if (n < EVIDENCE_MIN_SALES) return { quality: 'THIN', reasons, refusal: null };
      const snug = med > 0 && hi > 0 && lo > 0 && hi / med < 1.6 && med / lo < 1.6;
      return { quality: n >= 10 && snug ? 'HIGH' : 'MODERATE', reasons, refusal: null };
    }
    if (activeEstimate) return { quality: 'ACTIVE_ONLY', reasons: ['asking prices only -- no completed sales'], refusal: null };
    return { quality: 'NONE', reasons: ['no completed sales and no usable listings'], refusal: null };
  }

  function riskLevel(score) {
    if (!Number.isFinite(score)) return null;
    return score < 30 ? 'LOW' : score < 60 ? 'MEDIUM' : 'HIGH';
  }

  function confidenceLevel({ action, evidence, identity, risk, engineScore, cfg }) {
    if (action === 'NO_DECISION') return { level: 'NONE', reasons: ['no decision was made'] };
    const order = ['LOW', 'MEDIUM', 'HIGH'];
    const reasons = [];
    let i = evidence.quality === 'HIGH' ? 2 : evidence.quality === 'MODERATE' ? 1 : 0;
    reasons.push('evidence ' + evidence.quality.toLowerCase().replace('_', ' '));
    if (identity.status === 'uncertain') { i = Math.max(0, i - 1); reasons.push('card not confirmed'); }
    if (risk.level === 'HIGH') { i = Math.max(0, i - 1); reasons.push('high risk'); }
    /* Raw or graded unknown: a slab and a raw copy are different markets, so
       the sales may not be this copy's sales. (Not parallel_unknown -- the
       engine raises that for every base card, which would cap them all.) */
    if (risk.codes && risk.codes.indexOf('condition_unknown') > -1) { i = Math.max(0, i - 1); reasons.push('raw or graded not stated'); }
    if (Number.isFinite(engineScore) && engineScore < cfg.decision.minConfidenceForCall) { i = 0; reasons.push('engine confidence below its call threshold'); }
    return { level: order[i], reasons };
  }

  function buildDecisionRecord({ payload, calc, decision, request, cfg, soldAvailable, sold, soldRefusal, floor, activeEstimate, risk }) {
    const action = actionFor(decision);
    const ctx = (request && request.context) || {};
    const ask = n2(request && request.asking_price);
    const f = decision && decision.factors ? decision.factors : [];
    const floorBasis = !!(decision && decision.basis === 'sold_floor' && floor);

    const evidence = evidenceQuality({ soldAvailable, sold: sold || {}, soldRefusal, activeEstimate, cfg });

    const idCtx = ctx.identity || null;
    const identity = {
      status: idCtx ? (idCtx.level === 'strong' ? 'confirmed' : 'uncertain') : 'not_checked',
      reasons: idCtx ? idCtx.reasons : [],
      // How completely the card is DESCRIBED (field count). Not how sure we are
      // it is right -- see identityConfidenceFromItem in server.js.
      completeness: payload.confidence ? payload.confidence.identity_confidence : null,
    };

    const riskOut = {
      score: risk ? risk.score : null,
      level: riskLevel(risk ? risk.score : null),
      reasons: (risk && risk.reasons ? risk.reasons : []).slice().sort((a, b) => b.points - a.points)
        .slice(0, 4).map((r) => r.detail || r.code),
      codes: (risk && risk.reasons ? risk.reasons : []).map((r) => r.code),
    };

    const c = calc || {};
    const ci = c.inputs || {};
    const extras = (Number(ci.shipping_cost) || 0) + (Number(ci.grading_cost) || 0) + (Number(ci.other_costs) || 0);
    const economics = floorBasis ? {
      basis: 'lowest_recent_sale',
      maximum_buy: null,
      target_offer: null,
      expected_net: n2(floor.net - extras),
      expected_profit: n2(floor.keep),
      roi: ask > 0 ? n2(floor.keep / ask) : null,
    } : {
      basis: c.net_proceeds === null || c.net_proceeds === undefined ? null
             : (soldAvailable ? 'sold_median' : 'asking_prices'),
      /* No call means no ceiling: a NO_DECISION built on asking prices (or a
         withheld pool) must not print a "Maximum buy" the engine refused to stand behind. */
      maximum_buy: action === 'NO_DECISION' ? null : n2(c.maximum_buy_price),
      target_offer: action === 'NO_DECISION' ? null : n2(c.target_offer),
      expected_net: c.net_proceeds === null || c.net_proceeds === undefined ? null : n2(c.net_proceeds - extras),
      expected_profit: n2(c.expected_profit_at_asking),
      roi: n2(c.roi_at_asking),
    };
    Object.assign(economics, {
      selling_cost: n2(c.selling_cost),
      shipping_cost: n2(ci.shipping_cost),
      grading_cost: n2(ci.grading_cost),
      other_costs: n2(ci.other_costs),
      desired_profit: n2(c.desired_profit),
      risk_adjustment: n2(c.risk_adjustment),
    });

    const mkt = payload.market || {};
    const market = {
      value: floorBasis ? n2(floor.price) : n2(ci.expected_resale),
      basis: floorBasis ? 'lowest_recent_sale'
           : soldAvailable ? 'sold_median'
           : (ci.expected_resale ? 'asking_prices' : null),
      sold_count: mkt.sold_comp_count != null ? mkt.sold_comp_count : (soldRefusal ? soldRefusal.sold_count || null : null),
      sold_low: mkt.sold_low != null ? mkt.sold_low : null,
      sold_high: mkt.sold_high != null ? mkt.sold_high : null,
      active_median: n2(mkt.median_active_price),
      active_listings_used: mkt.listings_used != null ? mkt.listings_used : null,
    };

    /* WHAT TO PAY, INDEPENDENT OF ANY ASK (22 Sept).

       The ceiling, the net after costs and the profit target do not depend
       on what the seller asks -- only the verdict does. So the record
       carries them on their own, and the scanner can show "what to pay"
       on every result before anybody types a price (see the preview flag
       on POST /buymax). Copied from calc, never recomputed. Absent when
       there is no decision, or when the pool was withheld and only the
       lowest-sale test ran (no ceiling exists then). */
    const wtpMax = economics.maximum_buy;
    const whatToPay = (action === 'NO_DECISION' || floorBasis || wtpMax === null || wtpMax === undefined) ? null : {
      max: wtpMax,
      market: market.value,
      market_basis: market.basis,
      expected_net: economics.expected_net,
      desired_profit: economics.desired_profit,
      target_margin: ci.expected_resale > 0 && Number.isFinite(Number(c.desired_profit))
        ? Math.round((Number(c.desired_profit) / Number(ci.expected_resale)) * 100) / 100 : null,
      not_flippable: wtpMax <= 0.75,
      confirm_first: f.indexOf('identity_unconfirmed') > -1,
      risk_hold: f.indexOf('risk_above_buy_ceiling') > -1,
    };

    /* NO DECISION MEANS NO NUMBERS TO ACT ON. On a no-call the engine may
       still have computed a ceiling from the pool it then declined to trust
       (two sales, asks only). Printing that ceiling beside "no decision" is
       the contradiction the panel spent a month removing, so the record
       drops every figure somebody could pay against. The counts stay:
       "2 sales found" is the reason, not a price. */
    if (action === 'NO_DECISION') {
      market.value = null;
      market.basis = null;
      ['maximum_buy', 'target_offer', 'expected_net', 'expected_profit', 'roi'].forEach((k) => { economics[k] = null; });
      economics.basis = null;
    }

    const confidence = confidenceLevel({
      action, evidence, identity, risk: riskOut, cfg,
      engineScore: payload.confidence ? payload.confidence.buymax_confidence : null,
    });

    /* WHAT WOULD CHANGE IT, AND WHAT ELSE TO DO. Built from the same numbers,
       never from a model. */
    const change = [];
    const alternatives = [];
    const max = economics.maximum_buy;
    if (action === 'BUY') {
      if (floorBasis) {
        change.push('An ask high enough that the lowest recent sale no longer clears it.');
        alternatives.push('Narrow the search to one version before paying anywhere near the typical price.');
      } else {
        change.push('An ask above ' + $(max) + ' -- the most this is worth paying.');
        if (market.sold_low) change.push('Recent sales falling well below ' + $(market.sold_low) + '.');
        if (economics.target_offer !== null && ask > economics.target_offer) alternatives.push('Open at ' + $(economics.target_offer) + '.');
      }
    } else if (action === 'WALK_AWAY') {
      if (max > 0) {
        change.push('The seller coming down to ' + $(max) + ' or less.');
        alternatives.push('Counter at ' + $(economics.target_offer || max) + '; never above ' + $(max) + '.');
      } else {
        change.push('Nothing at this price: fees and postage exceed what it sells for. Sell it in a lot, not as a single.');
      }
    } else if (action === 'REVIEW') {
      if (f.indexOf('identity_unconfirmed') > -1) change.push('Confirming the card' + (identity.reasons.length ? ': ' + identity.reasons.join('; ') : '') + '.');
      if (f.indexOf('borderline') > -1 && max !== null) { change.push('Getting the price to ' + $(max) + ' or less.'); alternatives.push('Counter at ' + $(max) + '.'); }
      if (f.indexOf('risk_above_buy_ceiling') > -1) change.push('Pinning down the risks: ' + riskOut.reasons.slice(0, 2).join('; ') + '.');
      if (f.some((x) => /^analysis_confidence_below/.test(x)) || f.indexOf('provider_degraded') > -1) change.push('More clean completed sales of this exact card.');
    } else {
      if (evidence.quality === 'UNAVAILABLE') change.push('Trying again later -- the sold-price lookup allowance is spent for today.');
      else if (evidence.quality === 'REFUSED') change.push('Narrowing the search to one version -- card number, parallel or grade -- so the sales describe a single card.');
      else if (evidence.quality === 'ACTIVE_ONLY' || evidence.quality === 'NONE') change.push('Completed sales of this exact card. Asking prices alone are not a value.');
      else if (evidence.quality === 'INSUFFICIENT' || evidence.quality === 'THIN') change.push('At least ' + (cfg.market.veryThinSoldComps + 1) + ' completed sales of this card (found ' + (market.sold_count || 0) + ').');
      else change.push('Card details the pricing search can match.');
    }

    /* WHAT WE DON'T KNOW -- the gaps this decision stands on, from facts
       already in hand (the scanner's identity doubts, the risk codes, the
       evidence grade, the caller's liquidity). Never a guess. */
    const unknown = [];
    identity.reasons.forEach((r) => unknown.push('The card: ' + r + '.'));
    if (riskOut.codes.indexOf('condition_unknown') > -1) unknown.push('Raw or graded: the sales may be for a different condition than this copy.');
    if (riskOut.codes.indexOf('parallel_unknown') > -1 && !(request.item && request.item.parallel)) unknown.push('Whether it is a parallel: none was named, so it is priced as the base card.');
    if (evidence.quality === 'THIN') unknown.push('Whether ' + (market.sold_count || 0) + ' sales are typical.');
    if (ctx.liquidity && ctx.liquidity.known === false && ctx.liquidity.reason) unknown.push('How fast it sells: ' + ctx.liquidity.reason + '.');

    return {
      version: RECORD_VERSION,
      kind: 'buy',
      action,
      engine_result: decision ? decision.result : null,
      decided_at: new Date().toISOString(),
      why: decision ? decision.reason : null,
      summary: payload.explanation ? payload.explanation.summary : null,
      ask,
      market,
      economics,
      evidence,
      identity,
      liquidity: ctx.liquidity || null,
      risk: riskOut,
      confidence: {
        level: confidence.level,
        reasons: confidence.reasons,
        meaning: CONFIDENCE_MEANING,
        engine_score: payload.confidence ? payload.confidence.buymax_confidence : null,
      },
      assumptions: (payload.meta && payload.meta.assumptions) || [],
      alternatives,
      unknown,
      what_would_change: change,
      what_to_pay: whatToPay,
    };
  }

  /* When the engine never ran (it threw), the only honest record is none. */
  function noDecisionRecord(reason) {
    return {
      version: RECORD_VERSION, kind: 'buy', action: 'NO_DECISION', engine_result: null,
      decided_at: new Date().toISOString(), why: reason, summary: reason, ask: null,
      market: null, economics: null,
      evidence: { quality: 'NONE', reasons: [reason], refusal: null },
      identity: { status: 'not_checked', reasons: [], completeness: null }, liquidity: null,
      risk: { score: null, level: null, reasons: [] },
      confidence: { level: 'NONE', reasons: ['no decision was made'], meaning: CONFIDENCE_MEANING, engine_score: null },
      assumptions: [], alternatives: [], unknown: [], what_would_change: ['Try again in a moment.'], what_to_pay: null,
    };
  }

  module.exports = { buildDecisionRecord, noDecisionRecord, actionFor, evidenceQuality, riskLevel, ACTIONS, CONFIDENCE_MEANING, RECORD_VERSION };

});

// ==================== core/engine.js ====================
__def('core/engine', function (module, exports, require) {

  /**
   * BUYMAX CORE
   *
   * Orchestration only. The core does not know how any provider gets its data,
   * and contains no card-specific logic — that lives in categories/.
   *
   * Flow: normalize -> providers -> CompGuard -> market model -> resale ->
   *       risk -> confidence -> calculation -> decision.
   */

  const { getCategory } = require('../categories');
  const { normalizeRequest, mergeIdentity } = require('./normalize');
  const { screenListings } = require('./compguard');
  const { buildActiveMarket } = require('./market');
  const { scoreRisk } = require('./risk');
  const { scoreConfidence } = require('./confidence');
  const { calculate } = require('./calc');
  const { decide } = require('./decision');
  const { explain } = require('./explain');
  const { buildDecisionRecord } = require('./record');
  const { round2 } = require('./stats');

  async function runBuyMax(body, { cfg, providers }) {
    const started = Date.now();

    // 1. Normalize -------------------------------------------------------
    const { ok, errors, request } = normalizeRequest(body);
    if (!ok) {
      return {
        status: 400,
        payload: {
          success: false,
          engine: cfg.engine,
          error: 'invalid_request',
          details: errors,
        },
      };
    }

    const cat = getCategory(request.category);
    if (!cat.ok) {
      return {
        status: 400,
        payload: { success: false, engine: cfg.engine, error: 'unsupported_category', details: [cat.error] },
      };
    }
    const category = cat.module;

    const providerErrors = [];
    const providersUsed = [];

    // 2. Intelligence provider (CardGauge) --------------------------------
    let intel = { available: false, identity: null, identity_confidence: null, sold: null, compguard: null, errors: [] };
    if (providers.cardgauge) {
      try {
        intel = await providers.cardgauge.fetch({ item: request.item, category: request.category });
      } catch (err) {
        intel.errors = [err.message];
      }
      if (intel.available) providersUsed.push(providers.cardgauge.name);
      for (const e of intel.errors || []) providerErrors.push({ provider: 'cardgauge', message: e });
    }

    // Carried separately from providerErrors on purpose. See providers/local.
    const soldRefusal = intel.sold_refused || null;

    const identity = mergeIdentity(request.item, intel.identity);
    const query = category.buildQuery(identity);

    // 3. Marketplace provider (eBay active) -------------------------------
    let market = { available: false, listings: [], query: null, errors: [] };
    if (providers.ebay) {
      try {
        market = await providers.ebay.fetch({ item: identity, category: request.category, query });
      } catch (err) {
        market.errors = [err.message];
      }
      if (market.available) providersUsed.push(providers.ebay.name);
      for (const e of market.errors || []) providerErrors.push({ provider: 'ebay_active', message: e });
    }

    // 4. CompGuard --------------------------------------------------------
    const screen = await screenListings(market.listings, identity, category, intel.compguard);

    // 5. Active market model ----------------------------------------------
    const activeMarket = buildActiveMarket(screen.accepted, cfg);

    // 6. Expected resale ---------------------------------------------------
    const soldAvailable = Boolean(intel.sold && Number.isFinite(intel.sold.median) && intel.sold.median > 0);
    let expectedResale = null;
    let resaleBasis = 'none';

    if (soldAvailable && cfg.market.preferSoldWhenAvailable) {
      expectedResale = intel.sold.median;
      resaleBasis = 'cardgauge_sold_median';
    } else if (activeMarket.active_market_estimate !== null) {
      expectedResale = activeMarket.active_market_estimate;
      resaleBasis = 'ebay_active_estimate';
    }

    // 7. Risk --------------------------------------------------------------
    const risk = scoreRisk(
      {
        identity,
        identityConfidence: intel.identity_confidence,
        market: activeMarket,
        screen,
        soldAvailable,
        soldCount: soldAvailable ? intel.sold.count : null,
        soldRefusal,
        providerErrors,
      },
      cfg
    );

    // 8. Confidence ---------------------------------------------------------
    const confidence = scoreConfidence(
      {
        market: activeMarket,
        identityConfidence: intel.identity_confidence,
        soldAvailable,
        soldCount: soldAvailable ? intel.sold.count : null,
        basis: resaleBasis,
        soldRefusal,
        providerErrors,
      },
      cfg
    );

    // 9. Calculation ---------------------------------------------------------
    const calc = calculate({ expectedResale, request, riskScore: risk.score }, cfg);

    /* The cheapest-sale test for a withheld pool (see decide). Uses the same
       calculate() as everything else, with the caller's lowest recent sale
       as the resale figure and no risk haircut -- it asks "does even the
       worst case clear", not "what is the ceiling". */
    let floor = null;
    const floorPrice = request.context && request.context.sold_floor;
    /* Only for a pool refused because it MIXES versions (contaminated /
       wide spread): there the cheapest sale is a real worst case across
       versions. A "limited" / "no median" refusal means the pool is too
       small or not this card, so its lowest sale is not a floor. */
    const floorKind = soldRefusal && (soldRefusal.kind || soldRefusal.refusal_kind);
    if (soldRefusal && floorPrice > 0 && (floorKind === 'contaminated' || floorKind === 'wide_spread')) {
      const fc = calculate({ expectedResale: floorPrice, request, riskScore: 0 }, cfg);
      if (fc && Number.isFinite(fc.expected_profit_at_asking)) {
        floor = { price: floorPrice, keep: fc.expected_profit_at_asking, net: fc.net_proceeds };
      }
    }

    // 10. Decision -----------------------------------------------------------
    const blockers = [];
    if (!providersUsed.length) {
      blockers.push('No provider returned data. BuyMax cannot evaluate this item.');
    } else if (!market.available && !soldAvailable) {
      blockers.push('No marketplace data and no sold comps were available for this item.');
    }

    const decision = decide(
      {
        calc,
        request,
        riskScore: risk.score,
        confidence,
        market: activeMarket,
        evidence: { soldAvailable, soldCount: soldAvailable ? intel.sold.count : null },
        soldRefusal,
        providerErrors,
        blockers,
        floor,
      },
      cfg
    );

    // 11. Response -----------------------------------------------------------
    const payload = {
      success: true,
      engine: cfg.engine,
      category: request.category,

      item: identity,

      query_used: query,

      market: {
        active_market_estimate: activeMarket.active_market_estimate,
        minimum_active_price: activeMarket.minimum_active_price,
        median_active_price: activeMarket.median_active_price,
        maximum_active_price: activeMarket.maximum_active_price,
        lower_range: activeMarket.lower_range,
        upper_range: activeMarket.upper_range,
        spread_ratio: activeMarket.spread_ratio,
        listings_found: screen.counts.considered,
        listings_accepted: screen.counts.accepted,
        listings_used: activeMarket.listings_used,
        listings_rejected: screen.counts.rejected,
        rejection_reasons: screen.counts.by_reason,
        compguard_source: screen.source,
        fixed_price_count: activeMarket.fixed_price_count,
        auction_count: activeMarket.auction_count,
        auctions_with_bids: activeMarket.auctions_with_bids,
        median_bid_count: activeMarket.median_bid_count,
        condition_distribution: activeMarket.condition_distribution,
        seller_concentration: activeMarket.seller_concentration,
        market_confidence: activeMarket.market_confidence,
        quality_gate: activeMarket.quality_gate,
        source: 'ebay_active',
        // Explicitly separate. V0.1 has no sold data unless CardGauge supplies it.
        sold_market_value: soldAvailable ? round2(intel.sold.median) : null,
        sold_comp_count: soldAvailable ? intel.sold.count : null,
        sold_low: soldAvailable && intel.sold.low != null ? round2(intel.sold.low) : null,
        sold_high: soldAvailable && intel.sold.high != null ? round2(intel.sold.high) : null,
        sold_source: soldAvailable ? intel.sold.source : null,
      },

      costs: {
        purchase_price: request.asking_price,
        selling_cost: calc.selling_cost,
        shipping_cost: calc.inputs.shipping_cost,
        grading_cost: calc.inputs.grading_cost,
        other_costs: calc.inputs.other_costs,
        sell_fee_rate: calc.inputs.sell_fee_rate,
      },

      risk: {
        score: risk.score,
        label: 'BuyMax Risk Score',
        reasons: risk.reasons,
      },

      confidence: {
        buymax_confidence: confidence,
        market_confidence: activeMarket.market_confidence,
        identity_confidence: intel.identity_confidence,
      },

      // The three numbers you need standing in front of a seller.
      price_ladder: {
        target_offer: calc.target_offer,
        maximum_buy_price: calc.maximum_buy_price,
        walk_away_above: calc.walk_away_above,
        // walk_away_above is the same number as maximum_buy_price. Do not draw
        // it as a third rung.
        ask_below_target: calc.ask_below_target,
      },

      economics: {
        expected_resale: calc.inputs.expected_resale,
        expected_profit_at_asking: calc.expected_profit_at_asking,
        expected_profit_at_target: calc.expected_profit_at_target,
        roi_at_asking: calc.roi_at_asking,
        roi_at_target: calc.roi_at_target,
        roi_at_max: calc.roi_at_max,
        desired_profit: calc.desired_profit,
        risk_adjustment: calc.risk_adjustment,
      },

      decision: {
        estimated_resale: calc.inputs.expected_resale,
        resale_basis: resaleBasis,
        expected_profit: calc.expected_profit_at_asking,
        desired_profit: calc.desired_profit,
        risk_adjustment: calc.risk_adjustment,
        maximum_buy_price: calc.maximum_buy_price,
        target_offer: calc.target_offer,
        walk_away_above: calc.walk_away_above,
        result: decision.result,
        /* The payload rebuilds decision field by field, so anything the
           engine sets and this object does not list is silently dropped.
           no_call was added to decide() and lost exactly here -- the
           client kept rendering "Your call" because the flag never left
           the server. */
        no_call: !!decision.no_call,
        basis: decision.basis || null,
        reason: decision.reason,
        factors: decision.factors,
      },

      providers: {
        used: providersUsed,
        errors: providerErrors,
        // Not an error. The upstream answered and withheld its median.
        sold_refused: soldRefusal,
      },

      meta: {
        elapsed_ms: Date.now() - started,
        assumptions: assumptionsUsed(resaleBasis, cfg, request, calc, risk),
      },

      // Retained for logging and future proprietary signal work, not for display.
      _screen: { accepted: screen.accepted, rejected: screen.rejected },
    };

    payload.explanation = explain({
      payload,
      calc,
      risk,
      market: payload.market,
      decision,
      request,
    });

    // 12. The canonical decision record -- a projection, no new numbers. ----
    payload.decision_record = buildDecisionRecord({
      payload, calc, decision, request, cfg, risk, soldRefusal, floor,
      soldAvailable, sold: intel.sold,
      activeEstimate: activeMarket.active_market_estimate !== null,
    });

    return { status: 200, payload };
  }

  function assumptionsUsed(basis, cfg, request, calc, risk) {
    const a = [];
    const c = (calc && calc.inputs) || {};

    if (basis === 'ebay_active_estimate') {
      a.push(`Active asking prices converted to expected sale price using a ${cfg.market.askToSaleRatio} ratio (assumption, not measured).`);
      a.push('No completed-sale data was used. Active listings are asking prices.');
    }
    if (basis === 'none') a.push('No resale estimate could be produced.');

    if (request.sell_fee_rate === null) {
      a.push(`Selling fees assumed at ${(cfg.costs.sellFeeRate * 100).toFixed(2)}% plus $${cfg.costs.paymentFixed.toFixed(2)}.`);
    }

    // Postage comes out of the ceiling whether or not anyone mentions it. A
    // disclosure that lists the fee rate and omits shipping understates the
    // costs the number was actually built from, and on a cheap card the
    // omission is most of the decision.
    if (
      (request.shipping_cost === null || request.shipping_cost === undefined) &&
      Number.isFinite(c.shipping_cost) &&
      c.shipping_cost > 0
    ) {
      a.push(`Outbound shipping assumed at $${c.shipping_cost.toFixed(2)}.`);
    }

    if (!Number.isFinite(request.desired_profit) && basis !== 'none') {
      a.push(`Desired profit defaulted to ${(cfg.costs.defaultProfitMargin * 100).toFixed(0)}% of expected resale.`);
    }

    // The risk haircut silently lowered the ceiling. Undisclosed, the published
    // assumptions did not add up to the published number.
    if (calc && Number.isFinite(calc.risk_adjustment) && calc.risk_adjustment > 0) {
      a.push(
        `A further $${calc.risk_adjustment.toFixed(2)} withheld from the maximum buy price as a risk haircut ` +
          `(risk score ${risk ? risk.score : '?'} of 100, scaled to at most ${(cfg.risk.maxHaircut * 100).toFixed(0)}% of expected resale).`
      );
    }

    return a;
  }

  module.exports = { runBuyMax };

});

// ==================== categories/card.js ====================
__def('categories/card', function (module, exports, require) {

  /**
   * CARD CATEGORY MODULE
   *
   * All card-specific knowledge lives here. The core never imports this file
   * directly — it is resolved through categories/index.js by request.category.
   *
   * To add a category later, copy this file's exported shape:
   *   { key, label, buildQuery(identity), evaluateListing(listing, identity) }
   */

  const PARALLEL_WORDS = [
    'refractor', 'prizm', 'holo', 'foil', 'shimmer', 'wave', 'mojo', 'cracked ice',
    'gold', 'silver', 'blue', 'red', 'green', 'orange', 'purple', 'pink', 'black',
    'atomic', 'xfractor', 'x-fractor', 'sapphire', 'disco', 'hyper',
    'velocity', 'scope', 'lazer', 'laser', 'pulsar', 'reactive', 'rainbow',
    'negative', 'speckle', 'camo', 'ice', 'genesis', 'aqua', 'teal',
  ];

  const STOPWORDS = new Set([
    'the', 'a', 'and', 'of', 'card', 'cards', 'rc', 'nm', 'mint', 'sports', 'trading', 'base',
  ]);

  const rx = {
    graded: /\b(psa|bgs|sgc|cgc|beckett|hga|isa|ace)\s*-?\s*(10|9\.5|9|8\.5|8|7|6|5|4|3|2|1)\b|\bgem\s*mt\b|\bgraded\b|\bslab(bed)?\b/i,
    lot: /\b(lot|lots|bundle|bulk|you\s*pick|u\s*pick|pick\s*your|choose\s*your|set\s*of\s*\d+|\d+\s*card\s*lot|\(\s*\d+\s*cards?\s*\))\b/i,
    auto: /\b(auto|autograph|autographed|signed|on[- ]card\s*auto)\b/i,
    relic: /\b(relic|patch|jersey|game[- ]used|game[- ]worn|memorabilia|swatch|bat\s*barrel)\b/i,
    reprint: /\b(reprint|re-print|\brp\b|custom|aceo|novelty|proxy|facsimile|fantasy\s*card|art\s*card)\b/i,
    damaged: /\b(damaged|creased|crease|miscut|water\s*damage|poor\s*condition|as[- ]is|for\s*parts)\b/i,
    serial: /(?:^|\s)\/\s?(\d{1,5})\b|\b(\d{1,4})\s?\/\s?(\d{1,5})\b/,
    cardNum: /#\s?([A-Za-z]{0,4}-?\d{1,4}[A-Za-z]?)\b/,
  };

  function tokens(str) {
    return String(str || '')
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((t) => t.length > 2 && !STOPWORDS.has(t) && !/^\d{4}$/.test(t));
  }

  /** Build the marketplace search string for this identity. */
  function buildQuery(identity) {
    const parts = [];
    if (identity.year) parts.push(identity.year);
    if (identity.set) parts.push(identity.set);
    if (identity.player && !String(identity.name || '').toLowerCase().includes(String(identity.player).toLowerCase())) {
      parts.push(identity.player);
    }
    if (identity.name) parts.push(identity.name);
    if (identity.card_number) parts.push(`#${identity.card_number}`);
    if (identity.parallel) parts.push(identity.parallel);
    // De-duplicate: item.name often already contains the year and set.
    const seen = new Set();
    const q = parts
      .join(' ')
      .split(/\s+/)
      .filter((w) => {
        const k = w.toLowerCase();
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      })
      .join(' ')
      .trim();
    return q.slice(0, 100); // eBay Browse q length safety
  }

  /**
   * Local CompGuard rules. Used only when CardGauge's own CompGuard is not
   * reachable. Returns { accept, reason, quality, notes }.
   */
  function evaluateListing(listing, identity) {
    const title = String(listing.title || '');
    const t = title.toLowerCase();
    const notes = [];

    if (!Number.isFinite(listing.price) || listing.price <= 0) {
      return { accept: false, reason: 'malformed_listing_no_price' };
    }

    if (rx.lot.test(t)) return { accept: false, reason: 'multi_card_lot' };
    if (rx.reprint.test(t)) return { accept: false, reason: 'reprint_or_custom' };
    if (rx.damaged.test(t)) return { accept: false, reason: 'damaged_or_miscategorized' };

    const wantsAuto = /\bauto|signed\b/i.test(identity.name || '') || /auto/i.test(identity.parallel || '');
    if (rx.auto.test(t) && !wantsAuto) return { accept: false, reason: 'autograph_when_not_requested' };

    const wantsRelic = /\b(relic|patch|jersey)\b/i.test(`${identity.name || ''} ${identity.parallel || ''}`);
    if (rx.relic.test(t) && !wantsRelic) return { accept: false, reason: 'memorabilia_relic_when_not_requested' };

    // ---- condition: raw vs graded, both directions ----
    const listingGraded = rx.graded.test(t);
    if (identity.condition === 'raw' && listingGraded) {
      return { accept: false, reason: 'graded_slab_when_evaluating_raw' };
    }
    if (identity.condition === 'graded' && !listingGraded) {
      return { accept: false, reason: 'raw_listing_when_evaluating_graded' };
    }
    if (identity.condition === 'graded' && identity.grade) {
      const gradeRx = new RegExp(`\\b(psa|bgs|sgc|cgc)\\s*-?\\s*${String(identity.grade).replace('.', '\\.')}\\b`, 'i');
      if (!gradeRx.test(t)) return { accept: false, reason: 'wrong_grade' };
    }

    // ---- identity token overlap ----
    const want = tokens(`${identity.player || ''} ${identity.name || ''}`);
    if (want.length) {
      const have = new Set(tokens(title));
      const hits = want.filter((w) => have.has(w)).length;
      const ratio = hits / want.length;
      if (ratio < 0.5) return { accept: false, reason: 'unrelated_or_wrong_card' };
      if (ratio < 0.8) notes.push('partial_title_match');
    } else {
      return { accept: false, reason: 'insufficient_identity_information' };
    }

    // ---- card number ----
    if (identity.card_number) {
      const m = title.match(rx.cardNum);
      if (m) {
        const found = m[1].toLowerCase().replace(/^0+/, '');
        const want2 = String(identity.card_number).toLowerCase().replace(/^#/, '').replace(/^0+/, '');
        if (found !== want2) return { accept: false, reason: 'wrong_card_number' };
      } else {
        notes.push('card_number_not_stated_in_title');
      }
    }

    // ---- parallel ----
    // A colour word that is part of the item's own name/set (e.g. "Topps Chrome",
    // "Gold Label") is product naming, not a parallel. Only words the identity
    // does not already contain count as an advertised parallel.
    const identityText = `${identity.name || ''} ${identity.set || ''} ${identity.parallel || ''}`.toLowerCase();
    const listingParallels = PARALLEL_WORDS.filter((p) => t.includes(p) && !identityText.includes(p));
    if (identity.parallel) {
      if (!t.includes(String(identity.parallel).toLowerCase())) {
        return { accept: false, reason: 'wrong_parallel' };
      }
    } else if (listingParallels.length) {
      // Base card expected, listing advertises a parallel.
      return { accept: false, reason: 'parallel_listing_when_base_expected' };
    }

    // ---- serial numbering ----
    const listingSerial = rx.serial.test(title);
    if (identity.serial_number) {
      if (!listingSerial) return { accept: false, reason: 'not_serial_numbered' };
    } else if (listingSerial) {
      return { accept: false, reason: 'numbered_when_not_applicable' };
    }

    return {
      accept: true,
      quality: notes.length ? 'partial' : 'exact',
      notes,
    };
  }

  module.exports = {
    key: 'card',
    label: 'Trading cards',
    buildQuery,
    evaluateListing,
  };

});

// ==================== categories/index.js ====================
__def('categories/index', function (module, exports, require) {

  /**
   * CATEGORY REGISTRY
   *
   * V0.1 supports `card` only. Watches, coins, comics, toys and Hot Wheels are
   * listed here as declared-but-unimplemented so an unsupported request returns
   * an honest error instead of a card answer wearing a different label.
   *
   * To add one: build categories/<key>.js exporting
   *   { key, label, buildQuery(identity), evaluateListing(listing, identity) }
   * then require it below. No core file changes.
   */

  const card = require('./card');

  const implemented = { card };
  const planned = ['watch', 'coin', 'comic', 'toy', 'hotwheels'];

  function getCategory(key) {
    const k = String(key || 'card').toLowerCase();
    if (implemented[k]) return { ok: true, module: implemented[k] };
    if (planned.includes(k)) {
      return { ok: false, error: `Category "${k}" is planned but not implemented in v0.1.` };
    }
    return { ok: false, error: `Unsupported category "${k}". Supported: ${Object.keys(implemented).join(', ')}.` };
  }

  module.exports = { getCategory, implemented, planned };

});

// ==================== providers/base.js ====================
__def('providers/base', function (module, exports, require) {

  /**
   * PROVIDER CONTRACT
   *
   * Every provider exports:
   *   name        : string
   *   kind        : 'intelligence' | 'marketplace'
   *   isConfigured(): boolean
   *   async fetch(ctx): Promise<object>   // provider-shaped payload, normalized by the provider itself
   *
   * The core never learns how a provider gets its data. Adding a provider means
   * adding a file here and passing it in the providers array — no core changes.
   */

  function withTimeout(promise, ms, label) {
    let timer;
    const timeout = new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
    });
    return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
  }

  async function safeJson(res) {
    const text = await res.text();
    try {
      return JSON.parse(text);
    } catch (e) {
      throw new Error(`Non-JSON response (${res.status}): ${text.slice(0, 200)}`);
    }
  }

  module.exports = { withTimeout, safeJson };

});

// ==================== providers/cardgauge.js ====================
__def('providers/cardgauge', function (module, exports, require) {

  /**
   * CARDGAUGE PROVIDER
   *
   * BuyMax is a CUSTOMER of CardGauge, not a fork of it. This file is the only
   * place BuyMax knows CardGauge exists. It calls CardGauge over HTTP exactly as
   * an external customer eventually will, so nothing here has to change when
   * CardGauge becomes a standalone intelligence API.
   *
   * Nothing is duplicated: identification, CompGuard, grade ladder and sold
   * comps all stay in CardGauge. If a path is not configured, that capability is
   * reported unavailable and BuyMax degrades honestly rather than guessing.
   */

  const { withTimeout, safeJson } = require('./base');

  function makeCardGaugeProvider(cfg, deps = {}) {
    const fetchImpl = deps.fetch || global.fetch;
    const c = cfg.cardgauge;

    const isConfigured = () => Boolean(c.base && (c.identifyPath || c.marketPath));

    async function call(path, payload) {
      const url = `${c.base.replace(/\/$/, '')}${path}`;
      const headers = { 'Content-Type': 'application/json' };
      if (c.apiKey) headers['x-api-key'] = c.apiKey;
      const res = await withTimeout(
        fetchImpl(url, { method: 'POST', headers, body: JSON.stringify(payload) }),
        c.timeoutMs,
        `CardGauge ${path}`
      );
      if (!res.ok) throw new Error(`CardGauge ${path} returned ${res.status}`);
      return safeJson(res);
    }

    /**
     * @returns {{
     *   available: boolean,
     *   identity: object|null,
     *   identity_confidence: number|null,
     *   sold: { median: number|null, count: number|null, window_days: number|null, source: string }|null,
     *   grade_ladder: object|null,
     *   compguard: function|null,
     *   errors: string[]
     * }}
     */
    async function fetchIntelligence(ctx) {
      const out = {
        available: false,
        identity: null,
        identity_confidence: null,
        sold: null,
        grade_ladder: null,
        compguard: null,
        errors: [],
      };

      if (!isConfigured()) {
        out.errors.push('CardGauge provider not configured (CARDGAUGE_API_BASE / paths missing)');
        return out;
      }

      if (c.identifyPath) {
        try {
          const r = await call(c.identifyPath, { item: ctx.item, category: ctx.category });
          const body = r && (r.data || r.result || r);
          out.identity = body.identity || body.card || body || null;
          const conf = body.identity_confidence ?? body.confidence ?? (out.identity && out.identity.confidence);
          out.identity_confidence = Number.isFinite(Number(conf)) ? Number(conf) : null;
          out.available = true;
        } catch (err) {
          out.errors.push(`identify: ${err.message}`);
        }
      }

      if (c.marketPath) {
        try {
          const r = await call(c.marketPath, { item: ctx.item, category: ctx.category });
          const body = r && (r.data || r.result || r);
          const sold = body.sold || body.market || body;
          const med = sold.median ?? sold.sold_median ?? sold.median_price ?? null;
          out.sold = Number.isFinite(Number(med))
            ? {
                median: Number(med),
                count: Number.isFinite(Number(sold.count)) ? Number(sold.count) : null,
                window_days: Number.isFinite(Number(sold.window_days)) ? Number(sold.window_days) : null,
                source: 'cardgauge_sold',
              }
            : null;
          out.grade_ladder = body.grade_ladder || body.ladder || null;
          out.available = true;
        } catch (err) {
          out.errors.push(`market: ${err.message}`);
        }
      }

      return out;
    }

    return {
      name: 'cardgauge',
      kind: 'intelligence',
      isConfigured,
      fetch: fetchIntelligence,
    };
  }

  module.exports = { makeCardGaugeProvider };

});

// ==================== providers/local.js ====================
__def('providers/local', function (module, exports, require) {

  /**
   * LOCAL CARDGAUGE PROVIDER
   *
   * Use this when BuyMax is mounted INSIDE stock-card-api — the service that
   * already fetches and caches sold comps. There is no HTTP hop, no
   * UPSTREAM_PRICE_PATH and no second copy of the pricing logic: BuyMax calls
   * the functions that already exist in that codebase.
   *
   * You supply the hooks. Nothing here guesses at your function names.
   *
   *   const { makeLocalProvider } = require('./buymax/providers/local');
   *
   *   const provider = makeLocalProvider(config, {
   *     // REQUIRED. Return whatever your existing comp function returns —
   *     // the mapper below handles the common shapes.
   *     getSoldComps: async (identity) => await getPricingForCard(identity),
   *
   *     // OPTIONAL. Your existing identification, if you have it as a function.
   *     getIdentity: async (identity) => await identifyCard(identity),
   *
   *     // OPTIONAL. Your existing CompGuard. If supplied, BuyMax uses it and
   *     // skips its own fallback matching entirely.
   *     compguard: (listing, identity) => compGuardCheck(listing, identity),
   *
   *     // OPTIONAL. Override the field mapping if your shape is unusual.
   *     mapSold: (raw) => ({ median: raw.myMedian, count: raw.myCount }),
   *   });
   *
   * If getSoldComps throws or returns nothing usable, the provider reports
   * unavailable and the engine returns REVIEW. It never substitutes a guess.
   */

  const num = (v) => {
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? n : null;
  };

  /**
   * Pulls a sold-comp shape out of whatever the upstream function returned.
   * Covers the field names these codebases usually use; override with mapSold
   * if yours differs.
   */
  function defaultMapSold(raw) {
    if (!raw || typeof raw !== 'object') return null;
    const body = raw.data || raw.result || raw.pricing || raw;

    const median =
      num(body.soldMedian) ?? num(body.sold_median) ?? num(body.median) ??
      num(body.medianPrice) ?? num(body.median_price) ??
      num(body.marketValue) ?? num(body.market_value) ?? null;

    if (median === null) return null;

    const countRaw =
      body.soldCount ?? body.sold_count ?? body.count ??
      body.compCount ?? body.comp_count ??
      (Array.isArray(body.sales) ? body.sales.length : null) ??
      (Array.isArray(body.sold) ? body.sold.length : null);

    const low = num(body.soldLow) ?? num(body.sold_low) ?? num(body.low) ?? num(body.min) ?? null;
    const high = num(body.soldHigh) ?? num(body.sold_high) ?? num(body.high) ?? num(body.max) ?? null;

    return {
      median,
      count: Number.isFinite(Number(countRaw)) ? Number(countRaw) : null,
      low,
      high,
      window_days: Number(body.windowDays ?? body.window_days ?? body.days) || null,
      source: 'cardgauge_sold',
    };
  }

  function makeLocalProvider(cfg, hooks = {}) {
    if (typeof hooks.getSoldComps !== 'function') {
      throw new Error('makeLocalProvider requires a getSoldComps(identity) function');
    }
    const mapSold = hooks.mapSold || defaultMapSold;

    async function fetchIntelligence(ctx) {
      const out = {
        available: false,
        identity: null,
        identity_confidence: null,
        sold: null,
        grade_ladder: null,
        compguard: typeof hooks.compguard === 'function' ? hooks.compguard : null,
        errors: [],
      };

      if (typeof hooks.getIdentity === 'function') {
        try {
          const id = await hooks.getIdentity(ctx.item);
          const body = (id && (id.data || id.result || id)) || null;
          out.identity = (body && (body.identity || body.card || body)) || null;
          const conf = body && (body.identity_confidence ?? body.confidence ?? body.matchConfidence);
          out.identity_confidence = Number.isFinite(Number(conf)) ? Number(conf) : null;
          out.available = true;
        } catch (err) {
          out.errors.push(`identify: ${err.message}`);
        }
      }

      try {
        const raw = await hooks.getSoldComps(ctx.item);

        /* A REFUSAL IS NOT AN OUTAGE, AND out.errors IS THE OUTAGE CHANNEL.

           The comment that used to sit here was right -- a refusal is a
           finding -- and then filed it in the one place reserved for
           things that broke. Everything downstream reads out.errors as
           provider failure: risk adds providerDegraded, confidence
           subtracts degradedProviderPenalty, decide() forces REVIEW, and
           explain prints 'a data source failed, so this analysis is
           running on less information than usual'.

           Nothing failed. The scanner looked, found a contaminated pool,
           and declined to publish the median -- which is the behaviour the
           whole product is built on. Scoring that as an outage told the
           person their data source was down while the page above showed a
           hundred completed sales, and cost 20 risk points and 25
           confidence points for being careful.

           Its own channel, so the engine can weigh it as what it is and
           say the actual reason instead of a generic failure line. */
        if (raw && (raw.refused === true || raw.refusal_reason)) {
          out.sold_refused = {
            reason: raw.refusal_reason || 'contaminated comp pool',
            kind: typeof raw.refusal_kind === 'string' ? raw.refusal_kind : null,
            sold_count: Number(raw.sold_count) || 0,
          };
          out.available = true;
          return out;
        }

        const sold = mapSold(raw);
        if (sold) {
          out.sold = sold;
          out.available = true;
        } else {
          out.errors.push('sold comps: upstream returned no usable median');
        }
      } catch (err) {
        out.errors.push(`sold comps: ${err.message}`);
      }

      return out;
    }

    return {
      name: 'cardgauge',
      kind: 'intelligence',
      isConfigured: () => true,
      fetch: fetchIntelligence,
      _defaultMapSold: defaultMapSold,
    };
  }

  module.exports = { makeLocalProvider, defaultMapSold };

});

// ==================== providers/ebay.js ====================
__def('providers/ebay', function (module, exports, require) {

  /**
   * EBAY PROVIDER — official Browse API, ACTIVE listings only.
   *
   * No sold comps. No scraping. No undocumented endpoints. Browse does not expose
   * completed sales to this application, and this file does not pretend otherwise:
   * everything it returns is an ASKING price.
   *
   * Known Browse limitations, documented rather than papered over:
   *   - watch_count is not returned by item_summary; it is always null here.
   *   - bid_count is present only on auction summaries and can be absent.
   *   - item aspects are thin in search results; full aspects need item detail.
   */

  const { withTimeout, safeJson } = require('./base');

  function makeEbayProvider(cfg, deps = {}) {
    const fetchImpl = deps.fetch || global.fetch;
    const e = cfg.ebay;
    let cachedToken = null; // { token, expiresAt }

    const isConfigured = () => Boolean(e.clientId && e.clientSecret);

    async function getToken() {
      if (cachedToken && cachedToken.expiresAt > Date.now() + 60000) return cachedToken.token;
      const basic = Buffer.from(`${e.clientId}:${e.clientSecret}`).toString('base64');
      const res = await withTimeout(
        fetchImpl(`${e.apiBase}/identity/v1/oauth2/token`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            Authorization: `Basic ${basic}`,
          },
          body: 'grant_type=client_credentials&scope=' + encodeURIComponent('https://api.ebay.com/oauth/api_scope'),
        }),
        e.timeoutMs,
        'eBay token'
      );
      const body = await safeJson(res);
      if (!res.ok || !body.access_token) {
        throw new Error(`eBay auth failed (${res.status}): ${body.error_description || body.error || 'unknown'}`);
      }
      cachedToken = {
        token: body.access_token,
        expiresAt: Date.now() + (Number(body.expires_in || 7200) * 1000),
      };
      return cachedToken.token;
    }

    function normalizeItem(it) {
      const price = it.price && it.price.value !== undefined ? Number(it.price.value) : null;
      const formats = Array.isArray(it.buyingOptions) ? it.buyingOptions : [];
      const format = formats.includes('AUCTION') ? 'AUCTION' : (formats.includes('FIXED_PRICE') ? 'FIXED_PRICE' : (formats[0] || null));
      return {
        source: 'ebay',
        listing_id: it.itemId || null,
        title: it.title || null,
        price: Number.isFinite(price) ? price : null,
        currency: (it.price && it.price.currency) || null,
        condition: it.condition || it.conditionId || null,
        buying_format: format,
        bid_count: Number.isFinite(Number(it.bidCount)) ? Number(it.bidCount) : null,
        watch_count: null, // not exposed by Browse item_summary
        ends_at: it.itemEndDate || null,
        seller: (it.seller && it.seller.username) || null,
        seller_feedback: (it.seller && Number(it.seller.feedbackPercentage)) || null,
        categories: Array.isArray(it.categories) ? it.categories.map((c) => c.categoryName).filter(Boolean) : [],
        authenticity_guarantee: Boolean(it.qualifiedPrograms && it.qualifiedPrograms.includes('AUTHENTICITY_GUARANTEE')),
        image: (it.image && it.image.imageUrl) || null,
        url: it.itemWebUrl || null,
      };
    }

    /** @returns {{ available, listings: object[], query: string|null, errors: string[] }} */
    async function fetchListings(ctx) {
      const out = { available: false, listings: [], query: null, errors: [] };

      if (!isConfigured()) {
        out.errors.push('eBay provider not configured (EBAY_CLIENT_ID / EBAY_CLIENT_SECRET missing)');
        return out;
      }

      const q = ctx.query;
      if (!q) {
        out.errors.push('No usable search query could be built from the item identity');
        return out;
      }
      out.query = q;

      let token;
      try {
        token = await getToken();
      } catch (err) {
        out.errors.push(err.message);
        return out;
      }

      const params = new URLSearchParams({
        q,
        limit: String(cfg.market.fetchLimit),
        filter: 'buyingOptions:{FIXED_PRICE|AUCTION}',
      });

      const headers = {
        Authorization: `Bearer ${token}`,
        'X-EBAY-C-MARKETPLACE-ID': e.marketplaceId,
      };
      if (e.campaignId) {
        headers['X-EBAY-C-ENDUSERCTX'] = `affiliateCampaignId=${e.campaignId},affiliateReferenceId=buymax`;
      }

      try {
        const res = await withTimeout(
          fetchImpl(`${e.apiBase}/buy/browse/v1/item_summary/search?${params.toString()}`, { headers }),
          e.timeoutMs,
          'eBay Browse search'
        );
        const body = await safeJson(res);
        if (res.status === 429) {
          out.errors.push('eBay rate limit reached');
          return out;
        }
        if (!res.ok) {
          const msg = (body.errors && body.errors[0] && body.errors[0].message) || `HTTP ${res.status}`;
          out.errors.push(`eBay Browse error: ${msg}`);
          return out;
        }
        out.available = true;
        out.listings = (body.itemSummaries || []).map(normalizeItem).filter((l) => l.listing_id);
      } catch (err) {
        out.errors.push(`eBay Browse request failed: ${err.message}`);
      }

      return out;
    }

    return {
      name: 'ebay_active',
      kind: 'marketplace',
      isConfigured,
      fetch: fetchListings,
      _normalizeItem: normalizeItem,
    };
  }

  module.exports = { makeEbayProvider };

});

// ==================== db/log.js ====================
__def('db/log', function (module, exports, require) {

  /**
   * BUYMAX ANALYSIS LOGGING
   *
   * Optional. If no pg pool is supplied at mount time, logging is skipped and the
   * engine still answers. A logging failure must never fail an analysis.
   *
   * No personal information is stored: no user id, no ip, no email.
   */

  async function logAnalysis(pool, cfg, payload, request) {
    if (!pool || !cfg.logging.enabled) return { logged: false, reason: 'logging_disabled' };

    const cap = cfg.logging.maxStoredListings;
    const accepted = (payload._screen.accepted || []).slice(0, cap).map((l) => ({
      listing_id: l.listing_id, title: l.title, price: l.price, format: l.buying_format, quality: l.match_quality,
    }));
    const rejected = (payload._screen.rejected || []).slice(0, cap);

    const sql = `
      INSERT INTO ${cfg.logging.table}
        (engine_version, category, item_identity, query_used, asking_price,
         providers_used, provider_errors,
         listings_found, listings_accepted, listings_rejected, rejection_reasons,
         accepted_listings, rejected_listings,
         active_market, sold_market_value,
         risk_score, risk_reasons, confidence,
         estimated_resale, maximum_buy_price, decision, decision_reason)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22)
      RETURNING id`;

    const values = [
      payload.engine.version,
      payload.category,
      JSON.stringify(payload.item),
      payload.query_used,
      request.asking_price,
      payload.providers.used,
      JSON.stringify(payload.providers.errors),
      payload.market.listings_found,
      payload.market.listings_accepted,
      payload.market.listings_rejected,
      JSON.stringify(payload.market.rejection_reasons),
      JSON.stringify(accepted),
      JSON.stringify(rejected),
      JSON.stringify(payload.market),
      payload.market.sold_market_value,
      payload.risk.score,
      JSON.stringify(payload.risk.reasons),
      payload.confidence.buymax_confidence,
      payload.decision.estimated_resale,
      payload.decision.maximum_buy_price,
      payload.decision.result,
      payload.decision.reason,
    ];

    try {
      const r = await pool.query(sql, values);
      return { logged: true, id: r.rows[0] && r.rows[0].id };
    } catch (err) {
      return { logged: false, reason: err.message };
    }
  }

  /** Outcome feedback, supplied by the user only. Never inferred, never faked. */
  async function logOutcome(pool, cfg, id, outcome) {
    if (!pool) return { ok: false, reason: 'no_database' };
    const sql = `
      UPDATE ${cfg.logging.table}
         SET outcome_reported_at = NOW(),
             outcome_action     = $2,
             outcome_paid_price = $3,
             outcome_sold_price = $4
       WHERE id = $1
       RETURNING id`;
    try {
      const r = await pool.query(sql, [id, outcome.action || null, outcome.paid_price ?? null, outcome.sold_price ?? null]);
      return { ok: r.rowCount > 0 };
    } catch (err) {
      return { ok: false, reason: err.message };
    }
  }

  module.exports = { logAnalysis, logOutcome };

});

// ==================== index.js ====================
__def('index', function (module, exports, require) {

  /**
   * BUYMAX MOUNT POINT
   *
   * Add to the existing server.js with two lines and nothing else:
   *
   *   const { mountBuyMax } = require('./buymax');
   *   mountBuyMax(app, { pool });          // pool optional
   *
   * It registers only new routes. No existing route, response shape or table is
   * touched.
   */

  const config = require('./config');
  const { runBuyMax } = require('./core/engine');
  const { makeCardGaugeProvider } = require('./providers/cardgauge');
  const { makeEbayProvider } = require('./providers/ebay');
  const { makeLocalProvider } = require('./providers/local');
  const { logAnalysis, logOutcome } = require('./db/log');

  function buildProviders(cfg, deps, opts = {}) {
    return {
      // When mounted inside stock-card-api, pass { local: { getSoldComps } } and
      // BuyMax calls that service's own comp functions instead of making an HTTP
      // hop back to itself.
      cardgauge: opts.local
        ? makeLocalProvider(cfg, opts.local)
        : makeCardGaugeProvider(cfg, deps),
      ebay: makeEbayProvider(cfg, deps),
    };
  }

  function router(opts = {}) {
    const express = require('express'); // required lazily so the engine can run without it
    const cfg = opts.config || config;
    const pool = opts.pool || null;

    /* STORE HOOKS, RATHER THAN A SECOND DATABASE CLIENT.

       logAnalysis and logOutcome were written against node-postgres and
       need an opts.pool. No pool has ever been passed, and pg is not a
       dependency of this service -- so every decision BuyMax has made
       since it shipped went unrecorded, and /buymax/outcome has had
       nothing to update.

       Rather than add pg, the host supplies two functions. server.js
       already holds a service-role Supabase client that writes every
       other table here; it passes that capability in the same way it
       passes getSoldComps. buymax.js keeps knowing nothing about how
       storage works, and still detaches cleanly.

       opts.pool still works if it is ever wanted. Hooks win when both
       are present because the hook is the deliberate choice. */
    const store = opts.store || null;
    const providers = opts.providers || buildProviders(cfg, opts.deps || {}, opts);
    const r = express.Router();

    r.post('/buymax', express.json({ limit: '256kb' }), async (req, res) => {
      let result;
      try {
        result = await runBuyMax(req.body, { cfg, providers });
      } catch (err) {
        // Never return a fake BUY/PASS when the engine itself failed.
        return res.status(500).json({
          success: false,
          engine: cfg.engine,
          error: 'engine_error',
          details: [err.message],
          decision: { result: 'REVIEW', reason: 'BuyMax failed before a decision could be made.' },
          decision_record: require('./core/record').noDecisionRecord('BuyMax failed before a decision could be made.'),
        });
      }

      const payload = result.payload;
      /* PREVIEW (22 Sept): the scanner asks "what should I pay" for every
         result before anybody types a price, with asking_price 0. That is
         not a decision somebody made, so it is not logged -- the outcome
         table stays a record of real asks. */
      const preview = !!(req.body && req.body.preview === true);
      if (preview && payload.meta) payload.meta.preview = true;
      if (result.status === 200 && (store || pool) && !preview) {
        const request = { asking_price: payload.costs.purchase_price };
        /* Logging must never cost somebody their answer. If the write
           fails the analysis still returns, just without an id -- and
           the receipt hides its buttons when there is no id, because
           there is nothing for them to report against. */
        let logged = { id: null };
        try {
          logged = store
            ? await store.logAnalysis(payload, request)
            : await logAnalysis(pool, cfg, payload, request);
        } catch (e) {
          console.log('[buymax] analysis not logged: ' + (e && e.message));
        }
        payload.meta.analysis_id = logged && logged.id ? logged.id : null;
      }
      if (payload._screen) delete payload._screen;

      res.status(result.status).json(payload);
    });

    // Outcome feedback — user-reported only.
    r.post('/buymax/outcome', express.json(), async (req, res) => {
      const { analysis_id, action, paid_price, sold_price } = req.body || {};
      if (!analysis_id) return res.status(400).json({ success: false, error: 'analysis_id required' });
      const body = { action, paid_price, sold_price };
      const out = store
        ? await store.logOutcome(analysis_id, body)
        : await logOutcome(pool, cfg, analysis_id, body);
      res.status(out.ok ? 200 : 400).json({ success: out.ok, error: out.reason || null });
    });

    r.get('/buymax/health', (req, res) => {
      const providersStatus = {
        cardgauge: providers.cardgauge ? providers.cardgauge.isConfigured() : false,
        ebay_active: providers.ebay ? providers.ebay.isConfigured() : false,
      };
      res.json({
        success: true,
        engine: cfg.engine,
        providers: providersStatus,
        database: Boolean(pool),
        categories: { implemented: ['card'], planned: ['watch', 'coin', 'comic', 'toy', 'hotwheels'] },
        /* THE HEALTH ENDPOINT CONTRADICTED THE ENGINE.

           uses_sold_comps: false was true of v0.1 before the CardGauge
           adapter existed. It has not been true for a while: the
           adapter supplies completed sales, decide() REFUSES outright
           when they are withheld, and since 12 Sept it reads the median
           from soldRaw -- the CompGuard-filtered base pool.

           A health check that reports the opposite of what the engine
           does is worse than no health check. Anyone debugging from it
           would look in the wrong place first.

           Reported rather than hard-coded, so it cannot drift again:
           if the provider stops supplying sold data, this goes false on
           its own. */
        uses_sold_comps: providersStatus.cardgauge,
        sold_comps_mode: providersStatus.cardgauge ? 'provider_supplied' : 'unavailable',
        note: providersStatus.cardgauge
          ? 'Completed sales come from the CardGauge provider. Active eBay listings are used for the resale estimate only, and a decision is refused when sold comps are withheld.'
          : 'CardGauge provider not configured \u2014 no completed-sale data available, so decisions will refuse rather than price from asking prices alone.',
      });
    });

    return r;
  }

  function mountBuyMax(app, opts = {}) {
    app.use(opts.basePath || '/api', router(opts));
    return app;
  }

  const decisionRecord = require('./core/record');
  module.exports = { mountBuyMax, router, runBuyMax, config, buildProviders, makeLocalProvider, decisionRecord };

});

// ==================== exports ====================
module.exports = __require('index')('./index');
