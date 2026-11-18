import { describe, expect, it } from "vitest";
import type { Favorite } from "@/types";
import {
  addToList,
  distanceMeters,
  FAVORITE_NAME_MAX,
  iconForCategory,
  isFavorite,
  normalizeName,
  removeFromList,
  sanitizeFavorites,
  updateInList,
} from "./model";

const tokyo = { lng: 139.7671, lat: 35.6812 };
const fav = (id: string, position = tokyo, name = id): Favorite => ({
  id,
  name,
  position,
  icon: "heart",
  createdAt: "2026-01-01T00:00:00.000Z",
});

describe("お気に入りのデータ", () => {
  it("名前の空白を整え、長すぎる名前は切り、空なら代わりの名前にする", () => {
    expect(normalizeName("  おうち  ")).toBe("おうち");
    expect(normalizeName("   ")).toBe("お気に入りの場所");
    expect(normalizeName("", "前の名前")).toBe("前の名前");
    expect(Array.from(normalizeName("あ".repeat(50)))).toHaveLength(FAVORITE_NAME_MAX);
  });

  it("場所の種類からアイコンを選ぶ", () => {
    expect(iconForCategory("home")).toBe("home");
    expect(iconForCategory("convenience")).toBe("shop");
    expect(iconForCategory(undefined)).toBe("heart");
  });

  it("壊れた項目と重複を取り除く", () => {
    const list = sanitizeFavorites([fav("a"), { id: "x" }, null, fav("a"), { ...fav("b"), icon: "unknown" }, fav("c")]);
    expect(list.map((f) => f.id)).toEqual(["a", "c"]);
    expect(isFavorite({ ...fav("d"), position: { lng: 999, lat: 0 } })).toBe(false);
  });

  it("新しいお気に入りは先頭に入り、30m以内の同じ場所は追加しない", () => {
    const first = addToList([], { name: "おうち", position: tokyo, category: "home" });
    expect(first.added).toBe(true);
    expect(first.favorite.icon).toBe("home");
    expect(first.favorite.id).toMatch(/^fav_/);

    const near = { lng: tokyo.lng + 0.0001, lat: tokyo.lat }; // 約9m
    expect(distanceMeters(tokyo, near)).toBeLessThan(30);
    const again = addToList(first.list, { name: "ちがう名前", position: near });
    expect(again.added).toBe(false);
    expect(again.favorite.id).toBe(first.favorite.id);
    expect(again.list).toHaveLength(1);

    const far = addToList(first.list, { name: "学校", position: { lng: 139.7, lat: 35.69 } });
    expect(far.added).toBe(true);
    expect(far.list.map((f) => f.name)).toEqual(["学校", "おうち"]);
  });

  it("名前・アイコンを変え、消せる", () => {
    const list = [fav("a"), fav("b")];
    const renamed = updateInList(list, "b", { name: " カフェ ", icon: "cafe" });
    expect(renamed[1]).toMatchObject({ id: "b", name: "カフェ", icon: "cafe" });
    expect(renamed[0]).toBe(list[0]);
    // 空の名前にはしない
    expect(updateInList(list, "a", { name: "  " })[0].name).toBe("a");
    expect(removeFromList(list, "a").map((f) => f.id)).toEqual(["b"]);
  });
});
