import type { LngLat, Place } from "@/types";
import { distanceM } from "@/features/route";
import type { SearchCategory } from "./categories";

/**
 * 近くのカフェ・コンビニ・駅・トイレを OpenStreetMap(Overpass API)でさがす。
 * キー不要。MapTiler の文字検索は「コンビニ」で各チェーン店を拾えないため、こちらを使う。
 */
export const OVERPASS_URL = "https://overpass-api.de/api/interpreter";

/** 本家が混んでいる(429/504)ときに順に試す予備サーバー */
export const OVERPASS_ENDPOINTS = [
  OVERPASS_URL,
  "https://overpass.private.coffee/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
];

/** 1台あたりの待ち時間 */
const ENDPOINT_TIMEOUT_MS = 9_000;

/** 一度に出す件数 */
const MAX_RESULTS = 10;

export function buildOverpassQuery(category: SearchCategory, center: LngLat, radiusM = category.radiusM): string {
  const around = `(around:${Math.round(radiusM)},${center.lat.toFixed(6)},${center.lng.toFixed(6)})`;
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

/** 1つのサーバーにたずねる */
async function queryOverpass(
  endpoint: string,
  query: string,
  fetchImpl: typeof fetch,
  signal?: AbortSignal,
): Promise<unknown> {
  const timeout = AbortSignal.timeout(ENDPOINT_TIMEOUT_MS);
  const res = await fetchImpl(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
      // サーバーから呼ぶときは名乗る(Overpass の利用ルール。ブラウザでは無視される)
      ...(typeof window === "undefined" ? { "User-Agent": "doodle_maps/1.0 (nearby search)" } : {}),
    },
    body: new URLSearchParams({ data: query }).toString(),
    signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
  });
  if (!res.ok) throw new Error(`overpass ${res.status}`);
  const json = (await res.json()) as { elements?: unknown; remark?: string };
  // 混んでいると 200 のまま remark にエラーが入り elements が空になる
  if (!Array.isArray(json.elements) || (json.elements.length === 0 && json.remark)) {
    throw new Error(`overpass remark: ${json.remark ?? "no elements"}`);
  }
  return json;
}

/**
 * Overpass で近くをさがす。サーバーが混んでいれば予備に切り替え、
 * 近くに1件もなければ範囲を3倍に広げてもう一度さがす。
 * (サーバー側の /api/nearby と、ブラウザからの最後の手段の両方で使う)
 */
export async function fetchNearbyFromOverpass(
  category: SearchCategory,
  center: LngLat,
  options: { signal?: AbortSignal; fetchImpl?: typeof fetch; endpoints?: string[] } = {},
): Promise<Place[]> {
  const { signal, fetchImpl = fetch, endpoints = OVERPASS_ENDPOINTS } = options;
  for (const radius of [category.radiusM, category.radiusM * 3]) {
    const query = buildOverpassQuery(category, center, radius);
    let json: unknown = undefined;
    let lastError: unknown;
    for (const endpoint of endpoints) {
      try {
        json = await queryOverpass(endpoint, query, fetchImpl, signal);
        break;
      } catch (error) {
        if (signal?.aborted) throw error;
        lastError = error;
      }
    }
    if (json === undefined) throw lastError ?? new Error("overpass unavailable");
    const places = parseOverpassResponse(json, category, center);
    if (places.length > 0) return places;
  }
  return [];
}

/**
 * ブラウザから近くをさがす。まずサーバー(/api/nearby、キャッシュあり)に聞き、
 * だめなときだけブラウザから直接 Overpass に聞く。
 */
export async function searchNearby(
  category: SearchCategory,
  center: LngLat,
  options: { signal?: AbortSignal; fetchImpl?: typeof fetch } = {},
): Promise<Place[]> {
  const { signal, fetchImpl = fetch } = options;
  const params = new URLSearchParams({
    category: category.id,
    lat: center.lat.toFixed(4),
    lng: center.lng.toFixed(4),
  });
  try {
    const res = await fetchImpl(`/api/nearby?${params.toString()}`, { signal });
    if (res.ok) {
      const json = (await res.json()) as { places?: Place[] };
      if (Array.isArray(json.places)) return json.places;
    }
  } catch (error) {
    if (signal?.aborted) throw error;
  }
  return fetchNearbyFromOverpass(category, center, { signal, fetchImpl });
}
