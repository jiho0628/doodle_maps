import { describe, expect, it } from "vitest";
import { FALLBACK_STYLE_URL } from "./constants";
import { resolveMapStyle } from "./mapStyle";

describe("resolveMapStyle", () => {
  it("キーがなければキー不要の代替スタイルを使う", () => {
    expect(resolveMapStyle({ maptilerKey: "", maptilerStyle: "streets-v2" })).toEqual({
      url: FALLBACK_STYLE_URL,
      source: "fallback",
    });
  });

  it("空白だけのキーも未設定扱い", () => {
    expect(resolveMapStyle({ maptilerKey: "   ", maptilerStyle: "streets-v2" }).source).toBe("fallback");
  });

  it("キーがあれば MapTiler のスタイルURLを組み立てる", () => {
    const style = resolveMapStyle({ maptilerKey: "abc 123", maptilerStyle: "pastel" });
    expect(style.source).toBe("maptiler");
    expect(style.url).toBe("https://api.maptiler.com/maps/pastel/style.json?key=abc%20123");
  });

  it("スタイル名が空なら streets-v2", () => {
    expect(resolveMapStyle({ maptilerKey: "k", maptilerStyle: "" }).url).toContain("/maps/streets-v2/");
  });
});
