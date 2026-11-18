import type { LngLat, Place } from "@/types";
import { distanceM } from "@/features/route";
import type { SearchCategory } from "./categories";
import { bboxAround, geocode } from "./geocode";

const MAX_RESULTS = 10;

/** 1回分: 半径 radius の四角の中で、各言葉を同時にさがす */
async function searchWithin(
  category: SearchCategory,
  center: LngLat,
  radius: number,
  options: { key: string; signal?: AbortSignal; fetchImpl?: typeof fetch },
): Promise<{ place: Place; d: number }[]> {
  const bbox = bboxAround(center, radius);
  const settled = await Promise.allSettled(
    category.mapTilerQueries.map((q) => geocode(q, { ...options, proximity: center, bbox, limit: 10, types: "poi" })),
  );
  if (settled.every((r) => r.status === "rejected")) throw new Error("maptiler unavailable");
  const seen = new Set<string>();
  return settled
    .flatMap((r) => (r.status === "fulfilled" ? r.value : []))
    .filter((p) => (seen.has(p.id) ? false : (seen.add(p.id), true)))
    .map((p) => ({ place: { ...p, category: category.id }, d: distanceM(center, p.position) }))
    .filter(({ d }) => d <= radius * 1.2);
}

/** これより少なければ範囲を広げる */
const ENOUGH = 3;

/**
 * MapTiler で近くの店をさがす(OpenStreetMap が遅い・使えないときの代わり)。
 * チェーン名などを店・施設(types=poi)にしぼって同時に検索し、近い順に並べる。
 * (types=poi がないと MapTiler は店を検索しない)
 *
 * MapTiler は1語あたり10件までしか返さず、広い四角だと遠い店で埋まって近くの店がもれる。
 * そのため、まず歩いて行ける範囲(カテゴリの半径)だけでさがし、少なければ広げる。
 */
export async function searchNearbyWithMapTiler(
  category: SearchCategory,
  center: LngLat,
  options: { key: string; signal?: AbortSignal; fetchImpl?: typeof fetch },
): Promise<Place[]> {
  let found = await searchWithin(category, center, category.radiusM, options);
  if (found.length < ENOUGH) {
    const wider = await searchWithin(category, center, category.radiusM * 2.5, options).catch(() => []);
    const ids = new Set(found.map((f) => f.place.id));
    found = [...found, ...wider.filter((f) => !ids.has(f.place.id))];
  }
  return found
    .sort((a, b) => a.d - b.d)
    .slice(0, MAX_RESULTS)
    .map(({ place }) => place);
}
