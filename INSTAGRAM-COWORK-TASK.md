# Instagram-Curation via Cowork Scheduled Task

Picky bekommt Instagram-Events nicht über einen Backend-Scraper (zu teuer / zu fragil), sondern über Claude im **Cowork-Modus**, der über deinen eingeloggten Browser läuft.

## Voraussetzungen

- ✅ Chrome-Extension installiert (hast du)
- ✅ Du bist in Chrome bei Instagram als `@nicky.nikaa` eingeloggt
- ✅ Dein Mac läuft, wenn der Task ausgeführt wird (z.B. morgens 9 Uhr)
- ✅ Picky-Backend ist deployed und du hast die URL + `PICKY_SUBMIT_TOKEN`

## Einrichten

Sag mir einfach:

> **"Bitte richte einen täglichen Scheduled Task um 09:00 ein, der meinen Instagram nach picky-Events durchsucht."**

Ich erstelle dann den Task mit dem unten stehenden Prompt. Du kannst die Account-Liste und die Uhrzeit später jederzeit ändern.

## Der Task-Prompt (zum Selbst-Einsetzen falls nötig)

```
Tagesaufgabe: Picky Instagram-Curation.

Ziel: Events aus den Stories und letzten Posts der unten gelisteten Münchner
Accounts auf Instagram extrahieren und an mein picky-Backend submitten.

1. Öffne Chrome und navigiere zu instagram.com (ich bin als @nicky.nikaa eingeloggt).

2. Besuche diese Accounts und scrolle durch die letzten 5 Posts + alle aktuellen
   Stories. Suche nach Events MIT konkretem Datum in der Zukunft:

   POP-UP & COMMUNITY:
   - @lostgirls.muc          (FLINTA pop-up party)
   - @glockenbachwerkstatt    (community / queer / kultur)
   - @popupmunich             (pop-up stores)
   - @sustainable.munich      (community / sustainability)
   - @rausgegangen.muc        (event aggregator)

   GASTRO TRENDY:
   - @moromou.munich
   - @casele.muc
   - @muniqo.rooftop
   - @emmiskitchen
   - @feischo
   - @pacifictimesmunich
   - @loulou_bar

   BARS:
   - @schumannsbar
   - @goldenebar
   - @tradervics_munich

3. Für jeden gefundenen Event extrahiere:
   - title (kurz)
   - date (YYYY-MM-DD, muss in der Zukunft sein)
   - time (HH:MM oder null)
   - venueName (Account oder Location)
   - category (live-music | dj-club | underground | popup-dinner | popup |
     flinta-queer | community | wine-tasting | themed-night | party | brunch | ...)
   - price (z.B. "Eintritt frei" oder "ab 15€")
   - pitch (1-2 Sätze, max 200 Zeichen)
   - sourceUrl (der konkrete IG-Post-Link)
   - source: "instagram-cowork"

4. Schicke alle gefundenen Events per POST an:

   curl -X POST https://<DEINE-PICKY-URL>.vercel.app/api/submit-events \
        -H "Authorization: Bearer <PICKY_SUBMIT_TOKEN>" \
        -H "Content-Type: application/json" \
        -d '{"events":[ ...alle gefundenen events... ]}'

5. Antworte mir mit einer kurzen Zusammenfassung:
   - Anzahl Events gefunden
   - Anzahl neu in picky (server returned addedCount)
   - 3-5 Highlights mit Datum

WICHTIG:
- KEINE Events erfinden — wenn unklar, weglassen
- KEINE Dauer-Angebote ("jeden Donnerstag") außer mit konkretem nächsten Datum
- Doppelte Events nicht mehrfach submitten (Backend dedupliziert anhand id)
```

## Wie Daten ankommen

- Task läuft → Chrome-Extension → Instagram (mit deinem Login) → Posts gelesen.
- Claude extrahiert Events → POST an `/api/submit-events`.
- Backend speichert sie in deinem GitHub-Gist (kostenlos, persistent).
- `/api/events` mischt sie automatisch mit Live-Scraper-Events + Seeds.
- Frontend zeigt sie an.

## Account-Liste pflegen

Account-Liste lebt im Prompt. Um Accounts hinzuzufügen / zu entfernen:
- Sag mir: *"Füge @hipsterspot zur picky-IG-Liste hinzu"*
- Oder: *"Entferne @feischo aus dem picky-Task"*

Ich update den Scheduled Task entsprechend.

## Was wenn der Task fehlschlägt?

Häufige Ursachen:
- **IG fragt 2FA / Captcha**: Login manuell durchführen, dann re-run.
- **Mac ist aus**: Task wird beim nächsten Mal ausgeführt.
- **Chrome nicht offen**: Task startet Chrome automatisch.
- **Backend offline**: Events werden lokal verworfen, beim nächsten Run neu versucht.
