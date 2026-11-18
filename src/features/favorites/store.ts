import { readJSON, STORAGE_KEYS, writeJSON } from "@/lib/storage";
import type { Favorite } from "@/types";
import {
  addToList,
  isFavoriteArray,
  removeFromList,
  sanitizeFavorites,
  updateInList,
  type FavoritePatch,
  type NewFavoriteInput,
} from "./model";

/**
 * React の外からでも使えるお気に入りの読み書き。
 * 画面の表示は useFavorites() を使うと、ここでの変更が自動で反映されます。
 */

const EMPTY: unknown[] = [];

export function getFavorites(): Favorite[] {
  return sanitizeFavorites(readJSON<unknown[]>(STORAGE_KEYS.favorites, EMPTY, isFavoriteArray));
}

export type SaveResult =
  | { ok: true; favorite: Favorite; /** false = 同じ場所がすでに保存済みだった */ added: boolean }
  | { ok: false; reason: "storage" };

/** お気に入りに追加する。同じ場所(30m以内)がすでにあれば、それを返す。 */
export function addFavorite(input: NewFavoriteInput): SaveResult {
  const { list, favorite, added } = addToList(getFavorites(), input);
  if (!added) return { ok: true, favorite, added };
  return writeJSON(STORAGE_KEYS.favorites, list) ? { ok: true, favorite, added } : { ok: false, reason: "storage" };
}

/** 名前やアイコンを変える。保存できたら true。 */
export function updateFavorite(id: string, patch: FavoritePatch): boolean {
  return writeJSON(STORAGE_KEYS.favorites, updateInList(getFavorites(), id, patch));
}

export function renameFavorite(id: string, name: string): boolean {
  return updateFavorite(id, { name });
}

export function removeFavorite(id: string): boolean {
  return writeJSON(STORAGE_KEYS.favorites, removeFromList(getFavorites(), id));
}
