# picky.

München's Restaurant / Bar / Event Finder mit kostenlosem Live-Scraping-Backend.

```
picky-app/
├── public/index.html                ← Frontend
├── api/
│   ├── events.js                    ← GET /api/events — aggregated feed
│   ├── submit-events.js             ← POST — für Cowork-Scheduled-Task (IG)
│   ├── cron-scrape.js               ← Vercel Cron, läuft täglich 06:00
│   └── health.js                    ← GET /api/health
├── lib/
│   ├── utils.js                     ← 25+ Kategorien, Date-Parser, Helpers
│   ├── storage/
│   │   └── gist.js                  ← GitHub-Gist als kostenloser Storage
│   └── scrapers/
│       ├── index.js                 ← Aggregator
│       ├── tantris.js
│       ├── kongressbar.js
│       ├── ra-co.js                 ← RA Clubs + ganz München
│       ├── glockenbachwerkstatt.js  ← Community / Queer / Pop-up
│       ├── mit-vergnuegen.js
│       ├── eventbrite.js
│       ├── instagram-apify.js       ← DEPRECATED (siehe Cowork-Setup)
│       └── website-ai.js            ← Claude-basiert
├── data/seed-events.json
├── scripts/test-scrapers.js
├── INSTAGRAM-COWORK-TASK.md         ← Setup für IG via Scheduled Task
├── package.json · vercel.json · .env.example
```

## Was kostet was

| Komponente              | Kosten                                  |
|-------------------------|------------------------------------------|
| Vercel Hosting          | gratis (Hobby Tier)                      |
| GitHub Gist (Storage)   | gratis                                   |
| Web-Scraper             | gratis                                   |
| AI-Fallback (Claude)    | ~$0.05/Scrape (Free-Tier deckt das ab)   |
| Instagram               | gratis (über Cowork, kein Apify)         |
| **Gesamt**              | **0 €/Monat** (mit Claude Free-Tier)     |

## Quickstart

```bash
cd picky-app
cp .env.example .env.local           # mind. ANTHROPIC_API_KEY eintragen
npm install
npm install -g vercel
vercel dev                           # http://localhost:3000
```

Scraper einzeln testen:
```bash
node scripts/test-scrapers.js                    # alle
node scripts/test-scrapers.js ra-co              # nur RA
node scripts/test-scrapers.js ai                 # AI-Fallback
```

## Setup: GitHub-Gist als Storage (für Cowork-curated Events)

Vercel ist stateless — wir brauchen einen Ort, wo IG-Events persistiert werden. **GitHub-Gist** ist dafür ehrlich gratis und reicht für unsere Größenordnung.

1. <https://github.com/settings/tokens> (Classic) → **Generate new token** → Scope nur **"gist"** anhaken.
2. Token kopieren → später als `GITHUB_TOKEN` env-var setzen.
3. <https://gist.github.com> → **Create secret gist**:
   - Filename: `picky-events.json`
   - Content: `[]`
   - **Create secret gist** klicken.
4. URL endet auf einer ID — als `GIST_ID` env-var setzen.

## Setup: Instagram via Cowork (kostenlos!)

Siehe **[INSTAGRAM-COWORK-TASK.md](./INSTAGRAM-COWORK-TASK.md)** — komplette Anleitung wie du einen täglichen Scheduled Task in Cowork einrichtest, der über deinen eingeloggten Browser IG durchsucht.

**TL;DR**: Sag Claude im Cowork-Chat: *"Richte den picky-IG-Task für 09:00 ein"* — fertig.

## Quellen-Übersicht

| Quelle                  | Was es scrapt                          | Setup                          | Kosten   |
|-------------------------|----------------------------------------|--------------------------------|----------|
| Tantris                 | Eigene Events-Seite                    | nichts                         | gratis   |
| Kongressbar             | Live-Bands & DJ                        | nichts                         | gratis   |
| Resident Advisor        | Goldene Bar + ganz München Underground | nichts                         | gratis   |
| Glockenbachwerkstatt    | Community / Queer / Pop-up             | nichts                         | gratis   |
| Mit Vergnügen           | Wöchentliche Pop-up-Tipps              | nichts                         | gratis   |
| Eventbrite              | München public listing                 | nichts (auth optional)         | gratis   |
| AI-Fallback ⭐           | 12 Gen-Z-Locations                     | `ANTHROPIC_API_KEY`            | gratis*  |
| **Instagram via Cowork**| Pop-up / FLINTA / Community Accounts   | Scheduled Task einrichten      | gratis   |

\* Claude Free-Tier reicht für täglichen Scrape (~$0.05/Tag).

## Deployment auf Vercel

1. Repo anlegen, committen, pushen.
2. <https://vercel.com> → Import Project.
3. **Environment Variables** im Vercel-Dashboard setzen:
   - `ANTHROPIC_API_KEY` (für AI-Fallback)
   - `GITHUB_TOKEN` + `GIST_ID` (für Persistenz)
   - `PICKY_SUBMIT_TOKEN` (Auth für Cowork → /api/submit-events)
   - `EVENTBRITE_TOKEN` (optional)
4. Deploy → erste URL `https://<projekt>.vercel.app`.
5. Cron-Job aus `vercel.json` (`/api/cron-scrape` täglich 06:00 UTC) erscheint automatisch.

## Endpoints

| Method | Path                | Beschreibung                                           |
|--------|---------------------|--------------------------------------------------------|
| GET    | `/`                 | Frontend.                                              |
| GET    | `/api/events`       | Feed: live + gist + seed, edge-cached 1h.              |
| POST   | `/api/submit-events`| Cowork-Task schickt Events hierher (Bearer-Auth).      |
| GET    | `/api/cron-scrape`  | Vercel Cron.                                           |
| GET    | `/api/health`       | Liveness.                                              |

## Event-Kategorien (25)

**Music & Nightlife:** live-music · dj-club · underground · karaoke · open-mic · silent-disco
**Food & Drink:** wine-tasting · popup-dinner · popup · themed-dinner · chef-table · brunch · sober
**Community & Culture:** community · flinta-queer · market · vernissage · workshop · book-reading
**Outdoor / Vibe:** rooftop-sundown · wellness · sports-watch · gaming
**Generic:** themed-night · party

## Roadmap (alles gratis)

1. **Mehr RA-Clubs** in `ra-co.js` (Blitz, Harry Klein, MMA): schnelle Reichweite.
2. **muenchen.de Veranstaltungen**: 1000+ Events aus städtischem Kalender.
3. **OpenGraph-Bilder** statt Picsum: aus Source-URLs ziehen.
4. **User-Curation** im Frontend: "Event melden"-Button.
5. **Second city**: Berlin als zweite Stadt (Frontend ist vorbereitet).

## Lizenz

Privat / pre-MVP.
