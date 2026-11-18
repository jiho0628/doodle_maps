import type { LngLat } from "@/types";

export type StoredCamera = { center: LngLat; zoom: number };

function isFiniteNumber(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

/** localStorage から読んだ値が正しいカメラ位置かを確かめる */
export function isStoredCamera(value: unknown): value is StoredCamera {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  const c = v.center as Record<string, unknown> | undefined;
  return (
    !!c &&
    isFiniteNumber(c.lng) &&
    isFiniteNumber(c.lat) &&
    Math.abs(c.lng) <= 180 &&
    Math.abs(c.lat) <= 90 &&
    isFiniteNumber(v.zoom) &&
    v.zoom >= 0 &&
    v.zoom <= 24
  );
}
