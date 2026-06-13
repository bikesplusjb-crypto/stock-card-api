// ============================================================
// CARDGAUGE TIME MACHINE — BACKEND ADDITIONS for server.js
// ============================================================
//
// This adds daily price-snapshot logging to your EXISTING cron
// jobs. It does NOT replace anything — you add one helper
// function, then one line inside each of your three refresh
// loops. Your current logic stays exactly as-is.
//
// ============================================================


// ---- STEP 1 ----------------------------------------------------------------
// Add this helper function ONCE, anywhere near your other helpers
// (e.g. just below `refreshWatchlistPrices` is fine).

async function logPriceSnapshot(cardName, source, price) {
  // Only log real, positive prices. Skip zeros/failures so the
  // history stays clean (a $0 day would wreck a chart).
  if (!supabaseAdmin || !cardName || !(price > 0)) return;
  try {
    // upsert on the unique (card_name, source, recorded_on) index:
    // one snapshot per card per source per day. Re-runs are no-ops.
    await supabaseAdmin
      .from("price_history")
      .upsert(
        {
          card_name: cardName,
          source: source,
          price: price,
          recorded_at: new Date().toISOString(),
          recorded_on: new Date().toISOString().slice(0, 10)
        },
        { onConflict: "card_name,source,recorded_on", ignoreDuplicates: true }
      );
  } catch (e) {
    // Never let logging break the main refresh. Just note it.
    console.error("[price-history] log failed for", cardName, ":", e.message);
  }
}


// ---- STEP 2 ----------------------------------------------------------------
// In refreshWatchlistPrices(), right AFTER you compute `newPrice`
// and BEFORE/AFTER the update call, add ONE line:
//
//     const newPrice = safeNumber(market.avgPrice, 0);
//     await logPriceSnapshot(item.card_name, "watchlist", newPrice);   // <-- ADD THIS
//
// (place it just under the newPrice line — order doesn't matter much,
//  but logging before the update is cleanest)


// ---- STEP 3 ----------------------------------------------------------------
// In refreshHotColdPrices(), you already skip when newPrice <= 0.
// AFTER the skip check, add ONE line:
//
//     if (newPrice <= 0) { ...existing skip... continue; }
//     await logPriceSnapshot(card.card_name, "hotcold", newPrice);     // <-- ADD THIS


// ---- STEP 4 ----------------------------------------------------------------
// In refreshPokemonPrices(), same spot, AFTER the skip check:
//
//     if (newPrice <= 0) { ...existing skip... continue; }
//     await logPriceSnapshot(card.card_name, "pokemon", newPrice);     // <-- ADD THIS


// ---- STEP 5 (optional but recommended) -------------------------------------
// A read endpoint so the Time Machine page can fetch one card's history.
// Add this with your other app.get routes.

app.get("/api/card-history", async (req, res) => {
  try {
    if (!supabaseAdmin) {
      return res.status(503).json({ success: false, error: "History not available" });
    }
    const cardName = req.query.card;
    if (!cardName) {
      return res.status(400).json({ success: false, error: "card query param required" });
    }

    const { data, error } = await supabaseAdmin
      .from("price_history")
      .select("price, recorded_on")
      .eq("card_name", cardName)
      .order("recorded_on", { ascending: true });

    if (error) throw error;

    const points = (data || []).map(r => ({ date: r.recorded_on, price: Number(r.price) }));

    let summary = null;
    if (points.length >= 2) {
      const first = points[0];
      const last = points[points.length - 1];
      const change = last.price - first.price;
      const pct = first.price > 0 ? +(((last.price / first.price) - 1) * 100).toFixed(1) : 0;
      summary = {
        firstDate: first.date, firstPrice: first.price,
        lastDate: last.date, lastPrice: last.price,
        change: +change.toFixed(2), pct,
        days: points.length
      };
    }

    res.json({ success: true, card: cardName, points, summary });
  } catch (e) {
    res.status(500).json({ success: false, error: "History lookup failed", details: e.message });
  }
});
