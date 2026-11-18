import type { LngLat, Place } from "@/types";
import { distanceM } from "@/features/route";
import type { SearchCategory } from "./categories";

/**
 * 近くのカフェ・コンビニ・駅・トイレを OpenStreetMap(Overpass API)でさがす。
 * キー不要。MapTiler の文字検索は「コンビニ」で各チェーン店を拾えないため、こちらを使う。
 */
export const OVERPASS_URL = "https://overpass-api.de/api/interpreter";

/** 一度に出す件数 */
const MAX_RESULTS = 10;

export function buildOverpassQuery(category: SearchCategory, center: LngLat): string {
  const around = `(around:${category.radiusM},${center.lat.toFixed(6)},${center.lng.toFixed(6)})`;
  return `[out:json][timeout:15];nwr${category.overpassFilter}${around};out center 60;`;
}

type OverpassElement = {
  type?: string;
  id?: number;
  lat?: number;
  lon?: number;
  center?: { lat?: number; lon?: number };
  tags?: Record<string, string>;
};

export function parseOverpassResponse(json: unknown, category: SearchCategory, center: LngLat): Place[] {
  const elements = (json as { elements?: OverpassElement[] } | null)?.elements;
  if (!Array.isArray(elements)) return [];
  const seen = new Set<string>();
  const places: (Place & { d: number })[] = [];
  for (const el of elements) {
    const lat = el.lat ?? el.center?.lat;
    const lng = el.lon ?? el.center?.lon;
    if (typeof lat !== "number" || typeof lng !== "number") continue;
    const tags = el.tags ?? {};
    const name = (tags["name:ja"] || tags.name || tags.brand || category.unnamedLabel || "").trim();
    if (!name) continue;
    const position = { lng, lat };
    // 同じ駅が複数の点で入っていることがあるので、名前+だいたいの位置で1つにまとめる
    const key = `${name}:${lat.toFixed(3)},${lng.toFixed(3)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    places.push({
      id: `osm:${el.type ?? "node"}/${el.id ?? key}`,
      name,
      address: tags["addr:full"] || undefined,
      position,
      category: category.id,
      d: distanceM(center, position),
    });
  }
  return places
    .sort((a, b) => a.d - b.d)
    .slice(0, MAX_RESULTS)
    .map((p) => {
      const { d, ...place } = p;
      void d;
      return place;
    });
}

export async function searchNearby(
  category: SearchCategory,
  center: LngLat,
  options: { signal?: AbortSignal; fetchImpl?: typeof fetch } = {},
): Promise<Place[]> {
  const { signal, fetchImpl = fetch } = options;
  const res = await fetchImpl(OVERPASS_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ data: buildOverpassQuery(category, center) }).toString(),
    signal,
  });
  if (!res.ok) throw new Error(`overpass ${res.status}`);
  return parseOverpassResponse(await res.json(), category, center);
}
