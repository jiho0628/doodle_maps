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
export const ORIGIN_WAIT_MS = 4_000;

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
  const [quick, setQuick] = useState<LngLat | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setTimedOut(true), ORIGIN_WAIT_MS);
    // GPS の精密な位置を待たず、端末が覚えている大まかな位置(数分以内)をまず使う。
    // 精密な位置は features/location の監視が別に取りに行く
    let cancelled = false;
    if (typeof navigator !== "undefined" && "geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          if (!cancelled) setQuick({ lng: pos.coords.longitude, lat: pos.coords.latitude });
        },
        () => undefined,
        { enableHighAccuracy: false, maximumAge: 5 * 60_000, timeout: ORIGIN_WAIT_MS },
      );
    }
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, []);

  const firstFix = location.position ?? quick;
  useEffect(() => {
    if (!gps && firstFix) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- 最初に取れた現在地で固定する
      setGps({ position: firstFix, source: "gps" });
    }
  }, [gps, firstFix]);

  const failed = location.status === "denied" || location.status === "unavailable" || location.status === "unsupported";
  const needFallback = !gps && !firstFix && (failed || timedOut);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage はブラウザでしか読めない
    if (needFallback && !fallback) setFallback(fallbackOrigin());
  }, [needFallback, fallback]);

  if (gps) return gps;
  if (firstFix) return { position: firstFix, source: "gps" };
  return needFallback ? fallback : null;
}
