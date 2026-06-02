// api/og-image.js — Real og:image only.  No icon/aggregator fallbacks that
// return wrong photos.  Frontend falls back to cuisine gradient + emoji
// when this returns null.

import * as cheerio from "cheerio";
import { fetchHtml } from "../lib/utils.js";

function resolveUrl(rel, base) {
  try { return new URL(rel, base).toString(); }
  catch { return rel; }
}
function isLikelyHero(url) {
  if (!url) return false;
  if (/favicon|pixel\.gif|spacer|blank\.gif|sprite|placeholder|1x1\.png/i.test(url)) return false;
  if (/static\.cdninstagram\.com\/rsrc\.php/i.test(url)) return false;
  if (/wochenende-titel\.png|apple-touch-icon|wp-content\/.+\/icon|logo\.(?:png|svg)/i.test(url)) return false;
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

  // Hero image — only large images in semantic areas
  let heroImg = null;
  $('header img, .hero img, [class*="hero"] img, [class*="cover"] img, main > img, main section img').each((_, el) => {
    if (heroImg) return;
    const src = $(el).attr("src") || $(el).attr("data-src") || $(el).attr("data-lazy-src");
    if (src && isLikelyHero(src) && !src.startsWith("data:")) heroImg = src;
  });
  if (heroImg) return resolveUrl(heroImg, baseUrl);

  return null;
}

async function tryUrl(url, timeoutMs = 6000) {
  try {
    const html = await fetchHtml(url, { timeoutMs });
    return extractOgImage(html, url);
  } catch { return null; }
}

// Search mitvergnuegen / geheimtipp — only proceed if name token appears near article link
async function searchAndScrape(searchUrl, articleRegex, nameTokens) {
  try {
    const html = await fetchHtml(searchUrl, { timeoutMs: 6000 });
    // Find articles whose URL slug contains at least one name token (≥4 chars)
    const matches = html.match(new RegExp(articleRegex.source, articleRegex.flags + "g")) || [];
    const goodMatch = matches.find(url => {
      const slug = url.toLowerCase();
      return nameTokens.some(t => t.length >= 4 && slug.includes(t.toLowerCase()));
    });
    if (!goodMatch) return null;
    return await tryUrl(goodMatch);
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

  // 2) Aggregator search — only accept when name token appears in URL slug
  if (name) {
    const tokens = String(name)
      .replace(/Café|Cafe|Restaurant|Bar|Munich|München|&|–|—/gi, "")
      .split(/\s+/).map(t => t.replace(/[^a-z0-9äöüß]/gi, "").toLowerCase())
      .filter(t => t.length >= 3);

    const q = encodeURIComponent(name + " münchen");
    const aggregators = [
      {
        search: `https://muenchen.mitvergnuegen.com/?s=${q}`,
        regex: /https:\/\/muenchen\.mitvergnuegen\.com\/20[0-9]{2}\/[a-z0-9-]+\//i,
        via: "mitvergnuegen"
      },
      {
        search: `https://geheimtippmuenchen.de/?s=${q}`,
        regex: /https:\/\/geheimtippmuenchen\.de\/(?:geheimtipp|gastronomie|stadtleben)\/[a-z0-9-]+\//i,
        via: "geheimtipp"
      },
      {
        search: `https://www.tripadvisor.de/Search?q=${q}`,
        regex: /https?:\/\/(?:www\.)?tripadvisor\.(?:de|com)\/Restaurant_Review-[a-zA-Z0-9_-]+\.html/i,
        via: "tripadvisor"
      },
      {
        search: `https://isarblog.de/?s=${q}`,
        regex: /https:\/\/isarblog\.de\/[a-z0-9-]+\/?/i,
        via: "isarblog"
      }
    ];

    // Wikipedia direct API — works for famous places
    try {
      const wikiSlug = encodeURIComponent(String(name).replace(/\s+/g, "_"));
      const wikiJson = await fetchHtml(`https://de.wikipedia.org/api/rest_v1/page/summary/${wikiSlug}`, { timeoutMs: 5000 }).catch(() => null);
      if (wikiJson) {
        const wd = JSON.parse(wikiJson);
        if (wd?.thumbnail?.source) {
          // Get larger version by replacing "thumb/...XXpx-" with the full file
          const fullSize = wd.thumbnail.source.replace(/\/\d+px-([^/]+)$/, "/800px-$1");
          return res.status(200).json({ image: fullSize, via: "wikipedia" });
        }
      }
    } catch {}

    for (const agg of aggregators) {
      const img = await searchAndScrape(agg.search, agg.regex, tokens);
      if (img) return res.status(200).json({ image: img, via: agg.via });
    }
  }

  return res.status(200).json({ image: null, via: "none" });
}
