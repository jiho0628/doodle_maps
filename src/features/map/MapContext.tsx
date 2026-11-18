"use client";

import { createContext, useContext } from "react";
import type { Map as MapLibreMap } from "maplibre-gl";

export type MapStatus = "loading" | "ready" | "error" | "unsupported";

export type MapContextValue = {
  /** 読みこみが終わった地図。準備前・失敗時は null */
  map: MapLibreMap | null;
  status: MapStatus;
};

export const MapContext = createContext<MapContextValue>({ map: null, status: "loading" });

/**
 * <MapView> の中で地図インスタンスを使うためのフック。
 *
 *   const { map } = useMap();
 *   useEffect(() => {
 *     if (!map) return;
 *     map.addSource(...); // 後片付けも忘れずに
 *   }, [map]);
 */
export function useMap(): MapContextValue {
  return useContext(MapContext);
}
