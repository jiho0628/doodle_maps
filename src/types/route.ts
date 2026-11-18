import type { LngLat, Place } from "./geo";

/** 移動手段。値は OpenRouteService のプロファイル名に合わせています。 */
export type TravelMode = "foot-walking" | "cycling-regular" | "driving-car";

export type RouteStep = {
  /** 画面にそのまま出す案内文(「右へ曲がる」など) */
  instruction: string;
  distanceM: number;
  durationS: number;
  /** 曲がる地点 */
  position?: LngLat;
};

export type Route = {
  mode: TravelMode;
  destination: Place;
  distanceM: number;
  durationS: number;
  /** 経路の線。[lng, lat] の配列(GeoJSON と同じ順) */
  coordinates: [number, number][];
  steps: RouteStep[];
};
