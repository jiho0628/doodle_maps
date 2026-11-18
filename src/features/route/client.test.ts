import { describe, expect, it, vi } from "vitest";
import type { Place } from "@/types";
import { fetchRoute } from "./client";
import { navigateHref, parseNavigateParams } from "./navigateHref";
import { prepareRoute, straightLineRoute } from "./navRoute";
import { summarizeProgress } from "./useNavigation";
import { locateOnRoute } from "./geo";
import { parseOrsResponse } from "./server/ors";
import { ORS_SAMPLE } from "./server/orsSample.fixture";

const destination: Place = { id: "x", name: "カフェ こもれび", position: { lng: 139.701, lat: 35.701 } };
const from = { lng: 139.7, lat: 35.7 };

describe("navigateHref / parseNavigateParams", () => {
  it("URL を作って読み戻せる(日本語の名前も)", () => {
    const href = navigateHref({ ...destination, address: "東京都 千代田区" });
    expect(href.startsWith("/navigate?")).toBe(true);
    const parsed = parseNavigateParams(new URLSearchParams(href.split("?")[1]));
    expect(parsed).toMatchObject({
      name: "カフェ こもれび",
      address: "東京都 千代田区",
      position: { lng: 139.701, lat: 35.701 },
    });
  });

  it("お気に入り側の形式(lng/lat/name)も読める", () => {
    const parsed = parseNavigateParams(new URLSearchParams(`lng=139.7&lat=35.6&name=${encodeURIComponent("いえ")}`));
    expect(parsed?.name).toBe("いえ");
  });

  it("おかしな値は null、名前がなければ「目的地」", () => {
    expect(parseNavigateParams(new URLSearchParams("lng=abc&lat=1"))).toBeNull();
    expect(parseNavigateParams(new URLSearchParams("lng=200&lat=1"))).toBeNull();
    expect(parseNavigateParams(new URLSearchParams("name=x"))).toBeNull();
    expect(parseNavigateParams(new URLSearchParams("lng=139&lat=35"))?.name).toBe("目的地");
  });
});

describe("fetchRoute", () => {
  it("経路が返れば目的地を付けて返す", async () => {
    const body = parseOrsResponse(ORS_SAMPLE, "foot-walking");
    const fetchImpl = vi.fn().mockResolvedValue(Response.json(body));
    const result = await fetchRoute(from, destination, { fetchImpl });
    expect(result.kind).toBe("ok");
    if (result.kind !== "ok") return;
    expect(result.nav.route.destination.name).toBe("カフェ こもれび");
    expect(result.nav.approximate).toBe(false);
  });

  it("ORS のキーが未設定なら、目的地への直線で案内する", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(Response.json({ error: "not_configured" }, { status: 503 }));
    const result = await fetchRoute(from, destination, { fetchImpl });
    expect(result.kind).toBe("ok");
    if (result.kind !== "ok") return;
    expect(result.nav.approximate).toBe(true);
    expect(result.nav.route.coordinates).toHaveLength(2);
  });

  it("遠すぎる・通信エラーを区別する", async () => {
    const tooFar = vi.fn().mockResolvedValue(Response.json({ error: "too_far" }, { status: 422 }));
    expect(await fetchRoute(from, destination, { fetchImpl: tooFar })).toEqual({ kind: "too_far" });
    const offline = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"));
    expect(await fetchRoute(from, destination, { fetchImpl: offline })).toEqual({ kind: "error" });
    const html = vi.fn().mockResolvedValue(new Response("<html>", { status: 500 }));
    expect(await fetchRoute(from, destination, { fetchImpl: html })).toEqual({ kind: "error" });
  });
});

describe("summarizeProgress", () => {
  const body = parseOrsResponse(ORS_SAMPLE, "foot-walking")!;
  const route = prepareRoute({ ...body, route: { ...body.route, destination } });

  it("出発直後は、次の曲がり角(左)までの距離を出す", () => {
    const pos = { lng: 139.7002, lat: 35.7 };
    const s = summarizeProgress(route, locateOnRoute(pos, route.route.coordinates, route.cumulative), pos);
    expect(s.nextStep?.turn).toBe("left");
    expect(s.distanceToNextM).toBeGreaterThan(60);
    expect(s.distanceToNextM).toBeLessThan(80);
    expect(s.remainingM).toBeGreaterThan(180);
    // 経路の速さ(145秒/202m)で残り時間を出す
    expect(s.remainingS).toBeCloseTo((s.remainingM * 145.2) / 201.6, 1);
  });

  it("曲がった後は、到着までを出す", () => {
    const pos = { lng: 139.701, lat: 35.7005 };
    const s = summarizeProgress(route, locateOnRoute(pos, route.route.coordinates, route.cumulative), pos);
    expect(s.nextStep?.turn).toBe("arrive");
    expect(s.distanceToNextM).toBeCloseTo(55.6, 0);
  });

  it("直線の代わり経路では、目的地までの直線距離を出す", () => {
    const approx = prepareRoute(straightLineRoute(from, destination));
    const pos = { lng: 139.7005, lat: 35.7005 };
    const s = summarizeProgress(approx, locateOnRoute(pos, approx.route.coordinates, approx.cumulative), pos);
    expect(s.remainingM).toBeCloseTo(s.distanceToNextM, 5);
    expect(s.remainingM).toBeGreaterThan(60);
  });
});
