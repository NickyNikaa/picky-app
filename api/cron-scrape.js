// api/cron-scrape.js — Triggered by Vercel Cron (see vercel.json).
// Forces a fresh scrape, returns the count so logs show success.

import { scrapeAll } from "../lib/scrapers/index.js";

export default async function handler(req, res) {
  // Optional auth — Vercel Cron sends a header with the CRON_SECRET.
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.authorization || "";
    if (auth !== `Bearer ${secret}`) {
      return res.status(401).json({ error: "Unauthorized" });
    }
  }

  const started = Date.now();
  try {
    const events = await scrapeAll();
    res.status(200).json({
      ok: true,
      count: events.length,
      durationMs: Date.now() - started,
      sample: events.slice(0, 3)
    });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
}
