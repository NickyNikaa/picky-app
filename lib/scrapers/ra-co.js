// lib/scrapers/ra-co.js — Resident Advisor: individual clubs AND full Munich city listing.
// RA exposes JSON-LD on most pages — extremely reliable.

import * as cheerio from "cheerio";
import { fetchHtml, normalizeEvent, classifyCategory } from "../utils.js";

// Per-venue RA pages — venueId maps to a picky-known venue.
const CLUBS = [
  { raId: "68210", venueId: "goldene-bar", venueName: "Goldene Bar" }
  // Add more as you discover them
];

// City listing — broad, covers underground, club, popup-club events.
const CITY_URL = "https://ra.co/events/de/munich";

async function scrapeJsonLd(url, defaultVenueId = null, defaultVenueName = "") {
  const events = [];
  try {
    const html = await fetchHtml(url);
    const $ = cheerio.load(html);
    $('script[type="application/ld+json"]').each((_, el) => {
      try {
        const data = JSON.parse($(el).text());
        const items = Array.isArray(data) ? data : [data];
        for (const item of items) {
          const arr = item["@graph"] ? item["@graph"] : [item];
          for (const it of arr) {
            if (it["@type"] !== "Event" && it["@type"] !== "MusicEvent") continue;
            const date = (it.startDate || "").slice(0, 10);
            if (!date) continue;
            const time = (it.startDate || "").slice(11, 16);
            const title = it.name || "RA Event";
            const pitch = (it.description || "").slice(0, 280);
            const venueName = it.location?.name || defaultVenueName;
            // RA events are mostly clubs → tag as dj-club unless title says otherwise
            const cat = classifyCategory(title, pitch) || "dj-club";
            events.push(normalizeEvent({
              title,
              venueId: defaultVenueId,
              venueName,
              date,
              time: time || null,
              category: cat === "themed-night" ? "dj-club" : cat,
              price: it.offers?.price ? `${it.offers.price}€` : "siehe RA",
              source: "ra.co",
              sourceUrl: it.url || url,
              pitch,
              imageUrl: it.image || null
            }));
          }
        }
      } catch (_) { /* swallow per-script JSON errors */ }
    });
  } catch (e) {
    console.warn(`[ra-co] ${url}: ${e.message}`);
  }
  return events;
}

export async function scrapeRA() {
  const events = [];
  for (const c of CLUBS) {
    events.push(...await scrapeJsonLd(`https://ra.co/clubs/${c.raId}`, c.venueId, c.venueName));
  }
  events.push(...await scrapeJsonLd(CITY_URL));
  return events;
}
