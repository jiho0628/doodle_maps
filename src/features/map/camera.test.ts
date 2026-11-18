import { describe, expect, it } from "vitest";
import { isStoredCamera } from "./camera";

describe("isStoredCamera", () => {
  it("正しい形を受け入れる", () => {
    expect(isStoredCamera({ center: { lng: 139.7, lat: 35.6 }, zoom: 15 })).toBe(true);
  });

  it.each([
    null,
    "x",
    {},
    { center: { lng: 139.7 }, zoom: 15 },
    { center: { lng: 200, lat: 35 }, zoom: 15 },
    { center: { lng: 139, lat: 35 }, zoom: Number.NaN },
    { center: { lng: 139, lat: 35 }, zoom: 99 },
  ])("壊れた値 %j は受け入れない", (value) => {
    expect(isStoredCamera(value)).toBe(false);
  });
});
