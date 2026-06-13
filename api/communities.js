// api/communities.js — Static curated communities, edge-cached.
import communities from "../data/communities.json" with { type: "json" };

export default function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "public, s-maxage=3600, stale-while-revalidate=86400");
  res.status(200).json({
    meta: { generatedAt: new Date().toISOString(), count: communities.length },
    communities
  });
}
