import * as cheerio from "cheerio";
import { fetchHtml } from "../lib/utils.js";

function resolveUrl(maybeRelative, base) {
  try { return new URL(maybeRelative, base).toString(); }
  catch { return maybeRelative; }
}

// Filter out tiny / icon-ish images (favicons, tracking pixels)
function isLikelyHero(url) {
  if (!url) return false;
  if (/favicon|pixel\.gif|spacer|blank\.gif/i.test(url)) return false;
  return true;
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "public, s-maxage=86400, stale-while-revalidate=2592000");

  const url = req.query?.url;
  if (!url) return res.status(400).json({ error: "Missing ?url param" });

  let target;
  try {
    target = new URL(url);
    if (!["http:", "https:"].includes(target.protocol)) throw new Error();
  } catch {
    return res.status(400).json({ error: "Invalid URL" });
  }

  if (target.hostname.includes("google.com") && target.pathname.includes("/maps/")) {
    return res.status(200).json({ image: null, reason: "google-maps" });
  }

  try {
    const html = await fetchHtml(target.toString(), { timeoutMs: 7000 });
    const $ = cheerio.load(html);

    // 1) Primary: OG / Twitter / Schema-org meta
    const metaCandidates = [
      $('meta[property="og:image:secure_url"]').attr("content"),
      $('meta[property="og:image"]').attr("content"),
      $('meta[name="twitter:image"]').attr("content"),
      $('meta[name="twitter:image:src"]').attr("content"),
      $('meta[itemprop="image"]').attr("content"),
      $('link[rel="image_src"]').attr("href"),
      // Schema.org JSON-LD image
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

    // 2) Fallback: large hero <img> in the first viewport
    let heroImg = null;
    if (metaCandidates.length === 0) {
      $('header img, .hero img, .banner img, [class*="hero"] img, [class*="banner"] img, main img').each((_, el) => {
        if (heroImg) return;
        const src = $(el).attr("src") || $(el).attr("data-src") || $(el).attr("data-lazy-src");
        if (src && isLikelyHero(src)) heroImg = src;
      });
    }

    // 3) Last resort: apple-touch-icon (high-res square)
    const touchIcon = $('link[rel="apple-touch-icon"], link[rel="apple-touch-icon-precomposed"]')
                        .attr("href");

    const raw = metaCandidates[0] || heroImg || touchIcon || null;
    const image = raw ? resolveUrl(raw, target.toString()) : null;

    return res.status(200).json({
      image,
      source: target.hostname,
      via: metaCandidates[0] ? "meta" : heroImg ? "hero" : touchIcon ? "touch-icon" : "none"
    });
  } catch (e) {
    return res.status(200).json({ image: null, error: e.message });
  }
}
