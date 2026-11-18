import type { LngLat, Place, PlaceCategory } from "@/types";

/**
 * MapTiler Geocoding で文字から場所をさがす。
 * https://docs.maptiler.com/cloud/api/geocoding/
 * キーはブラウザに公開される前提のもの(NEXT_PUBLIC_MAPTILER_KEY)。
 */
export const MAPTILER_GEOCODING_URL = "https://api.maptiler.com/geocoding";

export function buildGeocodeUrl(query: string, key: string, proximity?: LngLat | null): string {
  const params = new URLSearchParams({
    key,
    language: "ja",
    limit: "10",
    // 日本国内に絞る(海外の同名の場所が混ざらないように)
    country: "jp",
  });
  if (proximity) params.set("proximity", `${proximity.lng.toFixed(5)},${proximity.lat.toFixed(5)}`);
  return `${MAPTILER_GEOCODING_URL}/${encodeURIComponent(query)}.json?${params.toString()}`;
}

type GeocodeFeature = {
  id?: string | number;
  text?: string;
  place_name?: string;
  center?: [number, number];
  geometry?: { type?: string; coordinates?: unknown };
  properties?: { categories?: unknown; kind?: unknown };
};

const CATEGORY_WORDS: [RegExp, PlaceCategory][] = [
  [/cafe|coffee/i, "cafe"],
  [/convenience/i, "convenience"],
  [/station|railway|subway/i, "station"],
  [/toilet/i, "toilet"],
  [/school|university|college/i, "school"],
];

function guessCategory(f: GeocodeFeature): PlaceCategory | undefined {
  const raw = [f.properties?.categories, f.properties?.kind].flat().filter((v) => typeof v === "string").join(" ");
  if (!raw) return undefined;
  return CATEGORY_WORDS.find(([re]) => re.test(raw))?.[1] ?? "other";
}

function centerOf(f: GeocodeFeature): LngLat | null {
  const c = f.center ?? (f.geometry?.type === "Point" ? (f.geometry.coordinates as [number, number]) : undefined);
  if (!Array.isArray(c) || typeof c[0] !== "number" || typeof c[1] !== "number") return null;
  return { lng: c[0], lat: c[1] };
}

/** MapTiler の応答を Place[] にする(形がおかしいものは捨てる) */
export function parseGeocodeResponse(json: unknown): Place[] {
  const features = (json as { features?: GeocodeFeature[] } | null)?.features;
  if (!Array.isArray(features)) return [];
  const places: Place[] = [];
  for (const f of features) {
    const position = centerOf(f);
    const name = (f.text ?? "").trim() || (f.place_name ?? "").split(",")[0]?.trim();
    if (!position || !name) continue;
    // place_name は「名前, 住所…」の形。名前の部分を外して住所にする
    const rest = (f.place_name ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s && s !== "日本" && s !== "Japan");
    if (rest[0] === name) rest.shift();
    places.push({
      id: `maptiler:${f.id ?? `${position.lng},${position.lat}`}`,
      name,
      address: rest.length > 0 ? rest.reverse().join(" ") : undefined,
      position,
      category: guessCategory(f),
    });
  }
  return places;
}

export async function geocode(
  query: string,
  options: { key: string; proximity?: LngLat | null; signal?: AbortSignal; fetchImpl?: typeof fetch },
): Promise<Place[]> {
  const { key, proximity, signal, fetchImpl = fetch } = options;
  const res = await fetchImpl(buildGeocodeUrl(query, key, proximity), { signal });
  if (!res.ok) throw new Error(`geocoding ${res.status}`);
  return parseGeocodeResponse(await res.json());
}
