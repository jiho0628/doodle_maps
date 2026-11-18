import { describe, expect, it, vi } from "vitest";
import { fetchOrsRoute, parseOrsResponse } from "./ors";
import { ORS_SAMPLE } from "./orsSample.fixture";

describe("parseOrsResponse", () => {
  it("線・曲がり角・距離を案内用に変換する", () => {
    const body = parseOrsResponse(ORS_SAMPLE, "foot-walking");
    expect(body).not.toBeNull();
    expect(body!.route.coordinates).toEqual([
      [139.7, 35.7],
      [139.701, 35.7],
      [139.701, 35.701],
    ]);
    expect(body!.route.distanceM).toBe(201.6);
    expect(body!.route.steps.map((s) => s.turn)).toEqual(["depart", "left", "arrive"]);
    expect(body!.route.steps[1].instruction).toBe("左へ曲がる");
    expect(body!.route.steps[1].position).toEqual({ lng: 139.701, lat: 35.7 });
    expect(body!.stepIndices).toEqual([0, 1, 2]);
  });

  it("到着の案内がなければ補う", () => {
    const json = structuredClone(ORS_SAMPLE);
    json.features[0].properties.segments[0].steps.pop();
    const body = parseOrsResponse(json, "foot-walking")!;
    expect(body.route.steps.at(-1)?.turn).toBe("arrive");
    expect(body.stepIndices.at(-1)).toBe(2);
  });

  it("形がおかしければ null", () => {
    expect(parseOrsResponse({}, "foot-walking")).toBeNull();
    expect(parseOrsResponse({ features: [{ geometry: { coordinates: "x" } }] }, "foot-walking")).toBeNull();
  });
});

describe("fetchOrsRoute", () => {
  const request = { from: { lng: 139.7, lat: 35.7 }, to: { lng: 139.701, lat: 35.701 }, mode: "foot-walking" as const };

  it("キーをヘッダーに付けて、経度・緯度の順で送る", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(Response.json(ORS_SAMPLE));
    const result = await fetchOrsRoute(request, "secret", fetchImpl);
    expect(result.ok).toBe(true);
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe("https://api.openrouteservice.org/v2/directions/foot-walking/geojson");
    expect(init.headers.Authorization).toBe("secret");
    expect(JSON.parse(init.body).coordinates).toEqual([
      [139.7, 35.7],
      [139.701, 35.701],
    ]);
  });

  it("404 は「道が見つからない」", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response("{}", { status: 404 }));
    expect(await fetchOrsRoute(request, "k", fetchImpl)).toEqual({ ok: false, reason: "no_route" });
  });

  it("キー違い・回数制限・通信エラーは upstream", async () => {
    expect(await fetchOrsRoute(request, "k", vi.fn().mockResolvedValue(new Response("", { status: 403 })))).toEqual({
      ok: false,
      reason: "upstream",
      status: 403,
    });
    expect(await fetchOrsRoute(request, "k", vi.fn().mockRejectedValue(new Error("offline")))).toMatchObject({
      ok: false,
      reason: "upstream",
    });
  });
});
