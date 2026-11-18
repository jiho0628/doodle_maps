"use client";

import { useEffect } from "react";

/** 本番ビルドのときだけ Service Worker を登録する(開発中はキャッシュで混乱しないよう登録しない) */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch((error) => {
      console.warn("[pwa] Service Worker を登録できませんでした", error);
    });
  }, []);
  return null;
}
