"use client";

import { useCallback, useRef, useState } from "react";
import type { LngLat } from "@/types";

export type LocateError = "unsupported" | "denied" | "unavailable" | "timeout";

export const LOCATE_ERROR_MESSAGES: Record<LocateError, string> = {
  unsupported: "この機械では、いまいる場所がわかりません。",
  denied: "いまいる場所を使う許可がありません。設定で「位置情報」を許可してから、もう一度押してください。",
  unavailable: "いまいる場所がわかりませんでした。外に出るか、少し待ってからもう一度押してください。",
  timeout: "時間がかかりすぎました。もう一度押してください。",
};

/** 「いまいる場所を保存」用に、現在地を1回だけ取る */
export function useLocateOnce() {
  const [state, setState] = useState<{ status: "idle" | "locating" } | { status: "error"; error: LocateError }>({
    status: "idle",
  });
  const busy = useRef(false);

  const locate = useCallback((): Promise<LngLat | null> => {
    if (busy.current) return Promise.resolve(null);
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setState({ status: "error", error: "unsupported" });
      return Promise.resolve(null);
    }
    busy.current = true;
    setState({ status: "locating" });
    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          busy.current = false;
          setState({ status: "idle" });
          resolve({ lng: pos.coords.longitude, lat: pos.coords.latitude });
        },
        (err) => {
          busy.current = false;
          const error: LocateError =
            err.code === err.PERMISSION_DENIED ? "denied" : err.code === err.TIMEOUT ? "timeout" : "unavailable";
          setState({ status: "error", error });
          resolve(null);
        },
        { enableHighAccuracy: true, timeout: 15_000, maximumAge: 10_000 },
      );
    });
  }, []);

  const reset = useCallback(() => setState({ status: "idle" }), []);

  return { state, locate, reset };
}
