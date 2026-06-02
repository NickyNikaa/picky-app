// api/og-image.js — Multi-Source Photo Resolver
// Tries (in order): website → Instagram (skip placeholder) → muenchen.mitvergnuegen.com →
// geheimtippmuenchen.de → www.muenchen-sehen.de.

import * as cheerio from "cheerio";
import { fetchHtml } from "../lib/utils.js";

function resolveUrl(rel, base) {
  try { return new URL(rel, base).toString(); }
  catch { return rel; }
}
function isLikelyHero(url) {
  if (!url) return false;
  if (/favicon|pixel\.gif|spacer|blank\.gif|sprite|placeholder|1x1\.png/i.test(url)) return false;
  // Instagram returns its generic logo placeholder when scraped — reject it
  if (/static\.cdninstagram\.com\/rsrc\.php/i.test(url)) return false;
  // MitVergnügen header default
  if (/wochenende-titel\.png/i.test(url)) return false;
  return true;
}

function extractOgImage(html, baseUrl) {
  const $ = cheerio.load(html);
  const candidates = [
    $('meta[property="og:image:secure_url"]').attr("content"),
    $('meta[property="og:image"]').attr("content"),
    $('meta[name="twitter:image"]').attr("content"),
    $('meta[name="twitter:image:src"]').attr("content"),
    $('meta[itemprop="image"]').attr("content"),
    $('link[rel="image_src"]').attr("href"),
    ...$('script[type="application/ld+json"]').toArray().flatMap(s => {
      try {
        const data = JSON.parse($(s).text());
        const arr = Array.isArray(data) ? data : [data];
        return arr.map(d => {
          const img = d?.image || d?.["@graph"]?.find?.(g => g?.image)?.image;
          if (typeof img === "string") return img;
          if (img?.url) return img.url;
          if (Array.isArray(img)) return img[0]?.url || img[0];
          return null;
        });
      } catch { return []; }
    })
  ].filter(Boolean).filter(isLikelyHero);

  if (candidates.length) return resolveUrl(candidates[0], baseUrl);

  // Hero image fallback
  let heroImg = null;
  $('header img, .hero img, .banner img, [class*="hero"] img, [class*="banner"] img, main img').each((_, el) => {
    if (heroImg) return;
    const src = $(el).attr("src") || $(el).attr("data-src") || $(el).attr("data-lazy-src");
    if (src && isLikelyHero(src) && !src.startsWith("data:")) heroImg = src;
  });
  if (heroImg) return resolveUrl(heroImg, baseUrl);

  // Apple touch icon last resort
  const ti = $('link[rel="apple-touch-icon"], link[rel="apple-touch-icon-precomposed"]').attr("href");
  if (ti) return resolveUrl(ti, baseUrl);

  return null;
}

async function tryUrl(url, timeoutMs = 6000) {
  try {
    const html = await fetchHtml(url, { timeoutMs });
    return extractOgImage(html, url);
  } catch { return null; }
}

// Search an aggregator, find the FIRST article URL using a strict regex, then
// scrape that article's og:image.
async function searchAndScrape(searchUrl, articleRegex) {
  try {
    const html = await fetchHtml(searchUrl, { timeoutMs: 6000 });
    const m = html.match(articleRegex);
    if (!m) return null;
    const articleUrl = m[0].startsWith("http") ? m[0] : `https://${new URL(searchUrl).hostname}${m[0]}`;
    return await tryUrl(articleUrl);
  } catch { return null; }
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "public, s-maxage=86400, stale-while-revalidate=2592000");

  const { url, ig, name } = req.query || {};
  if (!url && !ig && !name) {
    return res.status(400).json({ error: "Need at least one of: url, ig, name" });
  }

  // 1) Direct website
  if (url) {
    try {
      const target = new URL(url);
      if (["http:", "https:"].includes(target.protocol) &&
          !(target.hostname.includes("google.com") && target.pathname.includes("/maps/"))) {
        const img = await tryUrl(target.toString());
        if (img) return res.status(200).json({ image: img, via: "website" });
      }
    } catch {}
  }

  // 2) Aggregator search — these have og:image set to actual restaurant photo
  if (name) {
    const q = encodeURIComponent(name + " münchen");

    const aggregators = [
      // MitVergnügen — articles live at /YYYY/slug/
      {
        search: `https://muenchen.mitvergnuegen.com/?s=${q}`,
        regex: /https:\/\/muenchen\.mitvergnuegen\.com\/20[0-9]{2}\/[a-z0-9-]+\//i,
        via: "mitvergnuegen"
      },
      // Geheimtipp München — articles at /geheimtipp/slug/
      {
        search: `https://geheimtippmuenchen.de/?s=${q}`,
        regex: /https:\/\/geheimtippmuenchen\.de\/(?:geheimtipp|gastronomie|stadtleben)\/[a-z0-9-]+\//i,
        via: "geheimtipp"
      },
      // mucbook — articles at /YYYY/MM/slug
      {
        search: `https://www.mucbook.de/?s=${q}`,
        regex: /https:\/\/www\.mucbook\.de\/[a-z0-9-]+/i,
        via: "mucbook"
      }
    ];

    for (const agg of aggregators) {
      const img = await searchAndScrape(agg.search, agg.regex);
      if (img) return res.status(200).json({ image: img, via: agg.via });
    }
  }

  return res.status(200).json({ image: null, via: "none" });
}
