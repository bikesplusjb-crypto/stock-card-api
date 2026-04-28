const express = require("express");
const fetch = require("node-fetch");
const cors = require("cors");

const app = express();
app.use(cors());

const PORT = process.env.PORT || 3000;
const API_KEY = process.env.ALPHA_KEY;

app.get("/", (req, res) => {
  res.send("Stock Card API running");
});

app.get("/stock/:ticker", async (req, res) => {
  const ticker = req.params.ticker.toUpperCase();

  if (!API_KEY) {
    return res.json({
      error: "Missing ALPHA_KEY in Render environment variables"
    });
  }

  try {
    const url = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${ticker}&apikey=${API_KEY}`;
    const response = await fetch(url);
    const data = await response.json();

    if (data.Note) {
      return res.json({
        ticker,
        error: "Alpha Vantage rate limit hit",
        message: data.Note
      });
    }

    if (data.Information) {
      return res.json({
        ticker,
        error: "Alpha Vantage API message",
        message: data.Information
      });
    }

    const quote = data["Global Quote"];

    if (!quote || !quote["05. price"]) {
      return res.json({
        ticker,
        error: "No stock data returned",
        raw: data
      });
    }

    res.json({
      ticker,
      price: quote["05. price"],
      change: quote["09. change"],
      percent: quote["10. change percent"],
      source: "Alpha Vantage"
    });

  } catch (err) {
    res.json({
      ticker,
      error: "Fetch failed",
      details: err.message
    });
  }
});

app.listen(PORT, () => {
  console.log(`running on port ${PORT}`);
});
