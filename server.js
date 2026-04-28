const express = require("express");
const fetch = require("node-fetch");
const cors = require("cors");

const app = express();
app.use(cors());

const PORT = process.env.PORT || 3000;

app.get("/", (req, res) => {
  res.send("Stock API running");
});

app.get("/stock/:ticker", async (req, res) => {
  const ticker = req.params.ticker.toLowerCase();

  try {
    const url = `https://stooq.com/q/l/?s=${ticker}.us&f=sd2t2ohlcv&e=csv`;
    const response = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0" }
    });

    const text = await response.text();

    // 🛑 SAFETY CHECK
    if (!text || text.length < 20) {
      return res.json({
        ticker: ticker.toUpperCase(),
        price: "N/A",
        error: "No data returned"
      });
    }

    const lines = text.trim().split("\n");

    if (lines.length < 2) {
      return res.json({
        ticker: ticker.toUpperCase(),
        price: "N/A",
        error: "Invalid CSV format"
      });
    }

    const values = lines[1].split(",");

    const close = values[6];
    const volume = values[7];

    if (!close || close === "N/D") {
      return res.json({
        ticker: ticker.toUpperCase(),
        price: "N/A",
        error: "No valid price"
      });
    }

    res.json({
      ticker: ticker.toUpperCase(),
      price: close,
      oneMonthChangePercent: "Live",
      volume: volume,
      source: "Stooq Stable"
    });

  } catch (err) {
    res.json({
      ticker: ticker.toUpperCase(),
      price: "N/A",
      error: "Fetch failed",
      details: err.message
    });
  }
});

app.listen(PORT, () => {
  console.log("running on " + PORT);
});
