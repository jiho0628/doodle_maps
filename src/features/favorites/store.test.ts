import { describe, expect, it } from "vitest";
import { STORAGE_PREFIX } from "@/lib/storage";
import { addFavorite, getFavorites, removeFavorite, renameFavorite } from "./store";

const KEY = STORAGE_PREFIX + "favorites";

describe("お気に入りの保存(localStorage)", () => {
  it("追加・名前変更・削除が端末に保存される", () => {
    const r = addFavorite({ name: "おうち", position: { lng: 139.76, lat: 35.68 }, address: "東京都千代田区" });
    expect(r.ok && r.added).toBe(true);
    if (!r.ok) return;
    expect(JSON.parse(window.localStorage.getItem(KEY)!)).toHaveLength(1);

    expect(renameFavorite(r.favorite.id, "じっか")).toBe(true);
    expect(getFavorites()[0]).toMatchObject({ name: "じっか", address: "東京都千代田区" });

    expect(removeFavorite(r.favorite.id)).toBe(true);
    expect(getFavorites()).toEqual([]);
  });

  it("壊れた保存データでも落ちずに空として扱う", () => {
    window.localStorage.setItem(KEY, "{こわれている");
    expect(getFavorites()).toEqual([]);
    window.localStorage.setItem(KEY, JSON.stringify({ not: "array" }));
    expect(getFavorites()).toEqual([]);
  });
});
