import type { RouteStep, TravelMode } from "@/types";
import type { RouteRequest } from "../navRoute";
import { turnFromOrsType, turnLabel } from "../turns";

/**
 * OpenRouteService を呼ぶサーバー側の処理。
 * APIキーを使うので、Route Handler(src/app/api/route)からだけ使うこと。
 */

export const ORS_DIRECTIONS_URL = "https://api.openrouteservice.org/v2/directions";

/** Route Handler が返す経路(目的地の名前などはブラウザ側で付ける) */
export type RouteResponseBody = {
  route: {
    mode: TravelMode;
    distanceM: number;
    durationS: number;
    coordinates: [number, number][];
    steps: RouteStep[];
  };
  stepIndices: number[];
  approximate: false;
};

export type OrsResult =
  | { ok: true; body: RouteResponseBody }
  /** 道が見つからない(海の上・道から遠すぎるなど) */
  | { ok: false; reason: "no_route" }
  /** ORS 側の不調・キーの誤り・回数制限 */
  | { ok: false; reason: "upstream"; status: number };

type OrsStep = {
  distance?: number;
  duration?: number;
  type?: number;
  way_points?: [number, number];
};

type OrsFeature = {
  geometry?: { coordinates?: unknown };
  properties?: {
    summary?: { distance?: number; duration?: number };
    segments?: { steps?: OrsStep[] }[];
  };
};

function isCoordList(v: unknown): v is [number, number][] {
  return (
    Array.isArray(v) &&
    v.every((c) => Array.isArray(c) && c.length >= 2 && typeof c[0] === "number" && typeof c[1] === "number")
  );
}

/** ORS の GeoJSON 応答を案内用の形に変換する(形が想定外なら null) */
export function parseOrsResponse(json: unknown, mode: TravelMode): RouteResponseBody | null {
  const feature = (json as { features?: OrsFeature[] } | null)?.features?.[0];
  const raw = feature?.geometry?.coordinates;
  if (!isCoordList(raw) || raw.length === 0) return null;

  // 高さ(3つ目の値)が付いていても落とす
  const coordinates = raw.map(([lng, lat]) => [lng, lat] as [number, number]);
  if (coordinates.length === 1) coordinates.push([...coordinates[0]]);

  const steps: RouteStep[] = [];
  const stepIndices: number[] = [];
  for (const segment of feature?.properties?.segments ?? []) {
    for (const s of segment.steps ?? []) {
      const index = Math.min(Math.max(s.way_points?.[0] ?? 0, 0), coordinates.length - 1);
      const turn = turnFromOrsType(s.type);
      const [lng, lat] = coordinates[index];
      steps.push({
        instruction: turnLabel(turn),
        turn,
        distanceM: s.distance ?? 0,
        durationS: s.duration ?? 0,
        position: { lng, lat },
      });
      stepIndices.push(index);
    }
  }

  // 出発・到着が入っていないとき(とても近い場合など)は補う
  if (steps.length === 0 || steps[steps.length - 1].turn !== "arrive") {
    const last = coordinates.length - 1;
    const [lng, lat] = coordinates[last];
    steps.push({ instruction: turnLabel("arrive"), turn: "arrive", distanceM: 0, durationS: 0, position: { lng, lat } });
    stepIndices.push(last);
  }

  const summary = feature?.properties?.summary ?? {};
  return {
    route: {
      mode,
      distanceM: summary.distance ?? 0,
      durationS: summary.duration ?? 0,
      coordinates,
      steps,
    },
    stepIndices,
    approximate: false,
  };
}

/** ORS に経路をたずねる */
export async function fetchOrsRoute(
  request: RouteRequest,
  apiKey: string,
  fetchImpl: typeof fetch = fetch,
): Promise<OrsResult> {
  const mode = request.mode ?? "foot-walking";
  let res: Response;
  try {
    res = await fetchImpl(`${ORS_DIRECTIONS_URL}/${mode}/geojson`, {
      method: "POST",
      headers: {
        Authorization: apiKey,
        "Content-Type": "application/json",
        Accept: "application/geo+json, application/json",
      },
      body: JSON.stringify({
        coordinates: [
          [request.from.lng, request.from.lat],
          [request.to.lng, request.to.lat],
        ],
        instructions: true,
        units: "m",
        language: "ja",
      }),
      signal: AbortSignal.timeout(15_000),
      cache: "no-store",
    });
  } catch {
    return { ok: false, reason: "upstream", status: 504 };
  }

  if (!res.ok) {
    // 2009/2010 など「道が見つからない」系は 404 で返ってくる
    if (res.status === 404) return { ok: false, reason: "no_route" };
    return { ok: false, reason: "upstream", status: res.status };
  }

  let json: unknown;
  try {
    json = await res.json();
  } catch {
    return { ok: false, reason: "upstream", status: 502 };
  }
  const body = parseOrsResponse(json, mode);
  return body ? { ok: true, body } : { ok: false, reason: "upstream", status: 502 };
}
