const express = require("express");
const fetch = require("node-fetch");
const cors = require("cors");

const app = express();
app.use(cors());

const PORT = process.env.PORT || 3000;

app.get("/", (req, res) => {
  res.send("Stock Card API running with Yahoo Finance");
});

app.get("/stock/:ticker", async (req, res) => {
  const ticker = req.params.ticker.toUpperCase();

  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?range=1mo&interval=1d`;
    const response = await fetch(url);
    const data = await response.json();

    const result = data.chart.result[0];
    const meta = result.meta;
    const prices = result.indicators.quote[0].close.filter(Boolean);

    const first = prices[0];
    const last = prices[prices.length - 1];
    const percent = ((last - first) / first) * 100;

    res.json({
      ticker: ticker,
      price: meta.regularMarketPrice,
      previousClose: meta.chartPreviousClose,
      oneMonthChangePercent: percent.toFixed(2) + "%",
      currency: meta.currency,
      source: "Yahoo Finance"
    });

  } catch (err) {
    res.json({
      ticker,
      error: "Yahoo stock fetch failed"
    });
  }
});

app.listen(PORT, () => {
  console.log(`running on ${PORT}`);
});
