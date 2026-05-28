// lib/scrapers/mit-vergnuegen.js — "Mit Vergnügen München" — weekly events / pop-up tips.
// Articles list events with semi-structured H2/H3 headings + dates inline.

import * as cheerio from "cheerio";
import { fetchHtml, parseGermanDate, normalizeEvent } from "../utils.js";

// Weekly-Tipps Übersicht — links to all articles tagged "events"
const LIST_URL = "https://muenchen.mitvergnuegen.com/tag/events/";

const ARTICLE_LIMIT = 5;        // how many recent articles to crawl
const EVENTS_PER_ARTICLE = 10;  // max events extracted per article

async function getArticleUrls() {
  const html = await fetchHtml(LIST_URL);
  const $ = cheerio.load(html);
  const urls = [];
  $("a").each((_, el) => {
    const href = $(el).attr("href") || "";
    if (/muenchen\.mitvergnuegen\.com\/\d{4}\//.test(href) && !urls.includes(href)) urls.push(href);
    if (urls.length >= ARTICLE_LIMIT) return false;
  });
  return urls;
}

function extractFromArticle($) {
  const events = [];
  $("h2, h3").each((_, h) => {
    if (events.length >= EVENTS_PER_ARTICLE) return false;
    const title = $(h).text().trim();
    if (!title || title.length < 6) return;
    // collect next 2 paragraphs as description
    const desc = $(h).nextUntil("h2, h3").slice(0, 3).text().replace(/\s+/g, " ").trim();
    if (!desc) return;
    const fullText = `${title} ${desc}`;
    const date = parseGermanDate(fullText);
    if (!date) return;
    const pitch = desc.slice(0, 240) + (desc.length > 240 ? "…" : "");
    events.push(normalizeEvent({
      title,
      venueId: null,
      venueName: "Mit Vergnügen Tipp",
      date,
      time: null,
      price: "siehe Artikel",
      source: "mitvergnuegen.com",
      pitch
    }));
  });
  return events;
}

export async function scrapeMitVergnuegen() {
  const events = [];
  try {
    const urls = await getArticleUrls();
    for (const u of urls) {
      try {
        const html = await fetchHtml(u);
        const $ = cheerio.load(html);
        const ev = extractFromArticle($);
        ev.forEach(e => { e.sourceUrl = u; });
        events.push(...ev);
      } catch (e) { /* per-article fail is fine */ }
    }
  } catch (e) {
    console.warn(`[mit-vergnuegen] ${e.message}`);
  }
  return events;
}
