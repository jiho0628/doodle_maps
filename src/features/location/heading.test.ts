import { describe, expect, it } from "vitest";
import { headingFromOrientation, normalizeDegrees, shortestDelta, smoothHeading } from "./heading";

describe("headingFromOrientation", () => {
  it("iPhone は webkitCompassHeading をそのまま使う", () => {
    expect(headingFromOrientation({ alpha: 10, webkitCompassHeading: 90 })).toBe(90);
  });

  it("Android の absolute な alpha は反時計回りなので反転する", () => {
    expect(headingFromOrientation({ alpha: 90, absolute: true })).toBe(270);
    expect(headingFromOrientation({ alpha: 0, absolute: true })).toBe(0);
  });

  it("北の分からない相対値は使わない", () => {
    expect(headingFromOrientation({ alpha: 90, absolute: false })).toBeNull();
    expect(headingFromOrientation({ alpha: null, absolute: true })).toBeNull();
  });

  it("画面が横向きなら回転分を足す", () => {
    expect(headingFromOrientation({ alpha: null, webkitCompassHeading: 300 }, 90)).toBe(30);
  });
});

describe("角度の計算", () => {
  it("normalizeDegrees は 0〜360 に収める", () => {
    expect(normalizeDegrees(-10)).toBe(350);
    expect(normalizeDegrees(370)).toBe(10);
  });

  it("shortestDelta は北をまたいでも最短", () => {
    expect(shortestDelta(350, 10)).toBe(20);
    expect(shortestDelta(10, 350)).toBe(-20);
  });

  it("smoothHeading は 359→1 で逆回りしない", () => {
    const next = smoothHeading(359, 1, 0.5);
    expect(next).toBeCloseTo(0, 5);
  });

  it("最初の値はそのまま", () => {
    expect(smoothHeading(null, 123)).toBe(123);
  });
});
