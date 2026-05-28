// scripts/test-scrapers.js
// Runs scrapers locally — useful for debugging.
//
//   node scripts/test-scrapers.js              # alle
//   node scripts/test-scrapers.js tantris      # nur einer

import { scrapeTantris }              from "../lib/scrapers/tantris.js";
import { scrapeKongressbar }          from "../lib/scrapers/kongressbar.js";
import { scrapeRA }                   from "../lib/scrapers/ra-co.js";
import { scrapeGlockenbachwerkstatt } from "../lib/scrapers/glockenbachwerkstatt.js";
import { scrapeMitVergnuegen }        from "../lib/scrapers/mit-vergnuegen.js";
import { scrapeEventbrite }           from "../lib/scrapers/eventbrite.js";
import { scrapeWithAI }               from "../lib/scrapers/website-ai.js";
import { dedupeAndPrune }             from "../lib/utils.js";

const sources = {
  tantris:          scrapeTantris,
  kongressbar:      scrapeKongressbar,
  "ra-co":          scrapeRA,
  glockenbach:      scrapeGlockenbachwerkstatt,
  "mit-vergnuegen": scrapeMitVergnuegen,
  eventbrite:       scrapeEventbrite,
  ai:               scrapeWithAI
};

const only = process.argv[2];
const targets = only ? { [only]: sources[only] } : sources;

if (only && !sources[only]) {
  console.error(`Unknown source "${only}". Available: ${Object.keys(sources).join(", ")}`);
  process.exit(1);
}

console.log(`\nRunning: ${Object.keys(targets).join(", ")}\n`);

const all = [];
for (const [name, fn] of Object.entries(targets)) {
  process.stdout.write(`→ ${name} ... `);
  try {
    const t0 = Date.now();
    const events = await fn();
    console.log(`${events.length} events (${Date.now() - t0}ms)`);
    all.push(...events);
    if (events[0]) console.log("    sample:", JSON.stringify(events[0], null, 2).split("\n").join("\n    "));
  } catch (e) {
    console.log(`FAILED: ${e.message}`);
  }
}

const pruned = dedupeAndPrune(all);
console.log(`\nTotal after dedupe/prune: ${pruned.length}`);
