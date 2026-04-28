const express = require("express");
const fetch = require("node-fetch");
const cors = require("cors");

const app = express();
app.use(cors());

const PORT = process.env.PORT || 3000;

let ebayToken = null;
let tokenExpires = 0;

async function getEbayToken() {
  if (ebayToken && Date.now() < tokenExpires) return ebayToken;

  const auth = Buffer.from(
    process.env.EBAY_CLIENT_ID + ":" + process.env.EBAY_CLIENT_SECRET
  ).toString("base64");

  const res = await fetch("https://api.ebay.com/identity/v1/oauth2/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: "grant_type=client_credentials&scope=https://api.ebay.com/oauth/api_scope"
  });

  const data = await res.json();

  ebayToken = data.access_token;
  tokenExpires = Date.now() + (data.expires_in - 60) * 1000;

  return ebayToken;
}

app.get("/", (req, res) => {
  res.send("Stock Card API running");
});

app.get("/stock/:ticker", async (req, res) => {
  const ticker = req.params.ticker.toUpperCase();

  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?range=1mo&interval=1d`;

    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0",
        Accept: "application/json"
      }
    });

    const data = await response.json();
    const result = data.chart.result[0];
    const meta = result.meta;
    const prices = result.indicators.quote[0].close.filter(Boolean);

    const first = prices[0];
    const last = prices[prices.length - 1];
    const percent = ((last - first) / first) * 100;

    res.json({
      ticker,
      price: meta.regularMarketPrice,
      previousClose: meta.chartPreviousClose,
      oneMonthChangePercent: percent.toFixed(2) + "%",
      currency: meta.currency,
      source: "Yahoo Finance"
    });
  } catch (err) {
    res.json({
      ticker,
      price: "N/A",
      oneMonthChangePercent: "N/A",
      error: "Yahoo fetch failed",
      details: err.message
    });
  }
});

app.get("/card/:name", async (req, res) => {
  try {
    const query = req.params.name;
    const token = await getEbayToken();

    const response = await fetch(
      `https://api.ebay.com/buy/browse/v1/item_summary/search?q=${encodeURIComponent(query)}&limit=10`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        }
      }
    );

    const data = await response.json();

    if (!data.itemSummaries || data.itemSummaries.length === 0) {
      return res.json({
        search: query,
        avgPrice: "N/A",
        listings: 0,
        source: "eBay Browse API",
        error: "No items found"
      });
    }

    const prices = data.itemSummaries
      .map(item => parseFloat(item.price && item.price.value))
      .filter(p => !isNaN(p));

    const avg = prices.length
      ? prices.reduce((a, b) => a + b, 0) / prices.length
      : 0;

    res.json({
      search: query,
      avgPrice: avg ? avg.toFixed(2) : "N/A",
      listings: data.total || data.itemSummaries.length,
      source: "eBay Browse API",
      ebayUrl: `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(query)}`
    });
  } catch (err) {
    res.json({
      error: "eBay fetch failed",
      details: err.message
    });
  }
});

app.listen(PORT, () => {
  console.log("running on " + PORT);
});
