"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";
import type { StorageKey } from "./keys";
import { parseStored, readRaw, removeItem, subscribe, writeJSON } from "./localStore";

/** 生文字列が同じ間は同じオブジェクトを返す getSnapshot を作る(useSyncExternalStore の要件) */
function createSnapshotGetter<T>(key: StorageKey, fallback: T, validate?: (value: unknown) => value is T) {
  let lastRaw: string | null | undefined;
  let lastValue: T = fallback;
  return () => {
    const raw = readRaw(key);
    if (raw !== lastRaw) {
      lastRaw = raw;
      lastValue = parseStored(raw, fallback, validate);
    }
    return lastValue;
  };
}

/**
 * localStorage と同期する state。
 *
 *   const [favorites, setFavorites] = useStoredState(STORAGE_KEYS.favorites, EMPTY, isFavoriteList);
 *
 * - fallback はモジュール定数など「毎回同じ参照」を渡してください。
 * - サーバー描画と最初の描画では fallback を返し、その後に保存値へ切り替わります。
 * - 別タブや同じタブ内の他のコンポーネントでの変更も反映されます。
 */
export function useStoredState<T>(
  key: StorageKey,
  fallback: T,
  validate?: (value: unknown) => value is T,
): [T, (next: T | ((prev: T) => T)) => boolean, () => void] {
  const getSnapshot = useMemo(() => createSnapshotGetter(key, fallback, validate), [key, fallback, validate]);

  const value = useSyncExternalStore(
    useCallback((onChange) => subscribe(key, onChange), [key]),
    getSnapshot,
    () => fallback,
  );

  const set = useCallback(
    (next: T | ((prev: T) => T)) => {
      const prev = parseStored(readRaw(key), fallback, validate);
      const resolved = typeof next === "function" ? (next as (p: T) => T)(prev) : next;
      return writeJSON(key, resolved);
    },
    [key, fallback, validate],
  );

  const clear = useCallback(() => removeItem(key), [key]);

  return [value, set, clear];
}
