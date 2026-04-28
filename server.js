const express = require("express");
const fetch = require("node-fetch");
const cors = require("cors");

const app = express();
app.use(cors());

const API_KEY = process.env.ALPHA_KEY;

app.get("/", (req, res) => {
  res.send("API running");
});

app.get("/stock/:ticker", async (req, res) => {
  const ticker = req.params.ticker;

  try {
    const url = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${ticker}&apikey=${API_KEY}`;
    const response = await fetch(url);
    const data = await response.json();

    const quote = data["Global Quote"];

    res.json({
      ticker,
      price: quote["05. price"],
      change: quote["10. change percent"]
    });
  } catch (e) {
    res.json({ error: "failed" });
  }
});

app.listen(3000, () => console.log("running"));
