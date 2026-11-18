"use client";

import { useEffect, useState } from "react";
import { DEFAULT_CENTER } from "@/features/map";
import { readJSON, STORAGE_KEYS } from "@/lib/storage";
import type { LngLat } from "@/types";

export type Origin = {
  position: LngLat;
  /** gps: いまいる場所 / map: 最後に見ていた地図の真ん中 / default: 初期位置 */
  source: "gps" | "map" | "default";
};

function isCamera(v: unknown): v is { center: LngLat } {
  const c = (v as { center?: Partial<LngLat> } | null)?.center;
  return !!c && typeof c.lng === "number" && typeof c.lat === "number" && Number.isFinite(c.lng) && Number.isFinite(c.lat);
}

function fallbackOrigin(): Origin {
  const camera = readJSON<{ center: LngLat } | null>(STORAGE_KEYS.mapCamera, null, isCamera);
  return camera ? { position: camera.center, source: "map" } : { position: DEFAULT_CENTER, source: "default" };
}

/**
 * 検索の基準にする場所。まず地図の真ん中を使い、いまいる場所がわかったら差し替える。
 * (位置情報が使えなくても検索はできる)
 */
export function useOrigin(): Origin | null {
  const [origin, setOrigin] = useState<Origin | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage はブラウザでしか読めない
    setOrigin((o) => o ?? fallbackOrigin());
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) return;
    let cancelled = false;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (!cancelled) setOrigin({ position: { lng: pos.coords.longitude, lat: pos.coords.latitude }, source: "gps" });
      },
      () => undefined,
      { enableHighAccuracy: false, maximumAge: 60_000, timeout: 10_000 },
    );
    return () => {
      cancelled = true;
    };
  }, []);

  return origin;
}
