#!/usr/bin/env python3
"""
Reichert data/curated-places.json mit echten Fotos an.

Für kuratierte Orte mit echter Website (bookingUrl) wird das og:image
(bzw. twitter:image) der Seite ausgelesen und als `image` gespeichert.
Läuft einmalig lokal; danach curated-places.json committen.
Sicher: ändert nur Orte mit erreichbarem Bild, lässt den Rest unberührt.
"""
import json, os, re, urllib.request, urllib.parse
from concurrent.futures import ThreadPoolExecutor

HERE = os.path.dirname(__file__)
PATH = os.path.join(HERE, "..", "data", "curated-places.json")
TOP_N = 45          # nur die bestbewerteten anreichern
TIMEOUT = 6

UA = {"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
                    "(KHTML, like Gecko) Chrome/124 Safari/537.36"}

def is_real_site(url):
    if not url: return False
    u = url.lower()
    if "google.com/maps" in u or "openstreetmap.org" in u: return False
    return u.startswith("http")

def find_og_image(html, base):
    for pat in [r'<meta[^>]+property=["\']og:image["\'][^>]+content=["\']([^"\']+)',
                r'<meta[^>]+content=["\']([^"\']+)["\'][^>]+property=["\']og:image["\']',
                r'<meta[^>]+name=["\']twitter:image["\'][^>]+content=["\']([^"\']+)']:
        m = re.search(pat, html, re.I)
        if m:
            img = m.group(1).strip()
            if img.startswith("//"): img = "https:" + img
            elif img.startswith("/"): img = urllib.parse.urljoin(base, img)
            if img.startswith("http"): return img
    return None

def fetch_image(place):
    url = place.get("bookingUrl")
    if not is_real_site(url): return None
    try:
        req = urllib.request.Request(url, headers=UA)
        with urllib.request.urlopen(req, timeout=TIMEOUT) as r:
            html = r.read(200_000).decode("utf-8", "ignore")
        img = find_og_image(html, url)
        if not img: return None
        # Logos / Icons aussortieren – die taugen nicht als Banner
        low = img.lower()
        if any(bad in low for bad in ["logo", "icon", "animation", "favicon", "white.", "schriftzug"]):
            return None
        if low.split("?")[0].endswith(".svg"): return None
        # Bild-URL kurz validieren (echtes Rasterbild, nicht winzig)
        ir = urllib.request.Request(img, headers=UA)
        with urllib.request.urlopen(ir, timeout=TIMEOUT) as ri:
            ct = ri.headers.get("Content-Type", "")
            cl = int(ri.headers.get("Content-Length", "0") or 0)
            if ri.status == 200 and "image" in ct and "svg" not in ct and (cl == 0 or cl > 15000):
                return img
    except Exception:
        return None
    return None

def main():
    data = json.load(open(PATH, encoding="utf-8"))
    for p in data: p.pop("image", None)   # vorherige (auch Logo-)Bilder zurücksetzen
    targets = [p for p in sorted(data, key=lambda x: x.get("rating", 0), reverse=True)
               if p.get("curated") and is_real_site(p.get("bookingUrl")) and not p.get("image")][:TOP_N]
    print(f"Prüfe {len(targets)} Top-Orte mit echter Website…")

    found = 0
    with ThreadPoolExecutor(max_workers=10) as ex:
        results = list(ex.map(lambda p: (p, fetch_image(p)), targets))
    for p, img in results:
        if img:
            p["image"] = img
            found += 1
            print(f"  ✓ {p['name'][:34]:34} {img[:70]}")
        else:
            print(f"  – {p['name'][:34]:34} (kein Bild gefunden)")

    json.dump(data, open(PATH, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print(f"\n{found} echte Bilder hinzugefügt -> curated-places.json")

if __name__ == "__main__":
    main()
