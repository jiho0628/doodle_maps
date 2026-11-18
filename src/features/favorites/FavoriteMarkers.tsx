"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { Marker } from "maplibre-gl";
import { Button, Card } from "@/components/ui";
import { MapOverlay, useMap } from "@/features/map";
import { toLngLatArray, type Favorite } from "@/types";
import { FavoriteBadge, FavoriteGlyph, iconToneClass } from "./FavoriteIcon";
import { parseFavoriteHash } from "./focus";
import { useStartRoute } from "./startRoute";
import { useFavorites } from "./useFavorites";

/** 地図を開いたときにお気に入りへ寄るズーム */
const FOCUS_ZOOM = 16;

/**
 * 地図ホームにお気に入りのしるしを出す。しるしを押すと下にカードが出て「行く」で案内開始。
 * 地図ホームの <MapView> の子に置いてください。
 */
export function FavoriteMarkers() {
  const { map } = useMap();
  const { favorites } = useFavorites();
  const startRoute = useStartRoute();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [elements, setElements] = useState<Map<string, HTMLElement>>(() => new Map());
  const markers = useRef(new Map<string, Marker>());

  // しるし(maplibre の Marker)を作る・消す。中身は下の createPortal で React が描く。
  useEffect(() => {
    if (!map) return;
    let cancelled = false;
    (async () => {
      const { Marker } = await import("maplibre-gl");
      if (cancelled) return;
      const current = markers.current;
      const ids = new Set(favorites.map((f) => f.id));
      for (const [id, marker] of current) {
        if (!ids.has(id)) {
          marker.remove();
          current.delete(id);
        }
      }
      for (const f of favorites) {
        const existing = current.get(f.id);
        if (existing) {
          existing.setLngLat(toLngLatArray(f.position));
          continue;
        }
        const el = document.createElement("div");
        el.dataset.favoriteMarker = f.id;
        const marker = new Marker({ element: el, anchor: "bottom" }).setLngLat(toLngLatArray(f.position)).addTo(map);
        current.set(f.id, marker);
      }
      setElements(new Map([...current].map(([id, m]) => [id, m.getElement()])));
    })();
    return () => {
      cancelled = true;
    };
  }, [map, favorites]);

  // 地図がなくなったら(画面を離れたら)全部片付ける
  useEffect(() => {
    const current = markers.current;
    return () => {
      for (const marker of current.values()) marker.remove();
      current.clear();
    };
  }, [map]);

  // お気に入り画面の「地図で見る」(/#fav=<id>)で来たとき
  useEffect(() => {
    if (!map) return;
    const focusFromHash = () => {
      const id = parseFavoriteHash(window.location.hash);
      if (!id) return;
      const fav = favorites.find((f) => f.id === id);
      if (!fav) return;
      setSelectedId(id);
      map.flyTo({ center: toLngLatArray(fav.position), zoom: Math.max(map.getZoom(), FOCUS_ZOOM) });
      history.replaceState(history.state, "", window.location.pathname + window.location.search);
    };
    focusFromHash();
    window.addEventListener("hashchange", focusFromHash);
    return () => window.removeEventListener("hashchange", focusFromHash);
  }, [map, favorites]);

  const selected = useMemo(() => favorites.find((f) => f.id === selectedId), [favorites, selectedId]);

  return (
    <>
      {favorites.map((f) => {
        const el = elements.get(f.id);
        if (!el) return null;
        return createPortal(
          <MarkerPin favorite={f} selected={f.id === selectedId} onSelect={() => setSelectedId(f.id)} />,
          el,
          f.id,
        );
      })}
      {selected ? (
        <MapOverlay position="bottom">
          <Card elevated className="flex flex-col gap-4 p-5" role="region" aria-label="えらんだお気に入り">
            <div className="flex items-center gap-3.5">
              <FavoriteBadge icon={selected.icon} />
              <div className="flex min-w-0 flex-col gap-0.5">
                <p className="m-0 break-words text-xl font-bold leading-snug">{selected.name}</p>
                {selected.address ? <p className="m-0 truncate text-base text-ink-soft">{selected.address}</p> : null}
              </div>
            </div>
            <div className="flex gap-3">
              <Button variant="white" className="flex-1" onClick={() => setSelectedId(null)}>
                とじる
              </Button>
              <Button className="flex-[2]" onClick={() => startRoute(selected)}>
                ここへ行く
              </Button>
            </div>
          </Card>
        </MapOverlay>
      ) : null}
    </>
  );
}

function MarkerPin({ favorite, selected, onSelect }: { favorite: Favorite; selected: boolean; onSelect: () => void }) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
      }}
      aria-label={`お気に入り「${favorite.name}」`}
      aria-pressed={selected}
      className="flex flex-col items-center"
    >
      <span
        className={`flex size-12 items-center justify-center rounded-full border-[3px] shadow-soft transition-transform ${
          selected ? "scale-110 border-primary" : "border-card"
        } ${iconToneClass(favorite.icon)}`}
      >
        <FavoriteGlyph icon={favorite.icon} size={26} />
      </span>
      <span aria-hidden="true" className={`-mt-1 size-3 rotate-45 ${selected ? "bg-primary" : "bg-card"}`} />
    </button>
  );
}
