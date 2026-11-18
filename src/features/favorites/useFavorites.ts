"use client";

import { useCallback, useMemo } from "react";
import { STORAGE_KEYS, useStoredState } from "@/lib/storage";
import type { Favorite, LngLat } from "@/types";
import { findSameSpot, isFavoriteArray, sanitizeFavorites } from "./model";
import { addFavorite, removeFavorite, updateFavorite } from "./store";

const EMPTY: unknown[] = [];

/**
 * お気に入り一覧と操作をまとめたフック。
 *
 *   const { favorites, add, isSaved, remove } = useFavorites();
 *   add(place); // 検索結果の Place をそのまま渡せます
 *
 * 他のタブ・他のコンポーネントでの変更も自動で反映されます。
 * サーバー描画と最初の描画では空配列です(ready が false)。
 */
export function useFavorites() {
  const [raw] = useStoredState<unknown[]>(STORAGE_KEYS.favorites, EMPTY, isFavoriteArray);
  const favorites = useMemo(() => sanitizeFavorites(raw), [raw]);

  const findByPosition = useCallback(
    (position: LngLat): Favorite | undefined => findSameSpot(favorites, position),
    [favorites],
  );
  const isSaved = useCallback(
    (place: { position: LngLat }) => findByPosition(place.position) !== undefined,
    [findByPosition],
  );
  const getById = useCallback((id: string) => favorites.find((f) => f.id === id), [favorites]);

  return {
    favorites,
    add: addFavorite,
    update: updateFavorite,
    rename: (id: string, name: string) => updateFavorite(id, { name }),
    remove: removeFavorite,
    isSaved,
    findByPosition,
    getById,
  };
}
