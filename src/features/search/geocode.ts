import type { LngLat, Place, PlaceCategory } from "@/types";

/**
 * MapTiler Geocoding で文字から場所をさがす。
 * https://docs.maptiler.com/cloud/api/geocoding/
 * キーはブラウザに公開される前提のもの(NEXT_PUBLIC_MAPTILER_KEY)。
 */
export const MAPTILER_GEOCODING_URL = "https://api.maptiler.com/geocoding";

export function buildGeocodeUrl(
  query: string,
  key: string,
  proximity?: LngLat | null,
  extra: { bbox?: [number, number, number, number]; limit?: number; types?: string } = {},
): string {
  const params = new URLSearchParams({
    key,
    language: "ja",
    limit: String(extra.limit ?? 10),
    // 日本国内に絞る(海外の同名の場所が混ざらないように)
    country: "jp",
  });
  if (proximity) params.set("proximity", `${proximity.lng.toFixed(5)},${proximity.lat.toFixed(5)}`);
  // 店・施設(poi)は初期設定では検索対象に入っていないため、店をさがすときは types=poi を付ける
  if (extra.types) params.set("types", extra.types);
  if (extra.bbox) params.set("bbox", extra.bbox.map((n) => n.toFixed(5)).join(","));
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
  options: {
    key: string;
    proximity?: LngLat | null;
    bbox?: [number, number, number, number];
    limit?: number;
    types?: string;
    signal?: AbortSignal;
    fetchImpl?: typeof fetch;
  },
): Promise<Place[]> {
  const { key, proximity, bbox, limit, types, signal, fetchImpl = fetch } = options;
  const res = await fetchImpl(buildGeocodeUrl(query, key, proximity, { bbox, limit, types }), { signal });
  if (!res.ok) throw new Error(`geocoding ${res.status}`);
  return parseGeocodeResponse(await res.json());
}

/** 中心から半径 r(m)の四角(MapTiler の bbox: 西,南,東,北) */
export function bboxAround(center: LngLat, radiusM: number): [number, number, number, number] {
  const dLat = radiusM / 111_320;
  const dLng = radiusM / (111_320 * Math.cos((center.lat * Math.PI) / 180));
  return [center.lng - dLng, center.lat - dLat, center.lng + dLng, center.lat + dLat];
}

/** 名前での検索で、まずさがす範囲(現在地から) */
const NEAR_RADIUS_M = 5_000;
/** これより遠いものは、近いものより下に回す */
const FAR_M = 50_000;

function distanceKm(a: LngLat, b: LngLat): number {
  const rad = Math.PI / 180;
  const x = (b.lng - a.lng) * rad * Math.cos(((a.lat + b.lat) / 2) * rad);
  const y = (b.lat - a.lat) * rad;
  return Math.sqrt(x * x + y * y) * 6371;
}

/** 地名・住所(初期設定)と店・施設(poi)を同時にさがす */
async function geocodeBoth(
  query: string,
  options: Parameters<typeof geocode>[1],
): Promise<Place[]> {
  const settled = await Promise.allSettled([geocode(query, options), geocode(query, { ...options, types: "poi" })]);
  const failed = settled.find((r) => r.status === "rejected");
  if (failed && settled.every((r) => r.status === "rejected")) throw failed.reason;
  // 店・施設を先に(「六角ace」のような店名で、似た地名が上に来ないように)
  return [settled[1], settled[0]].flatMap((r) => (r.status === "fulfilled" ? r.value : []));
}

/**
 * 文字での検索。地名・住所と店・施設(poi)を同時にさがす(MapTiler は初期設定では店を検索しない)。
 * 現在地がわかるときは、まず近く(5km)だけでさがして近い順に並べ、少なければ全国に広げる。
 * 全国の結果は、50km より遠いものを近いものより下にする(京都で「六角」と入れて姫路が先頭に来ないように)。
 */
export async function searchPlacesByText(
  query: string,
  options: { key: string; proximity?: LngLat | null; signal?: AbortSignal; fetchImpl?: typeof fetch },
): Promise<Place[]> {
  const { proximity } = options;
  const results: Place[] = [];
  const add = (places: Place[]) => {
    for (const p of places) if (!results.some((r) => r.id === p.id)) results.push(p);
  };

  if (proximity) {
    const near = await geocodeBoth(query, { ...options, bbox: bboxAround(proximity, NEAR_RADIUS_M) }).catch(
      (error: unknown) => {
        if (options.signal?.aborted) throw error;
        return [] as Place[];
      },
    );
    add(near.sort((a, b) => distanceKm(proximity, a.position) - distanceKm(proximity, b.position)));
    if (results.length >= 3) return results.slice(0, 10);
  }

  const wide = await geocodeBoth(query, options).catch((error: unknown) => {
    if (results.length > 0 && !options.signal?.aborted) return [] as Place[];
    throw error;
  });
  if (proximity) {
    // 並び(関連の強さ)は保ったまま、遠すぎるものだけ後ろへ
    const isFar = (p: Place) => distanceKm(proximity, p.position) > FAR_M / 1000;
    add([...wide.filter((p) => !isFar(p)), ...wide.filter(isFar)]);
  } else {
    add(wide);
  }
  return results.slice(0, 10);
}
