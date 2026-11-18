import { afterEach, describe, expect, it, vi } from "vitest";

const env = vi.hoisted(() => ({ key: "" }));
vi.mock("@/lib/config/env", () => ({ getServerEnv: () => ({ orsApiKey: "", hereApiKey: env.key }) }));

import { GET } from "./route";

const get = (q: string) => GET(new Request(`http://localhost/api/here?${q}`));
const sample = {
  items: [
    {
      id: "here:pds:place:392xn76s-1",
      title: "六角ace",
      resultType: "place",
      address: { label: "六角ace, 〒604-8123 京都府京都市中京区六角通, 日本" },
      position: { lat: 35.007, lng: 135.762 },
      categories: [{ id: "200-2000-0011", primary: true }],
    },
    { id: "x", title: "位置なし" },
  ],
};

afterEach(() => {
  vi.unstubAllGlobals();
  env.key = "";
});

describe("GET /api/here", () => {
  it("おかしな値は 400", async () => {
    expect((await get("q=x")).status).toBe(400);
    expect((await get("lat=35&lng=135")).status).toBe(400);
    expect((await get("category=pizza&lat=35&lng=135")).status).toBe(400);
  });

  it("キーがなければ 503(ブラウザは今までの検索を使う)", async () => {
    expect((await get("q=六角ace&lat=35&lng=135")).status).toBe(503);
  });

  it("名前での検索: 現在地を基準に、日本の中で discover する", async () => {
    env.key = "HKEY";
    const fetchMock = vi.fn().mockResolvedValue(Response.json(sample));
    vi.stubGlobal("fetch", fetchMock);
    const res = await get("q=六角ace&lat=35.02501&lng=135.76");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      source: "here",
      places: [{ id: "here:here:pds:place:392xn76s-1", name: "六角ace", address: "京都府京都市中京区六角通", position: { lng: 135.762, lat: 35.007 } }],
    });
    const url = new URL(fetchMock.mock.calls[0][0]);
    expect(url.origin + url.pathname).toBe("https://discover.search.hereapi.com/v1/discover");
    expect(Object.fromEntries(url.searchParams)).toMatchObject({
      q: "六角ace",
      at: "35.02500,135.76000",
      in: "countryCode:JPN",
      lang: "ja",
      apiKey: "HKEY",
    });
  });

  it("近くのコンビニ: browse で種類と範囲をしぼる", async () => {
    env.key = "HKEY";
    const fetchMock = vi.fn().mockResolvedValue(Response.json(sample));
    vi.stubGlobal("fetch", fetchMock);
    const json = await (await get("category=convenience&lat=35.025&lng=135.76")).json();
    expect(json.places[0].category).toBe("convenience");
    const url = new URL(fetchMock.mock.calls[0][0]);
    expect(url.origin + url.pathname).toBe("https://browse.search.hereapi.com/v1/browse");
    expect(url.searchParams.get("categories")).toBe("600-6000-0061");
    expect(url.searchParams.get("in")).toBe("circle:35.02500,135.76000;r=2400");
  });

  it("HERE がエラーなら 502 と理由", async () => {
    env.key = "HKEY";
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ title: "Unauthorized" }, { status: 401 })));
    const res = await get("q=x&lat=35&lng=135");
    expect(res.status).toBe(502);
    expect((await res.json()).detail).toContain("Unauthorized");
  });
});
