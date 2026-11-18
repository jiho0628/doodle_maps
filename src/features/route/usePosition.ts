"use client";

import { useEffect, useState } from "react";
import type { LngLat } from "@/types";

export type PositionStatus = "locating" | "ok" | "denied" | "unavailable" | "unsupported";

export type PositionState = {
  status: PositionStatus;
  position: LngLat | null;
  accuracyM: number | null;
};

/**
 * 案内中の現在地(watchPosition)。
 * TODO: features/location の useCurrentLocation() が main に入ったら置き換える。
 */
export function usePosition(enabled: boolean, attempt = 0): PositionState {
  const [state, setState] = useState<PositionState>({ status: "locating", position: null, accuracyM: null });

  useEffect(() => {
    if (!enabled) return;
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- ブラウザの機能有無は effect の中でしかわからない
      setState({ status: "unsupported", position: null, accuracyM: null });
      return;
    }
    setState((s) => (s.status === "ok" ? s : { ...s, status: "locating" }));
    const id = navigator.geolocation.watchPosition(
      (pos) => {
        setState({
          status: "ok",
          position: { lng: pos.coords.longitude, lat: pos.coords.latitude },
          accuracyM: pos.coords.accuracy,
        });
      },
      (error) => {
        setState((s) => {
          // 一度取れていれば、一時的な失敗では前の位置を使い続ける
          if (s.position && error.code !== error.PERMISSION_DENIED) return s;
          return {
            status: error.code === error.PERMISSION_DENIED ? "denied" : "unavailable",
            position: s.position,
            accuracyM: s.accuracyM,
          };
        });
      },
      { enableHighAccuracy: true, maximumAge: 5_000, timeout: 20_000 },
    );
    return () => navigator.geolocation.clearWatch(id);
  }, [enabled, attempt]);

  return state;
}
