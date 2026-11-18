"use client";

import { useEffect, useRef } from "react";
import type { GeoJSONSource, Map as MapLibreMap, Marker } from "maplibre-gl";
import { useMap } from "@/features/map";
import type { LngLat, Place } from "@/types";

const SOURCE_ID = "nav-route";
const LINE_CASING = "nav-route-casing";
const LINE_ID = "nav-route-line";
const LINE_DOTS = "nav-route-dots";

/** Tailwind の色クラスから実際の色を読む(地図のレイヤーは CSS クラスを使えないため) */
function readThemeColor(map: MapLibreMap, className: string): string {
  const probe = document.createElement("span");
  probe.className = className;
  probe.style.display = "none";
  map.getContainer().appendChild(probe);
  const color = getComputedStyle(probe).color;
  probe.remove();
  return color;
}

function lineFeature(coords: [number, number][]): GeoJSON.Feature<GeoJSON.LineString> {
  return { type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: coords } };
}

/** 目的地のピン(A案のコーラルのしずく形) */
function createPinElement(name: string): HTMLElement {
  const el = document.createElement("div");
  el.setAttribute("role", "img");
  el.setAttribute("aria-label", `目的地: ${name}`);
  el.className = "text-primary";
  el.innerHTML =
    '<svg width="44" height="52" viewBox="0 0 44 52" aria-hidden="true">' +
    '<path d="M22 50C22 50 4 32 4 20a18 18 0 0 1 36 0c0 12-18 30-18 30z" fill="currentColor" stroke="white" stroke-width="3"/>' +
    '<path d="M22 27l-7-7a4.6 4.6 0 0 1 7-6 4.6 4.6 0 0 1 7 6z" fill="white"/></svg>';
  return el;
}

/**
 * 案内中の地図表示: 経路の線と目的地のピン(現在地のアバターは features/location の UserLocationMarker)。
 * <MapView> の子に置く。
 */
export function RouteMapLayer({
  destination,
  coordinates,
  position,
  follow,
  onUserMove,
}: {
  destination: Place;
  coordinates: [number, number][] | null;
  position: LngLat | null;
  /** true のあいだ、地図を現在地に合わせて動かす */
  follow: boolean;
  /** 利用者が地図を指で動かしたとき */
  onUserMove?: () => void;
}) {
  const { map } = useMap();
  const fittedRef = useRef<string | null>(null);
  const onUserMoveRef = useRef(onUserMove);

  useEffect(() => {
    onUserMoveRef.current = onUserMove;
  }, [onUserMove]);

  // 経路の線
  useEffect(() => {
    if (!map) return;
    const data = lineFeature(coordinates ?? []);
    const existing = map.getSource(SOURCE_ID) as GeoJSONSource | undefined;
    if (existing) {
      existing.setData(data);
      return;
    }
    const coral = readThemeColor(map, "text-coral");
    const white = readThemeColor(map, "text-card");
    map.addSource(SOURCE_ID, { type: "geojson", data });
    map.addLayer({
      id: LINE_CASING,
      type: "line",
      source: SOURCE_ID,
      layout: { "line-cap": "round", "line-join": "round" },
      paint: { "line-color": white, "line-width": 14 },
    });
    map.addLayer({
      id: LINE_ID,
      type: "line",
      source: SOURCE_ID,
      layout: { "line-cap": "round", "line-join": "round" },
      paint: { "line-color": coral, "line-width": 9 },
    });
    map.addLayer({
      id: LINE_DOTS,
      type: "line",
      source: SOURCE_ID,
      layout: { "line-cap": "round", "line-join": "round" },
      paint: { "line-color": white, "line-width": 3, "line-dasharray": [0.6, 3] },
    });
  }, [map, coordinates]);

  // 画面を離れるときに線を消す
  useEffect(() => {
    if (!map) return;
    return () => {
      try {
        for (const id of [LINE_DOTS, LINE_ID, LINE_CASING]) if (map.getLayer(id)) map.removeLayer(id);
        if (map.getSource(SOURCE_ID)) map.removeSource(SOURCE_ID);
      } catch {
        // 地図そのものが先に片付けられた場合
      }
    };
  }, [map]);

  // 目的地のピン
  useEffect(() => {
    if (!map) return;
    let marker: Marker | undefined;
    let cancelled = false;
    import("maplibre-gl").then(({ Marker }) => {
      if (cancelled) return;
      marker = new Marker({ element: createPinElement(destination.name), anchor: "bottom" })
        .setLngLat([destination.position.lng, destination.position.lat])
        .addTo(map);
    });
    return () => {
      cancelled = true;
      marker?.remove();
    };
  }, [map, destination.name, destination.position.lng, destination.position.lat]);

  // 最初に経路が出たら、全体が見えるように合わせる
  useEffect(() => {
    if (!map || !coordinates || coordinates.length < 2) return;
    const key = `${coordinates[0].join()}-${coordinates.length}`;
    if (fittedRef.current === key) return;
    const first = fittedRef.current === null;
    fittedRef.current = key;
    if (!first) return; // 調べなおしのときは視点を動かさない
    let minLng = Infinity, minLat = Infinity, maxLng = -Infinity, maxLat = -Infinity;
    for (const [lng, lat] of coordinates) {
      minLng = Math.min(minLng, lng);
      minLat = Math.min(minLat, lat);
      maxLng = Math.max(maxLng, lng);
      maxLat = Math.max(maxLat, lat);
    }
    const h = map.getContainer().clientHeight;
    map.fitBounds(
      [
        [minLng, minLat],
        [maxLng, maxLat],
      ],
      {
        padding: { top: Math.min(200, h * 0.28), bottom: Math.min(280, h * 0.35), left: 40, right: 40 },
        maxZoom: 18,
        duration: 600,
      },
    );
  }, [map, coordinates]);

  // 現在地についていく
  useEffect(() => {
    if (!map || !follow || !position) return;
    map.easeTo({ center: [position.lng, position.lat], zoom: Math.max(map.getZoom(), 16.5), duration: 800 });
  }, [map, follow, position]);

  // 指で動かしたら、ついていくのをやめる
  useEffect(() => {
    if (!map) return;
    const handler = (e: { originalEvent?: unknown }) => {
      if (e.originalEvent) onUserMoveRef.current?.();
    };
    map.on("dragstart", handler);
    map.on("zoomstart", handler);
    return () => {
      map.off("dragstart", handler);
      map.off("zoomstart", handler);
    };
  }, [map]);

  return null;
}
