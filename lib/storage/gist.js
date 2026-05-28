// lib/storage/gist.js — JSON-Persistenz via GitHub Gist (gratis, unbegrenzt).
//
// Warum Gist statt Vercel KV / Postgres? Beide haben Free-Tier-Limits oder
// Pflicht-Upgrades nach ein paar Reads. GitHub-Gist ist ehrlich gratis und
// reicht für unsere Datengrößen (paar hundert Events = wenige KB).
//
// Setup:
//   1. https://github.com/settings/tokens (Classic) → "Generate new token"
//   2. Scope: nur "gist" anhaken
//   3. Token kopieren → ENV GITHUB_TOKEN=ghp_...
//   4. Einmal anlegen: https://gist.github.com → "Create secret gist" mit Datei "picky-events.json", Inhalt "[]"
//   5. URL endet auf eine ID — ENV GIST_ID=<id>

const FILENAME = "picky-events.json";

function envOrThrow(key) {
  const v = process.env[key];
  if (!v) throw new Error(`${key} not set — see lib/storage/gist.js for setup`);
  return v;
}

export async function readEvents() {
  try {
    const gistId = envOrThrow("GIST_ID");
    const token  = envOrThrow("GITHUB_TOKEN");
    const r = await fetch(`https://api.github.com/gists/${gistId}`, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json" }
    });
    if (!r.ok) throw new Error(`GitHub HTTP ${r.status}`);
    const data = await r.json();
    const file = data.files?.[FILENAME];
    if (!file) return [];
    return JSON.parse(file.content || "[]");
  } catch (e) {
    console.warn(`[gist:read] ${e.message}`);
    return [];
  }
}

export async function writeEvents(events) {
  const gistId = envOrThrow("GIST_ID");
  const token  = envOrThrow("GITHUB_TOKEN");
  const body = {
    files: { [FILENAME]: { content: JSON.stringify(events, null, 2) } }
  };
  const r = await fetch(`https://api.github.com/gists/${gistId}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });
  if (!r.ok) throw new Error(`GitHub HTTP ${r.status}: ${await r.text()}`);
  return true;
}

export async function appendEvents(newEvents) {
  const existing = await readEvents();
  // Dedupe by id, prefer existing (preserve original timestamp)
  const seen = new Map(existing.map(e => [e.id, e]));
  for (const e of newEvents) if (!seen.has(e.id)) seen.set(e.id, e);
  const merged = Array.from(seen.values());
  await writeEvents(merged);
  return { existingCount: existing.length, addedCount: merged.length - existing.length, totalCount: merged.length };
}
