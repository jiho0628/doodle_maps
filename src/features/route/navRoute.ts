import type { LngLat, Place, Route, RouteStep, TravelMode } from "@/types";
import { cumulativeDistances, distanceM, WALK_METERS_PER_MINUTE } from "./geo";

/**
 * 案内で使う経路。共通の Route に、案内用の情報を足したもの。
 * (Route Handler の返り値もこの形)
 */
export type NavRoute = {
  route: Route;
  /** steps[i] の曲がる地点が route.coordinates の何番目か */
  stepIndices: number[];
  /** true のときは道を調べられず、目的地への直線を出している */
  approximate: boolean;
};

/** /api/route へ送る内容 */
export type RouteRequest = {
  from: LngLat;
  to: LngLat;
  mode?: TravelMode;
};

export const TRAVEL_MODES: TravelMode[] = ["foot-walking", "cycling-regular", "driving-car"];

/** 歩きでたどれる最長距離(直線)。これより遠いと ORS もエラーになるので先に断る */
export const MAX_STRAIGHT_DISTANCE_M = 100_000;

function isLngLat(v: unknown): v is LngLat {
  if (!v || typeof v !== "object") return false;
  const { lng, lat } = v as Record<string, unknown>;
  return (
    typeof lng === "number" &&
    typeof lat === "number" &&
    Number.isFinite(lng) &&
    Number.isFinite(lat) &&
    Math.abs(lng) <= 180 &&
    Math.abs(lat) <= 90
  );
}

/** 受け取った JSON が正しい RouteRequest か */
export function parseRouteRequest(body: unknown): RouteRequest | null {
  if (!body || typeof body !== "object") return null;
  const { from, to, mode } = body as Record<string, unknown>;
  if (!isLngLat(from) || !isLngLat(to)) return null;
  if (mode !== undefined && !TRAVEL_MODES.includes(mode as TravelMode)) return null;
  return { from, to, mode: (mode as TravelMode | undefined) ?? "foot-walking" };
}

/** 道を調べられないときの代わり: 目的地までの直線 */
export function straightLineRoute(from: LngLat, destination: Place, mode: TravelMode = "foot-walking"): NavRoute {
  const d = distanceM(from, destination.position);
  const steps: RouteStep[] = [
    { instruction: "目的地の方へ進む", turn: "straight", distanceM: d, durationS: (d / WALK_METERS_PER_MINUTE) * 60, position: from },
    { instruction: "目的地に到着", turn: "arrive", distanceM: 0, durationS: 0, position: destination.position },
  ];
  return {
    route: {
      mode,
      destination,
      distanceM: d,
      durationS: (d / WALK_METERS_PER_MINUTE) * 60,
      coordinates: [
        [from.lng, from.lat],
        [destination.position.lng, destination.position.lat],
      ],
      steps,
    },
    stepIndices: [0, 1],
    approximate: true,
  };
}

/** 経路の線の累積距離など、案内中に何度も使う値を先に計算しておく */
export function prepareRoute(nav: NavRoute) {
  return { ...nav, cumulative: cumulativeDistances(nav.route.coordinates) };
}

export type PreparedRoute = ReturnType<typeof prepareRoute>;

/** Route Handler から返ってきた JSON が NavRoute の形か(最低限のチェック) */
export function isNavRouteResponse(v: unknown): v is Omit<NavRoute, "route"> & { route: Omit<Route, "destination"> } {
  if (!v || typeof v !== "object") return false;
  const r = v as Record<string, unknown>;
  const route = r.route as Record<string, unknown> | undefined;
  return (
    !!route &&
    Array.isArray(route.coordinates) &&
    route.coordinates.length >= 2 &&
    Array.isArray(route.steps) &&
    typeof route.distanceM === "number" &&
    typeof route.durationS === "number" &&
    Array.isArray(r.stepIndices)
  );
}
