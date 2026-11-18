"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { Map as MapLibreMap } from "maplibre-gl";
import { publicEnv } from "@/lib/config/env";
import { readJSON, STORAGE_KEYS, writeJSON } from "@/lib/storage";
import { toLngLatArray } from "@/types";
import { isStoredCamera, type StoredCamera } from "./camera";
import { DEFAULT_CENTER, DEFAULT_ZOOM, MAX_ZOOM, MIN_ZOOM } from "./constants";
import { MapContext, type MapContextValue, type MapStatus } from "./MapContext";
import { MapStatusOverlay } from "./MapStatusOverlay";
import { resolveMapStyle } from "./mapStyle";

/** この時間内に地図が出なければ「読みこめませんでした」を出す */
const LOAD_TIMEOUT_MS = 20_000;

/**
 * 画面いっぱいの地図。子要素は地図の上に重ねて表示され、
 * useMap() で地図インスタンスを使えます。
 *
 * MapTiler のキーがない・通信できない・WebGL が使えない場合でも
 * 例外で画面が真っ白にならず、やさしい案内を出します。
 */
export function MapView({ children }: { children?: ReactNode }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<MapLibreMap | null>(null);
  const [status, setStatus] = useState<MapStatus>("loading");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let cancelled = false;
    let instance: MapLibreMap | undefined;
    let timeout: ReturnType<typeof setTimeout> | undefined;

    const fail = (next: MapStatus) => {
      if (cancelled) return;
      setStatus(next);
    };

    (async () => {
      let maplibregl: typeof import("maplibre-gl");
      try {
        maplibregl = await import("maplibre-gl");
      } catch {
        return fail("error");
      }
      if (cancelled) return;

      const style = resolveMapStyle(publicEnv);
      if (style.source === "fallback" && process.env.NODE_ENV !== "production") {
        console.info("[map] NEXT_PUBLIC_MAPTILER_KEY が未設定のため、キー不要の代替地図を使います。");
      }

      const camera = readJSON<StoredCamera | null>(STORAGE_KEYS.mapCamera, null, isStoredCamera);

      try {
        instance = new maplibregl.Map({
          container,
          style: style.url,
          center: toLngLatArray(camera?.center ?? DEFAULT_CENTER),
          zoom: camera?.zoom ?? DEFAULT_ZOOM,
          minZoom: MIN_ZOOM,
          maxZoom: MAX_ZOOM,
          attributionControl: { compact: true },
          // 迷わないよう北を常に上にする(回転・傾きなし)
          dragRotate: false,
          pitchWithRotate: false,
          touchPitch: false,
        });
      } catch (error) {
        console.warn("[map] 地図を作れませんでした", error);
        return fail("unsupported");
      }
      instance.touchZoomRotate.disableRotation();
      instance.keyboard.disableRotation();

      const map = instance;
      timeout = setTimeout(() => {
        if (!map.loaded()) fail("error");
      }, LOAD_TIMEOUT_MS);

      map.once("load", () => {
        if (cancelled) return;
        clearTimeout(timeout);
        setStatus("ready");
        setMap(map);
      });

      map.on("error", (event) => {
        // 読みこみ完了後のタイル1枚の失敗などは無視する(地図は使える)
        if (map.loaded() || cancelled) return;
        console.warn("[map] 読みこみエラー", event.error);
        clearTimeout(timeout);
        fail("error");
      });

      map.on("moveend", () => {
        const c = map.getCenter();
        writeJSON(STORAGE_KEYS.mapCamera, { center: { lng: c.lng, lat: c.lat }, zoom: map.getZoom() } satisfies StoredCamera);
      });
    })();

    return () => {
      cancelled = true;
      clearTimeout(timeout);
      setMap(null);
      setStatus("loading");
      instance?.remove();
    };
  }, [attempt]);

  const value = useMemo<MapContextValue>(() => ({ map, status }), [map, status]);

  return (
    <MapContext.Provider value={value}>
      <div className="absolute inset-0 overflow-hidden bg-cream">
        {/* maplibre の CSS が position:relative を当てるため、配置は外側の div で行う */}
        <div className="absolute inset-0">
          <div ref={containerRef} className="h-full w-full" data-testid="map-canvas" />
        </div>
        <MapStatusOverlay status={status} onRetry={() => setAttempt((n) => n + 1)} />
        {children}
      </div>
    </MapContext.Provider>
  );
}
