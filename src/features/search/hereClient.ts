import type { LngLat, Place } from "@/types";

/**
 * ブラウザから HERE の検索(/api/here)を呼ぶ。
 * キー未設定(503)・失敗のときは null を返し、呼び出し側は MapTiler / OpenStreetMap にまかせる。
 */
let notConfigured = false;

/** テスト用 */
export function resetHereClient() {
  notConfigured = false;
}

export async function searchHere(
  what: { q: string } | { category: string },
  center: LngLat,
  options: { signal?: AbortSignal; fetchImpl?: typeof fetch } = {},
): Promise<Place[] | null> {
  if (notConfigured) return null;
  const { signal, fetchImpl = fetch } = options;
  const params = new URLSearchParams({
    ...("q" in what ? { q: what.q } : { category: what.category }),
    lat: center.lat.toFixed(4),
    lng: center.lng.toFixed(4),
  });
  try {
    const timeout = AbortSignal.timeout(7_000);
    const res = await fetchImpl(`/api/here?${params.toString()}`, {
      signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
    });
    if (res.status === 503) {
      notConfigured = true;
      return null;
    }
    const json = (await res.json().catch(() => null)) as { places?: Place[]; detail?: string } | null;
    if (!res.ok || !Array.isArray(json?.places)) {
      console.warn("[here] /api/here failed", res.status, json?.detail ?? "");
      return null;
    }
    return json.places;
  } catch (error) {
    if (signal?.aborted) throw error;
    console.warn("[here] /api/here failed", error instanceof Error ? error.message : error);
    return null;
  }
}
