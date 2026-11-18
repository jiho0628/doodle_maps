import type { Place } from "@/types";

/**
 * 道案内画面の URL。検索結果やお気に入りの「行く」はこれで作る。
 *   /navigate?lng=139.76&lat=35.68&name=カフェ&address=…
 */
export function navigateHref(place: Pick<Place, "name" | "position" | "address">): string {
  const params = new URLSearchParams({
    lng: String(round(place.position.lng)),
    lat: String(round(place.position.lat)),
    name: place.name,
  });
  if (place.address) params.set("address", place.address);
  return `/navigate?${params.toString()}`;
}

/** 小数7桁(約1cm)で十分 */
function round(n: number): number {
  return Math.round(n * 1e7) / 1e7;
}

/** URL の値から目的地を読み取る(おかしいときは null) */
export function parseNavigateParams(params: { get(name: string): string | null }): Place | null {
  const lngText = params.get("lng");
  const latText = params.get("lat");
  if (!lngText || !latText) return null;
  const lng = Number(lngText);
  const lat = Number(latText);
  if (!Number.isFinite(lng) || !Number.isFinite(lat) || Math.abs(lng) > 180 || Math.abs(lat) > 90) return null;
  const name = (params.get("name") ?? "").trim().slice(0, 80) || "目的地";
  const address = (params.get("address") ?? "").trim().slice(0, 160) || undefined;
  return { id: `nav:${lng},${lat}`, name, address, position: { lng, lat } };
}
