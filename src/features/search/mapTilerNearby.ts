import type { LngLat, Place } from "@/types";
import { distanceM } from "@/features/route";
import type { SearchCategory } from "./categories";
import { geocode } from "./geocode";

const MAX_RESULTS = 10;

/** 中心から半径 r(m)の四角(MapTiler の bbox) */
function bboxAround(center: LngLat, radiusM: number): [number, number, number, number] {
  const dLat = radiusM / 111_320;
  const dLng = radiusM / (111_320 * Math.cos((center.lat * Math.PI) / 180));
  return [center.lng - dLng, center.lat - dLat, center.lng + dLng, center.lat + dLat];
}

/**
 * MapTiler で近くの店をさがす(OpenStreetMap が遅い・使えないときの代わり)。
 * チェーン名などを店・施設(types=poi)にしぼって同時に検索し、近くの四角の中だけに絞って近い順に並べる。
 * (types=poi がないと MapTiler は店を検索せず、いつも0件になっていた)
 */
export async function searchNearbyWithMapTiler(
  category: SearchCategory,
  center: LngLat,
  options: { key: string; signal?: AbortSignal; fetchImpl?: typeof fetch },
): Promise<Place[]> {
  const radius = Math.max(category.radiusM * 2, 2000);
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
    .filter(({ d }) => d <= radius * 1.5)
    .sort((a, b) => a.d - b.d)
    .slice(0, MAX_RESULTS)
    .map(({ place }) => place);
}
