import type { LngLat, Place, TravelMode } from "@/types";
import { isNavRouteResponse, straightLineRoute, type NavRoute } from "./navRoute";

export type FetchRouteResult =
  | { kind: "ok"; nav: NavRoute }
  /** 遠すぎる・道が見つからない */
  | { kind: "too_far" | "no_route" }
  /** 通信できない・サーバーの不調 */
  | { kind: "error" };

/**
 * ブラウザから経路をたずねる(/api/route 経由)。
 * ORS のキーが未設定のときは、目的地への直線で代わりに案内する。
 */
export async function fetchRoute(
  from: LngLat,
  destination: Place,
  options: { mode?: TravelMode; signal?: AbortSignal; fetchImpl?: typeof fetch } = {},
): Promise<FetchRouteResult> {
  const { mode = "foot-walking", signal, fetchImpl = fetch } = options;
  let res: Response;
  try {
    res = await fetchImpl("/api/route", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: destination.position, mode }),
      signal,
    });
  } catch (error) {
    if (signal?.aborted) throw error;
    return { kind: "error" };
  }

  let json: unknown = null;
  try {
    json = await res.json();
  } catch {
    // 中身が JSON でない(HTML のエラーページなど)
  }

  if (res.ok && isNavRouteResponse(json)) {
    return { kind: "ok", nav: { ...json, route: { ...json.route, destination }, approximate: false } };
  }

  const error = (json as { error?: string } | null)?.error;
  if (error === "not_configured") return { kind: "ok", nav: straightLineRoute(from, destination, mode) };
  if (error === "too_far" || error === "no_route") return { kind: error };
  return { kind: "error" };
}
