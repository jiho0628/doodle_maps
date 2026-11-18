import type { LngLat, Place } from "@/types";
import type { SearchCategory } from "../categories";

/**
 * HERE Geocoding & Search API v7 で店・施設をさがす(サーバー専用。キーをブラウザに出さない)。
 * https://www.here.com/docs/bundle/geocoding-and-search-api-developer-guide/
 *
 * 料金: discover / browse は月5,000回まで無料。
 * 規約: 結果を他社の地図に重ねるときは、出所(HERE)がわかるように表示する(HERE Platform Terms 6.4(a), 13.1)。
 *       結果を長くためない(日本は 24 時間まで。ここでは CDN に数分だけ置く)。
 */
const DISCOVER_URL = "https://discover.search.hereapi.com/v1/discover";
const BROWSE_URL = "https://browse.search.hereapi.com/v1/browse";
const TIMEOUT_MS = 6_000;
const MAX_RESULTS = 10;

/** 「よく使う」ボタンと HERE の場所の種類(Places Category System) */
export const HERE_CATEGORIES: Record<SearchCategory["id"], string[]> = {
  // Coffee-Tea / Coffee Shop / Tea House
  cafe: ["100-1100-0000", "100-1100-0010", "100-1100-0331"],
  convenience: ["600-6000-0061"],
  // Train Station / Underground Train-Subway / Commuter Rail Station
  station: ["400-4100-0035", "400-4100-0037", "400-4100-0038"],
  // Public Restroom-Toilets
  toilet: ["800-8700-0198"],
};

type HereItem = {
  id?: string;
  title?: string;
  resultType?: string;
  address?: { label?: string; countryName?: string; postalCode?: string };
  position?: { lat?: number; lng?: number };
  categories?: { id?: string; primary?: boolean }[];
};

function categoryOf(item: HereItem): Place["category"] {
  const ids = (item.categories ?? []).map((c) => c.id ?? "");
  return (Object.keys(HERE_CATEGORIES) as SearchCategory["id"][]).find((k) =>
    HERE_CATEGORIES[k].some((id) => ids.includes(id)),
  );
}

/** 「日本、〒604-8000 京都府京都市…、六角ace」から、名前と国・郵便番号を外す */
function shortAddress(item: HereItem): string | undefined {
  let label = item.address?.label ?? "";
  if (item.title && label.startsWith(item.title)) label = label.slice(item.title.length);
  label = label
    .split(/[,、]/)
    .map((s) => s.trim())
    .filter((s) => s && s !== item.title && s !== "日本" && s !== "Japan" && !/^〒?\d{3}-?\d{4}$/.test(s))
    .join(" ")
    .replace(/〒\d{3}-?\d{4}\s*/, "")
    .trim();
  return label || undefined;
}

export function parseHereResponse(json: unknown): Place[] {
  const items = (json as { items?: HereItem[] } | null)?.items;
  if (!Array.isArray(items)) return [];
  const places: Place[] = [];
  for (const item of items) {
    const lat = item.position?.lat;
    const lng = item.position?.lng;
    const name = item.title?.trim();
    if (!item.id || !name || typeof lat !== "number" || typeof lng !== "number") continue;
    places.push({
      id: `here:${item.id}`,
      name,
      address: shortAddress(item),
      position: { lng, lat },
      category: categoryOf(item),
    });
  }
  return places.slice(0, MAX_RESULTS);
}

async function get(base: string, params: Record<string, string>, key: string, fetchImpl: typeof fetch): Promise<Place[]> {
  const url = `${base}?${new URLSearchParams({ ...params, lang: "ja", limit: String(MAX_RESULTS), apiKey: key })}`;
  const res = await fetchImpl(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { title?: string; error_description?: string } | null;
    throw new Error(`here ${res.status}: ${body?.title ?? body?.error_description ?? ""}`.trim());
  }
  return parseHereResponse(await res.json());
}

const at = (c: LngLat) => `${c.lat.toFixed(5)},${c.lng.toFixed(5)}`;

/** 名前・住所でさがす(現在地の近くを優先。日本の中だけ) */
export function hereDiscover(query: string, center: LngLat, key: string, fetchImpl: typeof fetch = fetch): Promise<Place[]> {
  return get(DISCOVER_URL, { q: query, at: at(center), in: "countryCode:JPN" }, key, fetchImpl);
}

/** 近くのカフェ・コンビニ・駅・トイレを近い順に */
export function hereBrowse(
  category: SearchCategory,
  center: LngLat,
  key: string,
  fetchImpl: typeof fetch = fetch,
): Promise<Place[]> {
  return get(
    BROWSE_URL,
    {
      at: at(center),
      in: `circle:${at(center)};r=${Math.round(category.radiusM * 2)}`,
      categories: HERE_CATEGORIES[category.id].join(","),
    },
    key,
    fetchImpl,
  ).then((places) => places.map((p) => ({ ...p, category: category.id })));
}
