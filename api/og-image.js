// api/og-image.js — Returns the OpenGraph image URL for any given website.
// Used by the frontend to put real restaurant photos on the cards.

import * as cheerio from "cheerio";
import { fetchHtml } from "../lib/utils.js";

function resolveUrl(maybeRelative, base) {
  try { return new URL(maybeRelative, base).toString(); }
  catch { return maybeRelative; }
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  // Cache aggressively — images for a restaurant don't change every hour
  res.setHeader("Cache-Control", "public, s-maxage=86400, stale-while-revalidate=2592000");

  const url = req.query?.url;
  if (!url) return res.status(400).json({ error: "Missing ?url param" });

  // Guard: only http(s), block obvious junk
  let target;
  try {
    target = new URL(url);
    if (!["http:", "https:"].includes(target.protocol)) throw new Error();
  } catch {
    return res.status(400).json({ error: "Invalid URL" });
  }

  // Skip google-maps-search URLs — they don't have og:images for the actual place
  if (target.hostname.includes("google.com") && target.pathname.includes("/maps/search")) {
    return res.status(200).json({ image: null, reason: "google-maps-search" });
  }

  try {
    const html = await fetchHtml(target.toString(), { timeoutMs: 7000 });
    const $ = cheerio.load(html);
    const candidates = [
      $('meta[property="og:image:secure_url"]').attr("content"),
      $('meta[property="og:image"]').attr("content"),
      $('meta[name="twitter:image"]').attr("content"),
      $('meta[name="twitter:image:src"]').attr("content"),
      $('link[rel="image_src"]').attr("href")
    ].filter(Boolean);
    const image = candidates[0] ? resolveUrl(candidates[0], target.toString()) : null;
    return res.status(200).json({ image, source: target.hostname });
  } catch (e) {
    return res.status(200).json({ image: null, error: e.message });
  }
}
