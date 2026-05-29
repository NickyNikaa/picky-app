// api/places-osm.js — Pulls Munich restaurants & bars from OpenStreetMap.
// Free, no auth. Edge-cached 24h so visitors don't trigger the upstream often.

const OVERPASS = "https://overpass-api.de/api/interpreter";
const MUNICH_BBOX = "48.085,11.39,48.244,11.78";

const QUERY = `[out:json][timeout:90];
(
  node["amenity"~"^(restaurant|bar|pub|cafe|biergarten|nightclub)$"]["name"](${MUNICH_BBOX});
  way["amenity"~"^(restaurant|bar|pub|cafe|biergarten|nightclub)$"]["name"](${MUNICH_BBOX});
);
out center tags;`;

const CUISINE_MAP = {
  italian: "italian", pizza: "italian", pasta: "italian",
  bavarian: "bavarian", german: "bavarian", austrian: "bavarian",
  french: "french",
  japanese: "japanese", sushi: "japanese", ramen: "japanese",
  chinese: "asian-fusion", thai: "asian-fusion", korean: "asian-fusion", asian: "asian-fusion",
  vietnamese: "vietnamese",
  mediterranean: "mediterranean",
  greek: "greek",
  middle_eastern: "middle-eastern", turkish: "middle-eastern",
  lebanese: "middle-eastern", israeli: "middle-eastern", arabic: "middle-eastern",
  vegan: "vegan",
  vegetarian: "vegetarian",
  steak_house: "steakhouse", american: "steakhouse",
  breakfast: "brunch", brunch: "brunch", coffee_shop: "brunch",
  cocktail: "cocktail-bar",
  wine: "wine-bar",
  international: "international", regional: "european"
};

function mapCuisine(s) {
  if (!s) return [];
  return s.split(/[;,]/).map(c => CUISINE_MAP[c.trim().toLowerCase()]).filter(Boolean).slice(0, 2);
}

function mapPlace(e) {
  const t = e.tags || {};
  const amenity = t.amenity;
  const type = ["bar","pub","nightclub"].includes(amenity) ? "bar" : "restaurant";

  let cuisine = mapCuisine(t.cuisine);
  if (cuisine.length === 0) {
    if (amenity === "bar" || amenity === "pub" || amenity === "nightclub") cuisine = ["cocktail-bar"];
    else if (amenity === "cafe") cuisine = ["brunch"];
    else if (amenity === "biergarten") cuisine = ["bavarian"];
    else cuisine = ["international"];
  }

  const features = [];
  if (t.outdoor_seating === "yes") features.push("terrace");
  if (amenity === "biergarten" || t.beer_garden === "yes") features.push("beer-garden");
  if (t["diet:vegan"] === "yes" || t["diet:vegan"] === "only") features.push("vegan");

  const hood = t["addr:suburb"] || t["addr:city_district"] || t["addr:city"] || "München";

  const bits = [];
  if (t.cuisine) bits.push(t.cuisine.replace(/[_;]/g, " "));
  if (t["addr:street"]) bits.push(t["addr:street"]);
  if (t.opening_hours) bits.push("geöffnet: " + String(t.opening_hours).slice(0, 60));
  const pitch = bits.length > 0
    ? "Aus OpenStreetMap. " + bits.join(" · ")
    : "Aus OpenStreetMap — von der Community kartiert.";

  const url = t.website || t["contact:website"] || `https://www.openstreetmap.org/${e.type}/${e.id}`;

  let price = 2;
  if (amenity === "cafe") price = 1;

  return {
    id: `osm-${e.type[0]}${e.id}`,
    type, name: t.name,
    neighborhood: hood,
    cuisine, price,
    occasion: type === "bar" ? ["casual","date"] : ["casual"],
    mood: type === "bar" ? ["lively"] : ["cozy"],
    exclusivity: 1,
    features, pitch,
    bookingUrl: url,
    osm: true
  };
}

function scoreAndFilter(elements) {
  const candidates = elements.filter(e => {
    const t = e.tags || {};
    if (!t.name) return false;
    return t.cuisine || t.website || t["contact:website"];
  });
  const scored = candidates.map(e => {
    const t = e.tags || {};
    let s = 0;
    if (t.website || t["contact:website"]) s += 3;
    if (t.cuisine) s += 2;
    if (t.opening_hours) s += 1;
    if (t.outdoor_seating === "yes") s += 1;
    if (t["addr:street"]) s += 1;
    if (t.phone || t["contact:phone"]) s += 1;
    return { e, s };
  });
  scored.sort((a,b) => b.s - a.s);
  return scored.slice(0, 800).map(({e}) => mapPlace(e));
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  // 24h edge cache, 7d stale-while-revalidate — Overpass is slow, don't hammer it
  res.setHeader("Cache-Control", "public, s-maxage=86400, stale-while-revalidate=604800");

  try {
    const r = await fetch(OVERPASS, {
      method: "POST",
      body: "data=" + encodeURIComponent(QUERY),
      headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": "picky-bot/0.1" }
    });
    if (!r.ok) throw new Error(`Overpass HTTP ${r.status}`);
    const data = await r.json();
    const places = scoreAndFilter(data.elements || []);
    res.status(200).json({
      meta: {
        generatedAt: new Date().toISOString(),
        source: "openstreetmap",
        totalElements: data.elements?.length || 0,
        returned: places.length,
        cap: 800
      },
      places
    });
  } catch (e) {
    console.error("[places-osm]", e);
    res.status(200).json({ meta: { error: e.message }, places: [] });
  }
}
