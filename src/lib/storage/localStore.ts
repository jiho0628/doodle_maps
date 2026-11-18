import { STORAGE_PREFIX, type StorageKey } from "./keys";

/**
 * localStorage を安全に読み書きする小さなラッパー。
 * - SSR 中(window なし)、プライベートモード、容量オーバーでも例外を投げない
 * - 値は JSON で保存
 * - 書き込むと同じタブ内の購読者にも通知する(storage イベントは他タブにしか飛ばないため)
 */

export const STORAGE_CHANGE_EVENT = "doodle_maps:storage";

export type StorageChangeDetail = { key: StorageKey };

function fullKey(key: StorageKey): string {
  return STORAGE_PREFIX + key;
}

function getStorage(): Storage | null {
  try {
    if (typeof window === "undefined") return null;
    return window.localStorage;
  } catch {
    return null;
  }
}

/** 生の文字列を読む(なければ null) */
export function readRaw(key: StorageKey): string | null {
  try {
    return getStorage()?.getItem(fullKey(key)) ?? null;
  } catch {
    return null;
  }
}

/**
 * JSON を読む。壊れている・型チェックに落ちたときは fallback を返す。
 * @param validate 読んだ値が期待した形かを確かめる関数(任意)
 */
export function readJSON<T>(key: StorageKey, fallback: T, validate?: (value: unknown) => value is T): T {
  const raw = readRaw(key);
  return parseStored(raw, fallback, validate);
}

export function parseStored<T>(raw: string | null, fallback: T, validate?: (value: unknown) => value is T): T {
  if (raw === null) return fallback;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (validate && !validate(parsed)) return fallback;
    return parsed as T;
  } catch {
    return fallback;
  }
}

/** JSON で保存する。保存できたら true。 */
export function writeJSON(key: StorageKey, value: unknown): boolean {
  const storage = getStorage();
  if (!storage) return false;
  try {
    storage.setItem(fullKey(key), JSON.stringify(value));
    notify(key);
    return true;
  } catch {
    // 容量オーバー(写真アバターなど)やプライベートモード
    return false;
  }
}

export function removeItem(key: StorageKey): void {
  const storage = getStorage();
  if (!storage) return;
  try {
    storage.removeItem(fullKey(key));
    notify(key);
  } catch {
    // 何もしない
  }
}

function notify(key: StorageKey) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<StorageChangeDetail>(STORAGE_CHANGE_EVENT, { detail: { key } }));
}

/** 指定キーの変更(同じタブ・他タブの両方)を購読する。戻り値で解除。 */
export function subscribe(key: StorageKey, onChange: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const onLocal = (e: Event) => {
    if ((e as CustomEvent<StorageChangeDetail>).detail?.key === key) onChange();
  };
  const onOtherTab = (e: StorageEvent) => {
    if (e.key === null || e.key === fullKey(key)) onChange();
  };
  window.addEventListener(STORAGE_CHANGE_EVENT, onLocal);
  window.addEventListener("storage", onOtherTab);
  return () => {
    window.removeEventListener(STORAGE_CHANGE_EVENT, onLocal);
    window.removeEventListener("storage", onOtherTab);
  };
}
