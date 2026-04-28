const fetch = require("node-fetch");

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
      "Authorization": `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: "grant_type=client_credentials&scope=https://api.ebay.com/oauth/api_scope"
  });

  const data = await res.json();

  ebayToken = data.access_token;
  tokenExpires = Date.now() + (data.expires_in - 60) * 1000;

  return ebayToken;
}
const express = require("express");
const fetch = require("node-fetch");
const cors = require("cors");

const app = express();
app.use(cors());

const PORT = process.env.PORT || 3000;

app.get("/", (req, res) => {
  res.send("Stock API running with Yahoo");
});

app.get("/stock/:ticker", async (req, res) => {
  const ticker = req.params.ticker.toUpperCase();

  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?range=1mo&interval=1d`;

    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0",
        "Accept": "application/json"
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

app.listen(PORT, () => {
  console.log("running on " + PORT);
});
