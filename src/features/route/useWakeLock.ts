"use client";

import { useEffect } from "react";

/** 案内中は画面が暗くならないようにする(対応していない端末では何もしない) */
export function useWakeLock(active: boolean) {
  useEffect(() => {
    if (!active || typeof navigator === "undefined" || !("wakeLock" in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    let released = false;

    const request = () => {
      navigator.wakeLock
        .request("screen")
        .then((l) => {
          if (released) l.release().catch(() => undefined);
          else lock = l;
        })
        .catch(() => undefined);
    };
    // 別のアプリから戻ってきたら取り直す(画面を離れると自動で外れるため)
    const onVisible = () => {
      if (document.visibilityState === "visible") request();
    };

    request();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      released = true;
      document.removeEventListener("visibilitychange", onVisible);
      lock?.release().catch(() => undefined);
    };
  }, [active]);
}
