import type { LngLat } from "@/types";

const EARTH_RADIUS_M = 6_371_000;

/** 歩く速さ(不動産表示と同じ 分速80m) */
export const WALK_METERS_PER_MINUTE = 80;

/** 直線距離から実際の道のりをざっくり見積もるときの係数 */
const DETOUR_FACTOR = 1.25;

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/** 2点間の直線距離(m) */
export function distanceM(a: LngLat, b: LngLat): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** 直線距離から「歩いて何分くらいか」を見積もる(切り上げ、最低1分) */
export function estimateWalkMinutes(straightM: number): number {
  return Math.max(1, Math.ceil((straightM * DETOUR_FACTOR) / WALK_METERS_PER_MINUTE));
}

/** 「120m」「1.2km」 */
export function formatDistance(m: number): string {
  if (m < 1000) {
    // 細かすぎる数字は読みにくいので 10m 単位
    const rounded = m < 50 ? Math.max(0, Math.round(m)) : Math.round(m / 10) * 10;
    return `${rounded}m`;
  }
  const km = m / 1000;
  return `${km < 10 ? km.toFixed(1) : Math.round(km)}km`;
}

/** 「4分」「1時間5分」 */
export function formatMinutes(minutes: number): string {
  const m = Math.max(1, Math.round(minutes));
  if (m < 60) return `${m}分`;
  const h = Math.floor(m / 60);
  const rest = m % 60;
  return rest === 0 ? `${h}時間` : `${h}時間${rest}分`;
}

/** 「12:34」(到着予定時刻) */
export function formatClock(date: Date): string {
  return `${date.getHours()}:${String(date.getMinutes()).padStart(2, "0")}`;
}

/** 検索結果に出す「歩いて約4分」。遠すぎるときは距離だけ */
export function walkLabel(from: LngLat, to: LngLat): string {
  const d = distanceM(from, to);
  if (d > 5000) return `ここから約${formatDistance(d)}`;
  return `歩いて約${formatMinutes(estimateWalkMinutes(d))}`;
}

// ---- 経路上の位置計算 ----

type XY = { x: number; y: number };

/** 基準点まわりの平面(m)に投影する。数km程度なら十分な精度 */
function project(p: LngLat, origin: LngLat): XY {
  const x = toRad(p.lng - origin.lng) * EARTH_RADIUS_M * Math.cos(toRad(origin.lat));
  const y = toRad(p.lat - origin.lat) * EARTH_RADIUS_M;
  return { x, y };
}

export type RouteProgress = {
  /** いちばん近い区間の番号(coordinates[i] → coordinates[i+1]) */
  segmentIndex: number;
  /** 経路からのずれ(m) */
  offRouteM: number;
  /** 出発点から、経路上のいまの位置までの距離(m) */
  alongM: number;
};

/** 経路の各点までの累積距離(m)。cumulative[0] = 0 */
export function cumulativeDistances(coords: [number, number][]): number[] {
  const out = [0];
  for (let i = 1; i < coords.length; i++) {
    const [lng0, lat0] = coords[i - 1];
    const [lng1, lat1] = coords[i];
    out.push(out[i - 1] + distanceM({ lng: lng0, lat: lat0 }, { lng: lng1, lat: lat1 }));
  }
  return out;
}

/**
 * いまの位置が経路のどこにいるかを求める。
 * @param hintIndex 前回の区間番号。そこから先を優先して探す(行き来する道での取り違え防止)
 */
export function locateOnRoute(
  position: LngLat,
  coords: [number, number][],
  cumulative: number[],
  hintIndex = 0,
): RouteProgress {
  if (coords.length === 0) return { segmentIndex: 0, offRouteM: Infinity, alongM: 0 };
  if (coords.length === 1) {
    const [lng, lat] = coords[0];
    return { segmentIndex: 0, offRouteM: distanceM(position, { lng, lat }), alongM: 0 };
  }

  let best: RouteProgress = { segmentIndex: 0, offRouteM: Infinity, alongM: 0 };
  // 前回より少し手前からを探す。戻った場合も拾えるよう少し余裕を持たせる
  const start = Math.max(0, hintIndex - 3);
  for (let i = start; i < coords.length - 1; i++) {
    const a = { lng: coords[i][0], lat: coords[i][1] };
    const b = { lng: coords[i + 1][0], lat: coords[i + 1][1] };
    const pa = project(a, position);
    const pb = project(b, position);
    const dx = pb.x - pa.x;
    const dy = pb.y - pa.y;
    const len2 = dx * dx + dy * dy;
    // 現在地(原点)を区間に垂直に下ろした位置(0〜1)
    const t = len2 === 0 ? 0 : Math.min(1, Math.max(0, -(pa.x * dx + pa.y * dy) / len2));
    const qx = pa.x + t * dx;
    const qy = pa.y + t * dy;
    const d = Math.hypot(qx, qy);
    // ほぼ同じ距離なら先の区間ではなく手前(先に見つけた方)を採る
    if (d < best.offRouteM - 0.5) {
      best = { segmentIndex: i, offRouteM: d, alongM: cumulative[i] + t * Math.sqrt(len2) };
    }
  }
  return best;
}
