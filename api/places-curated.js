// api/places-curated.js — User-curated places (Nickys Maps-Liste etc.)
// Static JSON, edge-cached aggressively.

import places from "../data/curated-places.json" with { type: "json" };

export default function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "public, s-maxage=3600, stale-while-revalidate=86400");
  res.status(200).json({
    meta: { generatedAt: new Date().toISOString(), source: "curated", count: places.length },
    places
  });
}
