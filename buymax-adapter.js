/* ══════════════════════════════════════════════════════════════
   BUYMAX ADAPTER — step 4 of the wiring, written out

   The handoff calls this "the only real work", and it is, but not for
   the reason it gives. Finding the function is easy: getSoldComps is
   already a named function in server.js and already returns a median.

   The work is that BuyMax's provider and CardGauge's comp function
   disagree about how a REFUSAL is expressed, and nothing in either
   codebase makes that visible.

   providers/local.js checks:

       if (raw && (raw.refused === true || raw.refusal_reason)) { ... }

   getSoldComps never sets either field. It reports a bad pool as
   soldContaminated: true, and a pool too thin to trust as
   soldLimited: true, with the median still populated in both cases.

   So wired naively, a contaminated pool arrives as an ordinary answer
   with a number attached, and BuyMax prices a buy ceiling off comps
   the scanner itself refuses to publish. That is worse than having no
   buy ceiling at all: the refusal is the whole reason to trust any of
   this, and it would be silently discarded at the one seam where two
   systems meet.

   This adapter is the translation. It is deliberately a separate file
   rather than an inline arrow function in the mount call, because it
   holds a real decision — what counts as a refusal — and that decision
   should be readable, not buried in an options object.
   ══════════════════════════════════════════════════════════════ */

'use strict';

/* Every card BuyMax asks about arrives as an identity object. The
   scanner's comp function wants the query string it would have built
   itself, so this reassembles one in the same order the scanner uses:
   year, brand, set, player, number, parallel. Anything missing is
   simply left out rather than guessed at. */
function identityToQuery(item) {
  if (!item) return '';
  if (item.name && String(item.name).trim()) return String(item.name).trim();

  const parts = [
    item.year,
    item.brand,
    item.set,
    item.player,
    item.card_number ? '#' + String(item.card_number).replace(/^#/, '') : '',
    item.parallel
  ];
  return parts
    .map(p => (p == null ? '' : String(p).trim()))
    .filter(Boolean)
    .join(' ');
}

/**
 * Build the getSoldComps hook BuyMax expects.
 *
 * @param {Function} soldCompsFn - server.js's own getSoldComps(query, askMedian, compact)
 */
function makeCardGaugeHook(soldCompsFn) {
  if (typeof soldCompsFn !== 'function') {
    throw new Error('makeCardGaugeHook needs getSoldComps');
  }

  return async function getSoldCompsForBuyMax(item) {
    const query = identityToQuery(item);
    if (!query) {
      return { refused: true, refusal_reason: 'no card identity to search on' };
    }

    /* askMedian is passed as 0 deliberately. Inside getSoldComps it is
       only used to sanity-check sold against ask, and BuyMax does its
       own active-market work separately -- feeding it a number here
       would have two systems applying the same guard twice with
       different thresholds. */
    const raw = await soldCompsFn(query, 0);

    /* No answer at all. Distinct from a refusal: nothing came back,
       rather than something came back and was rejected. */
    if (!raw) {
      return { refused: true, refusal_reason: 'no sold comps returned' };
    }

    /* THE RATE LIMIT IS NOT A REFUSAL EITHER, AND MUST NOT READ AS ONE.

       getSoldComps returns { rateLimited: true } when the daily
       allowance is spent. Treating that as "we looked and the data is
       bad" would be a lie -- we never looked. It is reported as its
       own reason so a shop seeing NO CALL all afternoon can tell an
       exhausted allowance from a genuinely untradeable card. */
    if (raw.rateLimited) {
      return { refused: true, refusal_reason: 'comp lookup rate limited — allowance spent' };
    }

    /* THE TWO REAL REFUSALS, TRANSLATED.

       Both arrive from getSoldComps with a median still attached, and
       both mean the scanner declined to publish that median. Passing
       the number through would let BuyMax quote a ceiling built on
       sales the rest of the app will not stand behind.

       Contaminated and limited are kept distinct rather than collapsed
       into one "bad data" flag, because they are different findings
       and a shop deserves to know which: contaminated means the pool
       describes more than one card, limited means there are too few
       clean sales of the right one. */
    if (raw.soldContaminated) {
      return {
        refused: true,
        refusal_reason: 'comp pool contaminated — the recent sales describe more than one version of this card',
        sold_count: raw.soldCount || 0
      };
    }
    if (raw.soldLimited) {
      return {
        refused: true,
        refusal_reason: 'too few clean sales of this exact card to price it',
        sold_count: raw.soldCount || 0
      };
    }

    /* THE CEILING MUST REST ON THE SAME SALES THE SCANNER SHOWS.

       This read raw.soldMedian -- the headline number, computed before
       CompGuard's base filter. Everywhere else in the app the median is
       soldRaw.median whenever the base pool has three or more sales,
       falling back to soldMedian only when it does not:
       refreshWatchlistPrices picks that way, and so does the daily
       price-history write.

       Measured 12 Sept on "2024 Topps Shohei Ohtani": soldMedian 13,
       soldRaw.median 15. A shop would have read $15 on the scanner and
       been handed a buy ceiling built off $13, with nothing on either
       screen accounting for the gap. Two numbers for one card is the
       failure this whole codebase spends its refusals avoiding.

       soldRaw is the pool the refusals are computed against too, so
       taking the median from anywhere else means the guard and the
       number it guards describe different sets of sales. */
    const usedRaw = !!(raw.soldRaw && raw.soldRaw.count >= 3 && raw.soldRaw.median);
    const median  = Number(usedRaw ? raw.soldRaw.median : raw.soldMedian);
    if (!isFinite(median) || median <= 0) {
      return { refused: true, refusal_reason: 'no usable sold median' };
    }

    /* DEPTH HAS TO MATCH THE MEDIAN, NOT THE SEARCH.

       soldCount is everything the search returned -- on that same
       Ohtani, 100, including the graded copies and other parallels
       CompGuard threw out. Reporting it beside a median built from 33
       base sales overstates the evidence by a factor of three, in the
       one field BuyMax uses to judge how much to trust the number.

       The full search count rides along as sold_count_all so nothing
       is hidden; it is just no longer the figure that reads as depth. */
    const baseCount = Number(
      (usedRaw ? raw.soldRaw.count : 0) || raw.soldCountUsed || raw.soldCount || 0);

    /* Field names the provider already recognises -- it maps
       soldMedian, sold_median, median and medianPrice, so soldMedian
       and soldCount pass through without a custom mapSold. basis
       rides along because a raw median and a graded median are not
       interchangeable, and BuyMax's own explain layer can say which
       one the ceiling rests on. */
    return {
      soldMedian: median,
      soldCount: baseCount,
      sold_count_all: Number(raw.soldCount) || 0,
      basis: raw.soldBasis || 'raw',
      /* Passed through untouched so the ladder BuyMax builds can show
         graded rungs where they exist, without re-querying. */
      soldGradeBreakdown: Array.isArray(raw.soldGradeBreakdown) ? raw.soldGradeBreakdown : [],
      soldUrl: raw.soldUrl || null
    };
  };
}

module.exports = { makeCardGaugeHook, identityToQuery };
