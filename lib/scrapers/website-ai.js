// lib/scrapers/website-ai.js — Generic AI-based extractor.
// Reads any restaurant/bar/community website, asks Claude to find events.
// Optional — only runs when ANTHROPIC_API_KEY is set.

import * as cheerio from "cheerio";
import Anthropic from "@anthropic-ai/sdk";
import { fetchHtml, normalizeEvent } from "../utils.js";

// Venue list — includes Gen-Z / community / pop-up / queer / underground spots.
const VENUES = [
  // Classic restaurant pop-ups & dinners
  { venueId: "casele",        venueName: "Casele",         url: "https://www.casele.de/" },
  { venueId: "helene",        venueName: "Helene",         url: "https://heleneliebtdich.de/" },
  { venueId: "muniqo",        venueName: "M'Uniqo",        url: "https://muniqo-rooftop.com/" },
  { venueId: "moromou",       venueName: "Moro Mou",       url: "https://moromou.de/" },
  { venueId: "park-cafe",     venueName: "Park Café 089",  url: "https://www.parkcafe089.de/" },

  // Gen-Z / community / queer / pop-up
  { venueId: null,            venueName: "Lost Girls (FLINTA Pop-up)", url: "https://www.lostgirls.de/" },
  { venueId: null,            venueName: "Pacific Times",  url: "https://www.pacific-times.de/" },
  { venueId: null,            venueName: "Zephyr Bar",     url: "https://www.zephyr-bar.de/" },
  { venueId: "fei-scho",      venueName: "Fei Scho",       url: "https://feischo.com/" },
  { venueId: null,            venueName: "Mural Bar",      url: "https://www.mural-restaurant.de/" },
  { venueId: null,            venueName: "Holy Cow",       url: "https://holycow-burger.de/" },
  { venueId: null,            venueName: "Container Collective", url: "https://www.werksviertel-mitte.de/" }
];

const SYSTEM = `Du bist ein Event-Extraktor für picky., eine Münchner Restaurant-/Bar-/Event-App.
Du bekommst den Text einer Restaurant- oder Bar- oder Community-Website. Finde EVENTS mit konkretem Datum.
ÜBERSPRINGE: Dauer-Angebote wie "jeden Donnerstag" (außer wenn das nächste konkrete Datum erwähnt ist).
Antworte AUSSCHLIESSLICH mit gültigem JSON, einem Array von Events. Keine Erklärungen.

Schema:
{
  "title":    "kurzer Eventtitel",
  "date":     "YYYY-MM-DD (in der Zukunft)",
  "time":     "HH:MM" oder null,
  "category": "live-music | dj-club | underground | karaoke | open-mic | silent-disco | wine-tasting | popup-dinner | popup | themed-dinner | chef-table | brunch | sober | community | flinta-queer | market | vernissage | workshop | book-reading | rooftop-sundown | wellness | sports-watch | gaming | themed-night | party",
  "price":    "z.B. '75€/Person' oder 'Eintritt frei' oder 'auf Anfrage'",
  "pitch":    "1-2 Sätze, max 200 Zeichen"
}

Wenn keine Events: "[]". Erfinde NICHTS — lieber leeres Array.`;

export async function scrapeWithAI() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.log("[ai] ANTHROPIC_API_KEY not set, skipping AI scraper");
    return [];
  }
  const client = new Anthropic({ apiKey });
  const events = [];

  for (const v of VENUES) {
    try {
      const html = await fetchHtml(v.url);
      const $ = cheerio.load(html);
      $("script,style,nav,header,footer,svg").remove();
      const text = $.text().replace(/\s+/g, " ").trim().slice(0, 12000);
      if (text.length < 200) continue;

      const msg = await client.messages.create({
        model: "claude-haiku-4-5",
        max_tokens: 2000,
        system: SYSTEM,
        messages: [{ role: "user", content: `Quelle: ${v.url}\nVenue: ${v.venueName}\n\nSEITEN-TEXT:\n${text}` }]
      });

      const responseText = msg.content?.[0]?.text?.trim() || "[]";
      let parsed;
      try { parsed = JSON.parse(responseText); } catch (_) {
        const m = responseText.match(/\[[\s\S]*\]/);
        if (m) { try { parsed = JSON.parse(m[0]); } catch (_) { parsed = []; } } else parsed = [];
      }
      if (!Array.isArray(parsed)) continue;

      for (const e of parsed) {
        if (!e.date || !e.title) continue;
        events.push(normalizeEvent({
          ...e,
          venueId: v.venueId,
          venueName: v.venueName,
          source: "ai-scraper",
          sourceUrl: v.url
        }));
      }
    } catch (e) {
      console.warn(`[ai] ${v.url}: ${e.message}`);
    }
  }
  return events;
}
