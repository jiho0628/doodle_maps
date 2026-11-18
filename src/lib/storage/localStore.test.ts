import { describe, expect, it, vi } from "vitest";
import { STORAGE_KEYS, STORAGE_PREFIX } from "./keys";
import { readJSON, removeItem, subscribe, writeJSON } from "./localStore";

const isStringArray = (v: unknown): v is string[] => Array.isArray(v) && v.every((x) => typeof x === "string");

describe("localStore", () => {
  it("書いた値を読める(接頭辞つきで保存される)", () => {
    expect(writeJSON(STORAGE_KEYS.favorites, ["a"])).toBe(true);
    expect(window.localStorage.getItem(STORAGE_PREFIX + "favorites")).toBe('["a"]');
    expect(readJSON(STORAGE_KEYS.favorites, [], isStringArray)).toEqual(["a"]);
  });

  it("未保存なら fallback", () => {
    expect(readJSON(STORAGE_KEYS.avatar, "none")).toBe("none");
  });

  it("壊れた JSON や形の違う値は fallback", () => {
    window.localStorage.setItem(STORAGE_PREFIX + "favorites", "{oops");
    expect(readJSON(STORAGE_KEYS.favorites, [], isStringArray)).toEqual([]);
    window.localStorage.setItem(STORAGE_PREFIX + "favorites", "[1,2]");
    expect(readJSON(STORAGE_KEYS.favorites, [], isStringArray)).toEqual([]);
  });

  it("容量オーバーなどで保存できなくても例外を投げず false", () => {
    const spy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("full", "QuotaExceededError");
    });
    expect(writeJSON(STORAGE_KEYS.avatar, { big: true })).toBe(false);
    spy.mockRestore();
  });

  it("同じタブ内の書き込み・削除を購読できる", () => {
    const onChange = vi.fn();
    const off = subscribe(STORAGE_KEYS.favorites, onChange);
    writeJSON(STORAGE_KEYS.favorites, []);
    writeJSON(STORAGE_KEYS.avatar, {}); // 別キーは通知しない
    removeItem(STORAGE_KEYS.favorites);
    off();
    writeJSON(STORAGE_KEYS.favorites, []);
    expect(onChange).toHaveBeenCalledTimes(2);
  });
});
