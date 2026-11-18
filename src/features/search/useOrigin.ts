"use client";

import { useEffect, useState } from "react";
import { useCurrentLocation } from "@/features/location";
import { DEFAULT_CENTER } from "@/features/map";
import { readJSON, STORAGE_KEYS } from "@/lib/storage";
import type { LngLat } from "@/types";

export type Origin = {
  position: LngLat;
  /** gps: いまいる場所 / map: 最後に見ていた地図の真ん中 / default: 初期位置 */
  source: "gps" | "map" | "default";
};

/** いまいる場所がわかるまで待つ最長時間。過ぎたら地図の真ん中でさがす */
export const ORIGIN_WAIT_MS = 8_000;

function isCamera(v: unknown): v is { center: LngLat } {
  const c = (v as { center?: Partial<LngLat> } | null)?.center;
  return !!c && typeof c.lng === "number" && typeof c.lat === "number" && Number.isFinite(c.lng) && Number.isFinite(c.lat);
}

function fallbackOrigin(): Origin {
  const camera = readJSON<{ center: LngLat } | null>(STORAGE_KEYS.mapCamera, null, isCamera);
  return camera ? { position: camera.center, source: "map" } : { position: DEFAULT_CENTER, source: "default" };
}

/**
 * 検索の基準にする場所。
 * いまいる場所(features/location と共有)を優先し、取れるまでは待つ。
 * 取れない・時間切れのときだけ、最後に見ていた地図の真ん中を使う。
 * 一度決まった位置は歩いても変えない(結果が並べ替わって押し間違えないように)。
 * 決まるまでは null。
 */
export function useOrigin(): Origin | null {
  const location = useCurrentLocation();
  const [gps, setGps] = useState<Origin | null>(null);
  const [fallback, setFallback] = useState<Origin | null>(null);
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setTimedOut(true), ORIGIN_WAIT_MS);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!gps && location.position) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- 最初に取れた現在地で固定する
      setGps({ position: location.position, source: "gps" });
    }
  }, [gps, location.position]);

  const failed = location.status === "denied" || location.status === "unavailable" || location.status === "unsupported";
  const needFallback = !gps && !location.position && (failed || timedOut);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage はブラウザでしか読めない
    if (needFallback && !fallback) setFallback(fallbackOrigin());
  }, [needFallback, fallback]);

  if (gps) return gps;
  if (location.position) return { position: location.position, source: "gps" };
  return needFallback ? fallback : null;
}
