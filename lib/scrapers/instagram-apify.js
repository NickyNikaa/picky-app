// lib/scrapers/instagram-apify.js — DEPRECATED.
//
// Apify-Scraper wurde entfernt (kostenpflichtig).
// Instagram-Events kommen jetzt über den Cowork-Scheduled-Task:
//   1. Täglicher Task im Claude-Desktop läuft (siehe README "Instagram via Cowork")
//   2. Liest IG via Chrome-Extension (eingeloggter User)
//   3. Schickt extrahierte Events an POST /api/submit-events
//
// Stub bleibt für Rückwärtskompatibilität — gibt einfach leeres Array zurück.

export async function scrapeInstagram() {
  return [];
}
