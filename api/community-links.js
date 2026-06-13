// api/community-links.js — Scrape a community website and extract social links
// (Instagram, TikTok, Strava, WhatsApp, Email).  Edge-cached 1 day.
import * as cheerio from "cheerio";
import { fetchHtml } from "../lib/utils.js";

function pick(html) {
  const $ = cheerio.load(html);
  const links = new Set();
  $("a[href]").each((_, el) => links.add($(el).attr("href")));
  const result = {};
  for (const u of links) {
    if (!u) continue;
    if (!result.instagram) {
      const m = u.match(/instagram\.com\/([A-Za-z0-9_.]+)/i);
      if (m && !["p","reel","reels","stories","tv","explore"].includes(m[1])) {
        result.instagram = m[1].replace(/\/$/, "");
      }
    }
    if (!result.tiktok) {
      const m = u.match(/tiktok\.com\/@([A-Za-z0-9_.]+)/i);
      if (m) result.tiktok = m[1];
    }
    if (!result.strava && /strava\.com\/clubs\/\d+/i.test(u)) {
      result.strava = u.split("?")[0];
    }
    if (!result.whatsapp && /(chat\.whatsapp\.com|wa\.me)/i.test(u)) {
      result.whatsapp = u.split("?")[0];
    }
    if (!result.email) {
      const m = u.match(/mailto:([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})/);
      if (m) result.email = m[1];
    }
  }
  return result;
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "public, s-maxage=86400, stale-while-revalidate=2592000");
  const { url } = req.query || {};
  if (!url) return res.status(400).json({ error: "Missing url" });
  try {
    const target = new URL(url);
    if (!["http:","https:"].includes(target.protocol)) throw new Error();
    const html = await fetchHtml(target.toString(), { timeoutMs: 7000 });
    const out = pick(html);
    return res.status(200).json({ url: target.toString(), found: out });
  } catch (e) {
    return res.status(200).json({ url, found: {}, error: e.message });
  }
}
