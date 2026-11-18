import type { LngLat, Place } from "@/types";
import { distanceM } from "@/features/route";
import type { SearchCategory } from "./categories";

/**
 * 近くのカフェ・コンビニ・駅・トイレを OpenStreetMap(Overpass API)でさがす。
 * キー不要。MapTiler の文字検索は「コンビニ」で各チェーン店を拾えないため、こちらを使う。
 */
export const OVERPASS_URL = "https://overpass-api.de/api/interpreter";

/** サーバーから Overpass に聞くときに名乗るアプリ名 */
export const OVERPASS_USER_AGENT = "doodle_maps/1.0";

/** 本家が混んでいる(429/504)ときに順に試す予備サーバー */
export const OVERPASS_ENDPOINTS = [
  OVERPASS_URL,
  "https://overpass.private.coffee/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
];

/** 1台あたりの待ち時間 */
const ENDPOINT_TIMEOUT_MS = 3_500;

/** 一度に出す件数 */
const MAX_RESULTS = 10;

export function buildOverpassQuery(category: SearchCategory, center: LngLat, radiusM = category.radiusM): string {
  const around = `(around:${Math.round(radiusM)},${center.lat.toFixed(6)},${center.lng.toFixed(6)})`;
  // relation(複合施設など)は重いうえに店はほぼ node/way なので除く
  return `[out:json][timeout:8];nw${category.overpassFilter}${around};out center 40;`;
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
  signal: AbortSignal,
): Promise<unknown> {
  // GET + ヘッダーなし(ブラウザでは「単純なリクエスト」になり、事前確認の往復がない)。
  // 独自の Accept を付けると overpass-api.de が 406 で断るため付けない。
  // サーバーから呼ぶときだけ、利用ルールどおりアプリ名を名乗る。
  const url = `${endpoint}?${new URLSearchParams({ data: query }).toString()}`;
  const res = await fetchImpl(url, {
    method: "GET",
    headers: typeof window === "undefined" ? { "User-Agent": OVERPASS_USER_AGENT } : undefined,
    signal,
  });
  if (!res.ok) throw new Error(`overpass ${res.status}`);
  const json = (await res.json()) as { elements?: unknown; remark?: string };
  // 混んでいると 200 のまま remark にエラーが入り elements が空になる
  if (!Array.isArray(json.elements) || (json.elements.length === 0 && json.remark)) {
    throw new Error(`overpass remark: ${json.remark ?? "no elements"}`);
  }
  return json;
}

/** 全サーバーに同時にたずね、いちばん早く返ってきた答えを使う(残りは取り消す) */
async function raceOverpass(
  endpoints: string[],
  query: string,
  fetchImpl: typeof fetch,
  signal?: AbortSignal,
): Promise<unknown> {
  const controller = new AbortController();
  const signals = [controller.signal, AbortSignal.timeout(ENDPOINT_TIMEOUT_MS)];
  if (signal) signals.push(signal);
  const combined = AbortSignal.any(signals);
  try {
    return await Promise.any(endpoints.map((e) => queryOverpass(e, query, fetchImpl, combined)));
  } catch (error) {
    if (signal?.aborted) throw signal.reason ?? error;
    throw error instanceof AggregateError ? (error.errors.at(-1) ?? error) : error;
  } finally {
    controller.abort();
  }
}

/**
 * Overpass で近くをさがす。本家と予備サーバーに同時に聞いて早い方を使い、
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
    const json = await raceOverpass(endpoints, buildOverpassQuery(category, center, radius), fetchImpl, signal);
    const places = parseOverpassResponse(json, category, center);
    if (places.length > 0) return places;
  }
  return [];
}

/**
 * ブラウザから近くをさがす。まずサーバー(/api/nearby、キャッシュあり)に聞き、
 * だめなときだけブラウザから直接 Overpass に聞く。
 */
const CLIENT_CACHE_MS = 5 * 60_000;
const clientCache = new Map<string, { at: number; places: Place[] }>();

/** テスト用 */
export function clearNearbyCache() {
  clientCache.clear();
}

export async function searchNearby(
  category: SearchCategory,
  center: LngLat,
  options: { signal?: AbortSignal; fetchImpl?: typeof fetch } = {},
): Promise<Place[]> {
  // 同じ場所(約100m)・同じカテゴリは5分間覚えておき、すぐに出す
  const key = `${category.id}:${center.lat.toFixed(3)},${center.lng.toFixed(3)}`;
  const hit = clientCache.get(key);
  if (hit && Date.now() - hit.at < CLIENT_CACHE_MS) return hit.places;
  const places = await searchNearbyUncached(category, center, options);
  clientCache.set(key, { at: Date.now(), places });
  return places;
}

async function searchNearbyUncached(
  category: SearchCategory,
  center: LngLat,
  options: { signal?: AbortSignal; fetchImpl?: typeof fetch },
): Promise<Place[]> {
  const { signal, fetchImpl = fetch } = options;
  const params = new URLSearchParams({
    category: category.id,
    lat: center.lat.toFixed(4),
    lng: center.lng.toFixed(4),
  });
  try {
    // サーバー側は1回 3.5 秒まで(範囲を広げると2回)なので、それ以上は待たない
    const timeout = AbortSignal.timeout(8_000);
    const res = await fetchImpl(`/api/nearby?${params.toString()}`, {
      signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
    });
    if (res.ok) {
      const json = (await res.json()) as { places?: Place[] };
      if (Array.isArray(json.places)) return json.places;
    }
  } catch (error) {
    if (signal?.aborted) throw error;
  }
  return fetchNearbyFromOverpass(category, center, { signal, fetchImpl });
}
