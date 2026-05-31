// lib/scrapers/index.js — Runs all scrapers in parallel and aggregates.

import { scrapeTantris }              from "./tantris.js";
import { scrapeKongressbar }          from "./kongressbar.js";
import { scrapeRA }                   from "./ra-co.js";
import { scrapeGlockenbachwerkstatt } from "./glockenbachwerkstatt.js";
import { scrapeMitVergnuegen }        from "./mit-vergnuegen.js";
import { scrapeEventbrite }           from "./eventbrite.js";
import { scrapeEventim }              from "./eventim.js";
import { scrapeMuenchenFestivals }    from "./muenchen-festivals.js";
import { scrapeWithAI }               from "./website-ai.js";
import { dedupeAndPrune }             from "../utils.js";

export async function scrapeAll() {
  const sources = [
    ["tantris",          scrapeTantris],
    ["kongressbar",      scrapeKongressbar],
    ["ra-co",            scrapeRA],
    ["glockenbach",      scrapeGlockenbachwerkstatt],
    ["mit-vergnuegen",   scrapeMitVergnuegen],
    ["eventbrite",       scrapeEventbrite],
    ["eventim",          scrapeEventim],
    ["muenchen-feste",   scrapeMuenchenFestivals],
    ["ai-websites",      scrapeWithAI]
  ];

  const results = await Promise.allSettled(sources.map(([_, fn]) => fn()));
  const events = [];
  results.forEach((r, i) => {
    const name = sources[i][0];
    if (r.status === "fulfilled") {
      console.log(`[scrape] ${name}: ${r.value.length} events`);
      events.push(...r.value);
    } else {
      console.warn(`[scrape] ${name} failed:`, r.reason?.message);
    }
  });
  return dedupeAndPrune(events);
}
