import { describe, expect, it } from "vitest";
import {
  cumulativeDistances,
  distanceM,
  estimateWalkMinutes,
  formatClock,
  formatDistance,
  formatMinutes,
  locateOnRoute,
  walkLabel,
} from "./geo";

// 東京駅 → 有楽町駅(約 800m)
const TOKYO = { lng: 139.7671, lat: 35.6812 };
const YURAKUCHO = { lng: 139.7631, lat: 35.675 };

describe("距離と表示", () => {
  it("2点間の距離をだいたい正しく出す", () => {
    const d = distanceM(TOKYO, YURAKUCHO);
    expect(d).toBeGreaterThan(700);
    expect(d).toBeLessThan(850);
    expect(distanceM(TOKYO, TOKYO)).toBe(0);
  });

  it("距離を読みやすく丸める", () => {
    expect(formatDistance(12.4)).toBe("12m");
    expect(formatDistance(123)).toBe("120m");
    expect(formatDistance(1234)).toBe("1.2km");
    expect(formatDistance(23_456)).toBe("23km");
  });

  it("分を「4分」「1時間5分」にする", () => {
    expect(formatMinutes(0.2)).toBe("1分");
    expect(formatMinutes(4.4)).toBe("4分");
    expect(formatMinutes(65)).toBe("1時間5分");
    expect(formatMinutes(120)).toBe("2時間");
  });

  it("時刻を「12:05」にする", () => {
    expect(formatClock(new Date(2026, 0, 1, 12, 5))).toBe("12:05");
  });

  it("歩く時間は少し長めに見積もる(分速80m、道の曲がりを考えて1.25倍)", () => {
    expect(estimateWalkMinutes(0)).toBe(1);
    expect(estimateWalkMinutes(320)).toBe(5);
    expect(walkLabel(TOKYO, YURAKUCHO)).toMatch(/^歩いて約\d+分$/);
    expect(walkLabel(TOKYO, { lng: 139.9, lat: 35.8 })).toMatch(/^ここから約\d+km$/);
  });
});

describe("経路上の位置", () => {
  // 東へ約 90m 進んでから北へ約 110m 進む L 字
  const coords: [number, number][] = [
    [139.7, 35.7],
    [139.701, 35.7],
    [139.701, 35.701],
  ];
  const cum = cumulativeDistances(coords);

  it("累積距離を出す", () => {
    expect(cum[0]).toBe(0);
    expect(cum[1]).toBeCloseTo(90.4, 0);
    expect(cum[2]).toBeCloseTo(90.4 + 111.2, 0);
  });

  it("経路の上にいれば、ずれはほぼ0で、進んだ距離がわかる", () => {
    const p = locateOnRoute({ lng: 139.7005, lat: 35.7 }, coords, cum);
    expect(p.segmentIndex).toBe(0);
    expect(p.offRouteM).toBeLessThan(1);
    expect(p.alongM).toBeCloseTo(45.2, 0);
  });

  it("曲がった後の区間にいることがわかる", () => {
    const p = locateOnRoute({ lng: 139.701, lat: 35.7005 }, coords, cum);
    expect(p.segmentIndex).toBe(1);
    expect(p.alongM).toBeCloseTo(90.4 + 55.6, 0);
  });

  it("経路から外れた距離がわかる", () => {
    const p = locateOnRoute({ lng: 139.7005, lat: 35.7005 }, coords, cum);
    expect(p.offRouteM).toBeGreaterThan(40);
  });
});
