// api/events.js — Returns aggregated events from all sources.
// Source ranking: live scrape > Gist (Cowork-curated) > seed.

import { scrapeAll } from "../lib/scrapers/index.js";
import { readEvents as readGistEvents } from "../lib/storage/gist.js";
import { dedupeAndPrune } from "../lib/utils.js";
import seedEvents from "../data/seed-events.json" with { type: "json" };

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET");

  try {
    const [live, curated] = await Promise.all([
      scrapeAll().catch(() => []),
      readGistEvents().catch(() => [])
    ]);

    const merged = dedupeAndPrune([...live, ...curated, ...seedEvents]);
    res.status(200).json({
      meta: {
        generatedAt: new Date().toISOString(),
        liveCount: live.length,
        curatedCount: curated.length,
        seedCount: seedEvents.length,
        totalReturned: merged.length
      },
      events: merged
    });
  } catch (e) {
    console.error("[api/events] fatal:", e);
    res.status(200).json({
      meta: { generatedAt: new Date().toISOString(), fallback: true, error: e.message },
      events: seedEvents
    });
  }
}
