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

/**
 * サーバーから聞くときのヘッダー。Overpass は 2026年4月から、名乗らない・連絡先のないアクセスを
 * 406 で断るようになったため、アプリ名にこのサイトの URL を添え、Referer も付ける。
 */
export function overpassServerHeaders(siteOrigin?: string): Record<string, string> {
  if (!siteOrigin) return { "User-Agent": OVERPASS_USER_AGENT };
  return { "User-Agent": `${OVERPASS_USER_AGENT} (+${siteOrigin})`, Referer: `${siteOrigin}/` };
}

/** 本家が混んでいる(429/504)ときに順に試す予備サーバー */
export const OVERPASS_ENDPOINTS = [
  OVERPASS_URL,
  "https://overpass.private.coffee/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
];

/**
 * 1回の問い合わせで待つ時間。予備サーバーは混んでいると 3〜6 秒かかるので、
 * 短すぎると「全部だめ」になる(以前の 3.5 秒では京都で全滅していた)
 */
export const ENDPOINT_TIMEOUT_MS = 7_000;

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
  headers?: Record<string, string>,
): Promise<unknown> {
  // GET + ヘッダーなし(ブラウザでは「単純なリクエスト」になり、事前確認の往復がない)。
  // 独自の Accept を付けると overpass-api.de が 406 で断るため付けない。
  // サーバーから呼ぶときだけ、利用ルールどおりアプリ名と連絡先(サイトの URL)を名乗る。
  const url = `${endpoint}?${new URLSearchParams({ data: query }).toString()}`;
  const host = new URL(endpoint).host;
  let res: Response;
  try {
    res = await fetchImpl(url, {
      method: "GET",
      headers: headers ?? (typeof window === "undefined" ? overpassServerHeaders() : undefined),
      signal,
    });
  } catch (error) {
    // どこで・なぜ失敗したかをあとで調べられるよう、サーバー名を付ける
    // Node の fetch は「fetch failed」とだけ言うので、本当の理由(cause)も添える
    const cause = error instanceof Error && error.cause instanceof Error ? ` (${error.cause.message})` : "";
    const reason = signal.aborted ? "timeout" : error instanceof Error ? `${error.message}${cause}` : String(error);
    throw new Error(`${host}: ${reason}`);
  }
  if (!res.ok) throw new Error(`${host}: HTTP ${res.status}`);
  const json = (await res.json()) as { elements?: unknown; remark?: string };
  // 混んでいると 200 のまま remark にエラーが入り elements が空になる
  if (!Array.isArray(json.elements) || (json.elements.length === 0 && json.remark)) {
    throw new Error(`${host}: remark ${json.remark ?? "no elements"}`);
  }
  return json;
}

/** 全サーバーに同時にたずね、いちばん早く返ってきた答えを使う(残りは取り消す) */
async function raceOverpass(
  endpoints: string[],
  query: string,
  fetchImpl: typeof fetch,
  signal?: AbortSignal,
  headers?: Record<string, string>,
  timeoutMs = ENDPOINT_TIMEOUT_MS,
): Promise<unknown> {
  const controller = new AbortController();
  const signals = [controller.signal, AbortSignal.timeout(timeoutMs)];
  if (signal) signals.push(signal);
  const combined = AbortSignal.any(signals);
  try {
    return await Promise.any(endpoints.map((e) => queryOverpass(e, query, fetchImpl, combined, headers)));
  } catch (error) {
    if (signal?.aborted) throw signal.reason ?? error;
    // 全サーバーの理由をまとめる(例: "overpass-api.de: HTTP 406; overpass.kumi.systems: timeout")
    if (error instanceof AggregateError) {
      const reasons = error.errors.map((e) => (e instanceof Error ? e.message : String(e)));
      throw new Error(`overpass failed: ${reasons.join("; ")}`);
    }
    throw error;
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
  options: { signal?: AbortSignal; fetchImpl?: typeof fetch; endpoints?: string[]; headers?: Record<string, string>; timeoutMs?: number } = {},
): Promise<Place[]> {
  const { signal, fetchImpl = fetch, endpoints = OVERPASS_ENDPOINTS, headers, timeoutMs } = options;
  for (const radius of [category.radiusM, category.radiusM * 3]) {
    const json = await raceOverpass(endpoints, buildOverpassQuery(category, center, radius), fetchImpl, signal, headers, timeoutMs);
    const places = parseOverpassResponse(json, category, center);
    if (places.length > 0) return places;
  }
  return [];
}

/**
 * ブラウザから近くをさがす(サーバーの /api/nearby 経由。キャッシュあり)。
 * ブラウザから直接 Overpass には聞かない: ブラウザはアプリ名を名乗れず 406 で断られ、
 * 予備サーバーも待たされるだけだったため。
 */
const CLIENT_CACHE_MS = 5 * 60_000;
/** /api/nearby が失敗したら、しばらくは聞かない(毎回7秒以上待って失敗するのを避ける) */
const FAILURE_BACKOFF_MS = 2 * 60_000;
const clientCache = new Map<string, { at: number; places: Place[] }>();
let lastFailureAt = 0;

/** 「もう一度ためす」のとき: 失敗の記録を消して、すぐにサーバーへ聞けるようにする */
export function resetNearbyFailure() {
  lastFailureAt = 0;
}

/** テスト用 */
export function clearNearbyCache() {
  clientCache.clear();
  lastFailureAt = 0;
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
  if (Date.now() - lastFailureAt < FAILURE_BACKOFF_MS) throw new Error("nearby: recently failed, skipped");
  try {
    const places = await searchNearbyUncached(category, center, options);
    clientCache.set(key, { at: Date.now(), places });
    return places;
  } catch (error) {
    if (!options.signal?.aborted) lastFailureAt = Date.now();
    throw error;
  }
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
  // サーバー側は1回 7 秒まで(範囲を広げると2回)なので、それ以上は待たない
  const timeout = AbortSignal.timeout(ENDPOINT_TIMEOUT_MS * 2 + 1_000);
  const res = await fetchImpl(`/api/nearby?${params.toString()}`, {
    signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
  });
  if (res.ok) {
    const json = (await res.json()) as { places?: Place[] };
    if (Array.isArray(json.places)) return json.places;
  }
  // 502 のときはサーバーが理由(detail)を返す。DevTools のコンソールで見られるようにする
  const body = (await res.json().catch(() => null)) as { detail?: string } | null;
  console.warn("[nearby] /api/nearby failed", res.status, body?.detail ?? "");
  throw new Error(`nearby ${res.status}`);
}
