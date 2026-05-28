// lib/scrapers/eventbrite.js — Eventbrite public events for Munich.
// Eventbrite shut down their public Search API in 2020, but their event
// pages still expose Open Graph / JSON-LD that we can parse.
//
// Strategy: hit the public listing page and parse the embedded JSON.
// If you have an Eventbrite OAuth token, set EVENTBRITE_TOKEN and the
// authenticated path is used (more stable, but requires owning the org).

import * as cheerio from "cheerio";
import { fetchHtml, fetchJson, normalizeEvent, classifyCategory } from "../utils.js";

const PUBLIC_URL = "https://www.eventbrite.de/d/germany--munich/all-events/?page=1";

async function scrapePublic() {
  const events = [];
  try {
    const html = await fetchHtml(PUBLIC_URL);
    const $ = cheerio.load(html);
    $('script[type="application/ld+json"]').each((_, el) => {
      try {
        const data = JSON.parse($(el).text());
        const arr = data["@graph"] ? data["@graph"] : (Array.isArray(data) ? data : [data]);
        for (const it of arr) {
          if (it["@type"] !== "Event") continue;
          const date = (it.startDate || "").slice(0, 10);
          if (!date) continue;
          events.push(normalizeEvent({
            title: it.name || "",
            venueName: it.location?.name || "Eventbrite",
            date,
            time: (it.startDate || "").slice(11, 16) || null,
            price: it.offers?.lowPrice ? `ab ${it.offers.lowPrice}€` : "siehe Eventbrite",
            category: classifyCategory(it.name, it.description),
            source: "eventbrite.de",
            sourceUrl: it.url || PUBLIC_URL,
            pitch: (it.description || "").slice(0, 240),
            imageUrl: it.image || null
          }));
        }
      } catch (_) {}
    });
  } catch (e) {
    console.warn(`[eventbrite-public] ${e.message}`);
  }
  return events;
}

async function scrapeAuthenticated(token) {
  // Authenticated path: list events owned by orgs you have access to.
  // Useful if you onboard local promoters and they connect their Eventbrite.
  try {
    const orgsRes = await fetchJson("https://www.eventbriteapi.com/v3/users/me/organizations/", {
      headers: { Authorization: `Bearer ${token}` }
    });
    const events = [];
    for (const org of orgsRes.organizations || []) {
      const evRes = await fetchJson(
        `https://www.eventbriteapi.com/v3/organizations/${org.id}/events/?status=live&order_by=start_asc`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      for (const e of evRes.events || []) {
        events.push(normalizeEvent({
          title: e.name?.text || "",
          venueName: e.venue?.name || org.name,
          date: (e.start?.local || "").slice(0, 10),
          time: (e.start?.local || "").slice(11, 16),
          price: e.is_free ? "Eintritt frei" : "siehe Eventbrite",
          category: classifyCategory(e.name?.text, e.summary),
          source: "eventbrite-api",
          sourceUrl: e.url,
          pitch: (e.summary || "").slice(0, 240),
          imageUrl: e.logo?.url || null
        }));
      }
    }
    return events;
  } catch (e) {
    console.warn(`[eventbrite-auth] ${e.message}`);
    return [];
  }
}

export async function scrapeEventbrite() {
  const token = process.env.EVENTBRITE_TOKEN;
  if (token) return scrapeAuthenticated(token);
  return scrapePublic();
}
