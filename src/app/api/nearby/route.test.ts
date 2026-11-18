import { afterEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

const get = (q: string) => GET(new Request(`http://localhost/api/nearby?${q}`));

afterEach(() => vi.unstubAllGlobals());

describe("GET /api/nearby", () => {
  it("おかしな値は 400", async () => {
    expect((await get("category=pizza&lat=35&lng=139")).status).toBe(400);
    expect((await get("category=cafe&lat=abc&lng=139")).status).toBe(400);
    expect((await get("category=cafe&lng=139")).status).toBe(400);
  });

  it("近い順の場所を返し、キャッシュできるようにする", async () => {
    const fetchMock = vi.fn().mockImplementation(async () =>
      Response.json({
        elements: [
          { type: "node", id: 1, lat: 35.71, lon: 139.7, tags: { name: "遠い店" } },
          { type: "node", id: 2, lat: 35.7005, lon: 139.7, tags: { name: "近い店" } },
        ],
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const res = await get("category=convenience&lat=35.70001&lng=139.70001");
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toContain("s-maxage=300");
    const json = await res.json();
    expect(json.places.map((p: { name: string }) => p.name)).toEqual(["近い店", "遠い店"]);
    expect(fetchMock.mock.calls[0][1].headers["User-Agent"]).toBeUndefined(); // jsdom では window がある
  });

  it("Overpass が全部だめなら 502", async () => {
    vi.stubGlobal("fetch", vi.fn().mockImplementation(async () => new Response("", { status: 504 })));
    vi.spyOn(console, "warn").mockImplementation(() => {});
    expect((await get("category=cafe&lat=35&lng=139")).status).toBe(502);
  });
});
