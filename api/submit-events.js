// api/submit-events.js — POST endpoint for the Cowork-Scheduled-Task to push
// curated IG-events (or any external events) into picky's persistent store.
//
//   POST /api/submit-events
//   Authorization: Bearer <PICKY_SUBMIT_TOKEN>
//   Content-Type: application/json
//   { "events": [ { ...event }, ... ] }
//
// Events must follow the schema produced by normalizeEvent() — see lib/utils.js.

import { appendEvents } from "../lib/storage/gist.js";
import { normalizeEvent, dedupeAndPrune } from "../lib/utils.js";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Use POST" });

  const required = process.env.PICKY_SUBMIT_TOKEN;
  if (required) {
    const got = (req.headers.authorization || "").replace(/^Bearer\s+/, "");
    if (got !== required) return res.status(401).json({ error: "Unauthorized" });
  }

  let body = req.body;
  if (typeof body === "string") { try { body = JSON.parse(body); } catch { body = {}; } }
  const incoming = Array.isArray(body?.events) ? body.events : [];
  if (incoming.length === 0) return res.status(400).json({ error: "No events in body" });

  // Normalize + prune past events before storing
  const normalized = dedupeAndPrune(incoming.map(e => normalizeEvent({ ...e, source: e.source || "cowork-curated" })));
  if (normalized.length === 0) {
    return res.status(200).json({ ok: true, note: "All events were past or duplicates", submitted: incoming.length, stored: 0 });
  }

  try {
    const result = await appendEvents(normalized);
    res.status(200).json({ ok: true, submitted: incoming.length, ...result });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
}
