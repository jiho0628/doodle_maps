"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { Marker } from "maplibre-gl";
import { useMap } from "@/features/map";
import { AvatarFigure, avatarLabel, useAvatar } from "@/features/avatar";
import { toLngLatArray } from "@/types";
import { useCurrentLocation, useHeading } from "./hooks";

/** マーカー全体(扇形を含む)の大きさ */
const MARKER_SIZE = 132;
const AVATAR_SIZE = 58;

/**
 * 現在地に「アバター+向きの扇形」を出す。<MapView> の子として置くだけで動きます。
 * 地図は北が上で固定なので、扇形はスマホの向き(heading)の分だけ回すだけでよい。
 */
export function UserLocationMarker() {
  const { map } = useMap();
  const { position } = useCurrentLocation();
  const [element, setElement] = useState<HTMLDivElement | null>(null);
  const markerRef = useRef<Marker | null>(null);
  const hasPosition = position !== null;

  // マーカー(DOM 要素)を作る。中身は React の portal で描く。
  useEffect(() => {
    if (!map || !hasPosition) return;
    let cancelled = false;
    const el = document.createElement("div");
    el.dataset.testid = "user-location-marker";
    (async () => {
      const { Marker } = await import("maplibre-gl");
      if (cancelled) return;
      const start = markerRef.current?.getLngLat() ?? map.getCenter();
      markerRef.current = new Marker({ element: el, anchor: "center" }).setLngLat(start).addTo(map);
      setElement(el);
    })();
    return () => {
      cancelled = true;
      markerRef.current?.remove();
      markerRef.current = null;
      setElement(null);
    };
  }, [map, hasPosition]);

  useEffect(() => {
    if (element && position) markerRef.current?.setLngLat(toLngLatArray(position));
  }, [element, position]);

  if (!element) return null;
  return createPortal(<UserMarkerBody />, element);
}

/** マーカーの見た目。案内画面などで地図の外に置きたいときにも使える */
export function UserMarkerBody({ size = MARKER_SIZE }: { size?: number }) {
  const { heading } = useHeading();
  const [avatar] = useAvatar();
  const avatarSize = Math.round((AVATAR_SIZE / MARKER_SIZE) * size);

  return (
    <div className="pointer-events-none relative animate-fade-in" style={{ width: size, height: size }}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 160 160"
        className="absolute inset-0 text-coral"
        aria-hidden="true"
        data-testid="heading-fan"
        data-heading={heading === null ? "" : Math.round(heading)}
      >
        <circle cx="80" cy="80" r="44" fill="currentColor" opacity="0.16" />
        {heading === null ? null : (
          <path
            d="M80 80 L46 8 A 80 80 0 0 1 114 8 Z"
            fill="currentColor"
            opacity="0.32"
            transform={`rotate(${heading.toFixed(1)} 80 80)`}
          />
        )}
      </svg>
      <div className="absolute inset-0 flex items-center justify-center drop-shadow-md">
        <AvatarFigure choice={avatar} size={avatarSize} title={`現在地(${avatarLabel(avatar)})`} />
      </div>
    </div>
  );
}
