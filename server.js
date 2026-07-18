// =============================================================
//  CARDSTOCK API v6 — Yahoo stocks + REAL CardGauge card history
//  Card side now reads your existing price_history table
//  (the CardGauge Time Machine data — months of real snapshots).
//
//  ENV VARS on Render: SUPABASE_URL, SUPABASE_SERVICE
//  (LOG_SECRET no longer needed — CardGauge already logs the data.)
//
//  Reads table: price_history (card_name, price, recorded_on, source)
//  Reads/writes: cardstock_stock_cache (stock cache)
// =============================================================

const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');

const app = express();
app.use(cors());
app.use(express.json());

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE);
const CACHE_HOURS = 12;

function indexTo100(points) {
  if (!points.length) return [];
  const base = points[0].price;
  if (!base) return points.map(p => ({ t: p.t, v: 100 }));
  return points.map(p => ({ t: p.t, v: +((p.price / base) * 100).toFixed(2) }));
}
function wd(w){ if(w==='3M')return 90; if(w==='6M')return 182; return 365; }
function yRange(w){ if(w==='3M')return '3mo'; if(w==='6M')return '6mo'; return '1y'; }

app.get('/', (req, res) => res.json({ success: true, app: 'CardStock API v6', status: 'online' }));

// ---- CARD LIST (distinct card_names from real price_history) ----
app.get('/api/card-list', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('price_history')
      .select('card_name')
      .order('card_name', { ascending: true });
    if (error) throw error;
    const seen = {};
    const keys = [];
    (data || []).forEach(r => { if (r.card_name && !seen[r.card_name]) { seen[r.card_name] = 1; keys.push(r.card_name); } });
    return res.json({ success: true, cards: keys });
  } catch (e) {
    console.error('card-list error:', e);
    return res.status(500).json({ success: false, error: 'card list failed' });
  }
});

// ---- CARD HISTORY (from real price_history) ----
app.get('/api/card-history', async (req, res) => {
  try {
    const query = (req.query.query || '').trim();
    if (!query) return res.status(400).json({ success: false, error: 'query required' });
    const cutoffDate = new Date(Date.now() - wd((req.query.window||'12M').toUpperCase()) * 86400 * 1000)
      .toISOString().slice(0, 10); // YYYY-MM-DD to match recorded_on (date)

    const { data, error } = await supabase
      .from('price_history')
      .select('recorded_on, price')
      .eq('card_name', query)
      .gte('recorded_on', cutoffDate)
      .order('recorded_on', { ascending: true });
    if (error) throw error;

    if (!data || !data.length) {
      return res.json({ success: true, query, series: [], points: 0,
        note: 'No history logged yet for this card. The line fills in as prices are logged daily.' });
    }

    // one price per day already (unique index), but average any dupes defensively
    const byDay = {};
    data.forEach(r => {
      const d = r.recorded_on;
      if (!byDay[d]) byDay[d] = [];
      byDay[d].push(Number(r.price));
    });
    const points = Object.keys(byDay).sort().map(d => ({
      t: new Date(d).getTime(),
      price: byDay[d].reduce((a, b) => a + b, 0) / byDay[d].length
    }));

    return res.json({
      success: true, query,
      start: +points[0].price.toFixed(2),
      end: +points[points.length - 1].price.toFixed(2),
      changePct: +(((points[points.length - 1].price / points[0].price) - 1) * 100).toFixed(1),
      points: points.length,
      series: indexTo100(points)
    });
  } catch (e) {
    console.error('card-history error:', e);
    return res.status(500).json({ success: false, error: 'Card history fetch failed' });
  }
});

// ---- STOCK HISTORY (Yahoo, cached) ----
app.get('/api/stock-history', async (req, res) => {
  try {
    const ticker = (req.query.ticker || '').toUpperCase().trim();
    const win = (req.query.window || '12M').toUpperCase();
    if (!ticker) return res.status(400).json({ success: false, error: 'ticker required' });

    const { data: cached } = await supabase
      .from('cardstock_stock_cache').select('payload, cached_at')
      .eq('ticker', ticker).eq('window_key', win).maybeSingle();
    if (cached && cached.payload) {
      const ageHrs = (Date.now() - new Date(cached.cached_at).getTime()) / 3600000;
      if (ageHrs < CACHE_HOURS) return res.json({ ...cached.payload, cached: true });
    }

    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?range=${yRange(win)}&interval=1d`;
    const r = await fetch(url, { headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
      'Accept': 'application/json' } });
    if (!r.ok) {
      if (cached && cached.payload) return res.json({ ...cached.payload, cached: true, stale: true });
      return res.status(502).json({ success: false, error: 'Stock source unavailable (' + r.status + ')' });
    }
    const data = await r.json();
    const result = data && data.chart && data.chart.result && data.chart.result[0];
    if (!result || !result.timestamp || !result.indicators || !result.indicators.quote) {
      if (cached && cached.payload) return res.json({ ...cached.payload, cached: true, stale: true });
      return res.status(404).json({ success: false, error: 'No stock data for ' + ticker });
    }
    const stamps = result.timestamp;
    const closes = result.indicators.quote[0].close || [];
    const points = [];
    for (let i = 0; i < stamps.length; i++) {
      const c = closes[i];
      if (c != null && !isNaN(c)) points.push({ t: stamps[i] * 1000, price: c });
    }
    if (!points.length) {
      if (cached && cached.payload) return res.json({ ...cached.payload, cached: true, stale: true });
      return res.status(404).json({ success: false, error: 'No stock data in window' });
    }
    const payload = {
      success: true, ticker,
      start: +points[0].price.toFixed(2),
      end: +points[points.length - 1].price.toFixed(2),
      changePct: +(((points[points.length - 1].price / points[0].price) - 1) * 100).toFixed(1),
      series: indexTo100(points)
    };
    await supabase.from('cardstock_stock_cache').upsert({
      ticker, window_key: win, payload, cached_at: new Date().toISOString() });
    return res.json({ ...payload, cached: false });
  } catch (e) {
    console.error('stock-history error:', e);
    return res.status(500).json({ success: false, error: 'Stock fetch failed' });
  }
});

app.use((req, res) => res.status(404).json({ success: false, error: 'Not found' }));
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('CardStock API v6 on ' + PORT));
