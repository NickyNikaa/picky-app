// api/og-image.js — Multi-Source Photo Resolver
// Tries (in order): website → Instagram profile → geheimtippmuenchen.de →
// muenchen.mitvergnuegen.com → tripadvisor.de.  Falls all fail, returns null
// (frontend falls back to cuisine gradient + emoji).

import * as cheerio from "cheerio";
import { fetchHtml } from "../lib/utils.js";

function resolveUrl(maybeRelative, base) {
  try { return new URL(maybeRelative, base).toString(); }
  catch { return maybeRelative; }
}
function isLikelyHero(url) {
  if (!url) return false;
  if (/favicon|pixel\.gif|spacer|blank\.gif|sprite|placeholder|1x1\.png/i.test(url)) return false;
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

  // Apple touch icon last resort (often square brand image, better than nothing)
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

// Search a content site (mitvergnuegen, geheimtippmuenchen, tripadvisor) for the
// restaurant name, follow the first article result, scrape its og:image.
async function searchSiteAndGetOg(searchUrl, articleSelector, baseHost) {
  try {
    const html = await fetchHtml(searchUrl, { timeoutMs: 6000 });
    const $ = cheerio.load(html);
    let firstHref = null;
    $(articleSelector).each((_, el) => {
      if (firstHref) return;
      const h = $(el).attr("href");
      if (!h) return;
      if (h.includes(baseHost) || h.startsWith("/")) firstHref = h;
    });
    if (!firstHref) return null;
    const absolute = firstHref.startsWith("http") ? firstHref : `https://${baseHost}${firstHref}`;
    return await tryUrl(absolute);
  } catch { return null; }
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "public, s-maxage=86400, stale-while-revalidate=2592000");

  const { url, ig, name } = req.query || {};
  if (!url && !ig && !name) {
    return res.status(400).json({ error: "Need at least one of: url, ig, name" });
  }

  // ============================================================
  // 1) Direct website
  // ============================================================
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

  // ============================================================
  // 2) Instagram profile (avatar / first post)
  // ============================================================
  if (ig) {
    const handle = String(ig).replace(/^@/, "").trim();
    const img = await tryUrl(`https://www.instagram.com/${encodeURIComponent(handle)}/`);
    if (img) return res.status(200).json({ image: img, via: "instagram" });
  }

  // ============================================================
  // 3) Aggregator-Suchen (Geheimtipp / MitVergnügen / Tripadvisor)
  // ============================================================
  if (name) {
    const q = encodeURIComponent(name + " münchen");

    const aggregators = [
      {
        search: `https://geheimtippmuenchen.de/?s=${q}`,
        selector: 'article a[href*="/geheimtipp/"], article h2 a, .entry-title a',
        host: "geheimtippmuenchen.de",
        via: "geheimtipp"
      },
      {
        search: `https://muenchen.mitvergnuegen.com/?s=${q}`,
        selector: 'article a[href*="/20"], h2 a, .post-title a',
        host: "muenchen.mitvergnuegen.com",
        via: "mitvergnuegen"
      },
      {
        search: `https://www.tripadvisor.de/Search?q=${q}&searchSessionId=`,
        selector: 'a[href*="/Restaurant_Review"], a[href*="/Hotel_Review"]',
        host: "www.tripadvisor.de",
        via: "tripadvisor"
      }
    ];

    for (const agg of aggregators) {
      const img = await searchSiteAndGetOg(agg.search, agg.selector, agg.host);
      if (img) return res.status(200).json({ image: img, via: agg.via });
    }
  }

  return res.status(200).json({ image: null, via: "none" });
}
