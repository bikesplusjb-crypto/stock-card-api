const express = require("express");
const fetch = require("node-fetch");
const cors = require("cors");

const app = express();
app.use(cors());

const PORT = process.env.PORT || 3000;

app.get("/", (req, res) => {
  res.send("Stock Card API running");
});

app.get("/stock/:ticker", async (req, res) => {
  const ticker = req.params.ticker.toUpperCase();

  try {
    // Safer no-key stock source
    const stooqUrl = `https://stooq.com/q/l/?s=${ticker.toLowerCase()}.us&f=sd2t2ohlcv&h&e=json`;
    const stooqRes = await fetch(stooqUrl, {
      headers: { "User-Agent": "Mozilla/5.0" }
    });

    const stooqData = await stooqRes.json();
    const quote = stooqData.symbols && stooqData.symbols[0];

    if (quote && quote.close && quote.close !== "N/D") {
      return res.json({
        ticker,
        price: quote.close,
        oneMonthChangePercent: "Live",
        volume: quote.volume,
        date: quote.date,
        source: "Stooq"
      });
    }

    return res.json({
      ticker,
      price: "N/A",
      oneMonthChangePercent: "N/A",
      error: "No stock data found",
      source: "Stooq"
    });

  } catch (err) {
    res.json({
      ticker,
      price: "N/A",
      oneMonthChangePercent: "N/A",
      error: "Stock fetch failed",
      details: err.message
    });
  }
});

app.listen(PORT, () => {
  console.log(`running on ${PORT}`);
});
