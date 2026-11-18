import { describe, expect, it } from "vitest";
import { ANIMAL_AVATARS, avatarLabel, isAvatarChoice } from "./avatars";
import { centerSquareCrop } from "./photo";

describe("isAvatarChoice", () => {
  it("正しい形を受け入れる", () => {
    for (const a of ANIMAL_AVATARS) expect(isAvatarChoice({ kind: "animal", animal: a.id })).toBe(true);
    expect(isAvatarChoice({ kind: "photo", dataUrl: "data:image/jpeg;base64,AAAA" })).toBe(true);
  });

  it("おかしな値ははじく", () => {
    expect(isAvatarChoice(null)).toBe(false);
    expect(isAvatarChoice("rabbit")).toBe(false);
    expect(isAvatarChoice({ kind: "animal", animal: "dragon" })).toBe(false);
    expect(isAvatarChoice({ kind: "animal" })).toBe(false);
    expect(isAvatarChoice({ kind: "photo", dataUrl: "https://example.com/a.jpg" })).toBe(false);
    expect(isAvatarChoice({ kind: "photo", dataUrl: "javascript:alert(1)" })).toBe(false);
    expect(isAvatarChoice({ kind: "photo" })).toBe(false);
    expect(isAvatarChoice({ kind: "other" })).toBe(false);
  });
});

describe("avatarLabel", () => {
  it("動物は日本語の名前、写真は「写真」", () => {
    expect(avatarLabel({ kind: "animal", animal: "rabbit" })).toBe("うさぎ");
    expect(avatarLabel({ kind: "animal", animal: "penguin" })).toBe("ペンギン");
    expect(avatarLabel({ kind: "photo", dataUrl: "data:image/png;base64,AA" })).toBe("写真");
  });
});

describe("centerSquareCrop", () => {
  it("横長は左右を切る", () => {
    expect(centerSquareCrop(400, 300)).toEqual({ sx: 50, sy: 0, size: 300 });
  });
  it("縦長は上下を切る", () => {
    expect(centerSquareCrop(300, 500)).toEqual({ sx: 0, sy: 100, size: 300 });
  });
  it("正方形はそのまま", () => {
    expect(centerSquareCrop(192, 192)).toEqual({ sx: 0, sy: 0, size: 192 });
  });
  it("奇数差は半端な座標になる", () => {
    expect(centerSquareCrop(301, 300)).toEqual({ sx: 0.5, sy: 0, size: 300 });
  });
  it("大きさ0は例外", () => {
    expect(() => centerSquareCrop(0, 100)).toThrow();
    expect(() => centerSquareCrop(100, Number.NaN)).toThrow();
  });
});
