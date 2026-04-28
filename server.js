const express = require("express");
const fetch = require("node-fetch");
const cors = require("cors");

const app = express();
app.use(cors());

const PORT = process.env.PORT || 3000;
const API_KEY = process.env.FINN_KEY;

app.get("/", (req, res) => {
  res.send("Finnhub API running");
});

app.get("/stock/:ticker", async (req, res) => {
  const ticker = req.params.ticker.toUpperCase();

  try {
    const url = `https://finnhub.io/api/v1/quote?symbol=${ticker}&token=${API_KEY}`;
    const response = await fetch(url);
    const data = await response.json();

    res.json({
      ticker,
      price: data.c,
      change: data.d,
      percent: data.dp + "%",
      source: "Finnhub"
    });

  } catch (err) {
    res.json({ error: "Fetch failed" });
  }
});

app.listen(PORT, () => {
  console.log(`running on ${PORT}`);
});
