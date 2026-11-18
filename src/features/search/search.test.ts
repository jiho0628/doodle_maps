import { describe, expect, it } from "vitest";
import { findCategory, matchCategory } from "./categories";
import { buildGeocodeUrl, parseGeocodeResponse } from "./geocode";
import { buildOverpassQuery, ENDPOINT_TIMEOUT_MS, fetchNearbyFromOverpass, overpassServerHeaders, parseOverpassResponse } from "./nearby";
import { searchNearbyWithMapTiler } from "./mapTilerNearby";
import { vi } from "vitest";

describe("MapTiler 文字検索", () => {
  it("URL に日本語・近くの場所・日本限定を入れる", () => {
    const url = new URL(buildGeocodeUrl("東京駅", "KEY", { lng: 139.76712, lat: 35.68123 }));
    expect(url.pathname).toBe(`/geocoding/${encodeURIComponent("東京駅")}.json`);
    expect(url.searchParams.get("key")).toBe("KEY");
    expect(url.searchParams.get("language")).toBe("ja");
    expect(url.searchParams.get("country")).toBe("jp");
    expect(url.searchParams.get("proximity")).toBe("139.76712,35.68123");
    expect(url.searchParams.has("types")).toBe(false);
  });

  it("近くの店は types=poi で店・施設にしぼってさがす(初期設定では店が出ないため)", async () => {
    const fetchImpl = vi.fn().mockImplementation(async (url: string) => {
      const u = new URL(url);
      const q = decodeURIComponent(u.pathname.split("/").pop()!.replace(".json", ""));
      return Response.json({
        features:
          u.searchParams.get("types") === "poi" && q === "ローソン"
            ? [{ id: "poi.9", text: "ローソン 四条店", center: [135.7601, 35.0036] }]
            : [],
      });
    });
    const places = await searchNearbyWithMapTiler(findCategory("convenience")!, { lng: 135.76, lat: 35.0035 }, { key: "K", fetchImpl });
    expect(places.map((p) => p.name)).toEqual(["ローソン 四条店"]);
    for (const [url] of fetchImpl.mock.calls) expect(new URL(String(url)).searchParams.get("types")).toBe("poi");
  });

  it("結果を Place にする(住所は「都道府県 市区町村 …」の順)", () => {
    const places = parseGeocodeResponse({
      features: [
        {
          id: "poi.1",
          text: "カフェ こもれび",
          place_name: "カフェ こもれび, 丸の内一丁目, 千代田区, 東京都, 日本",
          center: [139.76, 35.68],
          properties: { categories: ["cafe"] },
        },
        { id: "bad", text: "座標なし" },
      ],
    });
    expect(places).toEqual([
      {
        id: "maptiler:poi.1",
        name: "カフェ こもれび",
        address: "東京都 千代田区 丸の内一丁目",
        position: { lng: 139.76, lat: 35.68 },
        category: "cafe",
      },
    ]);
    expect(parseGeocodeResponse(null)).toEqual([]);
  });
});

describe("近くをさがす(Overpass)", () => {
  const cafe = findCategory("cafe")!;
  const toilet = findCategory("toilet")!;
  const center = { lng: 139.7, lat: 35.7 };

  it("クエリに条件と半径を入れる", () => {
    expect(buildOverpassQuery(cafe, center)).toBe(
      '[out:json][timeout:8];nw["amenity"="cafe"](around:1200,35.700000,139.700000);out center 40;',
    );
  });

  it("近い順に並べ、名前のないカフェは出さない", () => {
    const places = parseOverpassResponse(
      {
        elements: [
          { type: "node", id: 1, lat: 35.71, lon: 139.7, tags: { amenity: "cafe", name: "遠いカフェ" } },
          { type: "way", id: 2, center: { lat: 35.701, lon: 139.7 }, tags: { amenity: "cafe", name: "Near", "name:ja": "近いカフェ" } },
          { type: "node", id: 3, lat: 35.7005, lon: 139.7, tags: { amenity: "cafe" } },
        ],
      },
      cafe,
      center,
    );
    expect(places.map((p) => p.name)).toEqual(["近いカフェ", "遠いカフェ"]);
    expect(places[0]).toMatchObject({ id: "osm:way/2", category: "cafe", position: { lng: 139.7, lat: 35.701 } });
    expect(places[0]).not.toHaveProperty("d");
  });

  it("名前のないトイレは「公衆トイレ」と呼ぶ", () => {
    const places = parseOverpassResponse({ elements: [{ type: "node", id: 9, lat: 35.7, lon: 139.7, tags: {} }] }, toilet, center);
    expect(places[0].name).toBe("公衆トイレ");
  });
});

describe("カテゴリの言葉", () => {
  it("言い換えや「近くの」付きでもカテゴリとみなす", () => {
    expect(matchCategory("コンビニ")?.id).toBe("convenience");
    expect(matchCategory(" 近くのコンビニ ")?.id).toBe("convenience");
    expect(matchCategory("こんびに")?.id).toBe("convenience");
    expect(matchCategory("ｺﾝﾋﾞﾆ")?.id).toBe("convenience");
    expect(matchCategory("喫茶店")?.id).toBe("cafe");
    expect(matchCategory("お手洗い")?.id).toBe("toilet");
    expect(matchCategory("トイレどこ")?.id).toBe("toilet");
    expect(matchCategory("東京駅")).toBeUndefined();
    expect(matchCategory("セブンイレブン")).toBeUndefined();
  });
});

describe("fetchNearbyFromOverpass", () => {
  const conv = findCategory("convenience")!;
  const center = { lng: 139.7, lat: 35.7 };
  const hit = { elements: [{ type: "node", id: 1, lat: 35.701, lon: 139.7, tags: { name: "ローソン" } }] };

  it("本家と予備に同時に聞き、答えられたサーバーの結果を使う", async () => {
    const fetchImpl = vi.fn().mockImplementation(async (url: string) => {
      const host = new URL(url).host;
      if (host === "overpass-api.de") return new Response("", { status: 429 });
      if (host === "overpass.private.coffee") return Response.json({ elements: [], remark: "runtime error: timeout" });
      return Response.json(hit);
    });
    const places = await fetchNearbyFromOverpass(conv, center, { fetchImpl });
    expect(places.map((p) => p.name)).toEqual(["ローソン"]);
    expect(new Set(fetchImpl.mock.calls.map(([u]) => new URL(String(u)).host))).toEqual(
      new Set(["overpass-api.de", "overpass.private.coffee", "overpass.kumi.systems"]),
    );
  });

  it("近くに無ければ範囲を広げてさがしなおす", async () => {
    const fetchImpl = vi.fn().mockImplementation(async (url: string) => {
      const q = new URL(url).searchParams.get("data") ?? "";
      return Response.json(q.includes("around:3600,") ? hit : { elements: [] });
    });
    const places = await fetchNearbyFromOverpass(conv, center, { fetchImpl });
    expect(places).toHaveLength(1);
  });

  it("返事のないサーバーは待ちすぎない(理由は timeout)", async () => {
    const fetchImpl = vi.fn().mockImplementation(
      (_url: string, init: RequestInit) =>
        new Promise((_, reject) => init.signal?.addEventListener("abort", () => reject(new Error("aborted")))),
    );
    const started = Date.now();
    await expect(fetchNearbyFromOverpass(conv, center, { fetchImpl, timeoutMs: 50 })).rejects.toThrow(
      /overpass-api\.de: timeout/,
    );
    expect(Date.now() - started).toBeLessThan(1_000);
    expect(ENDPOINT_TIMEOUT_MS).toBeLessThanOrEqual(8_000);
  });

  it("GET で送り、独自の Accept ヘッダーは付けない(406 対策)", async () => {
    const fetchImpl = vi.fn().mockImplementation(async () => Response.json(hit));
    await fetchNearbyFromOverpass(conv, center, { fetchImpl, endpoints: ["https://overpass-api.de/api/interpreter"] });
    const [url, init] = fetchImpl.mock.calls[0];
    expect(init.method).toBe("GET");
    expect(init.body).toBeUndefined();
    expect(JSON.stringify(init.headers ?? {})).not.toMatch(/accept/i);
    expect(new URL(url).searchParams.get("data")).toContain('nw["shop"="convenience"]');
  });

  it("全部だめなら、サーバーごとの理由をまとめたエラー", async () => {
    const fetchImpl = vi.fn().mockImplementation(async (url: string) =>
      new Response("", { status: new URL(url).host === "overpass-api.de" ? 406 : 504 }),
    );
    await expect(fetchNearbyFromOverpass(conv, center, { fetchImpl })).rejects.toThrow(
      /overpass-api\.de: HTTP 406.*overpass\.kumi\.systems: HTTP 504/,
    );
  });

  it("サーバーからはサイトの URL を連絡先として名乗る", () => {
    expect(overpassServerHeaders("https://example.app")).toEqual({
      "User-Agent": "doodle_maps/1.0 (+https://example.app)",
      Referer: "https://example.app/",
    });
  });
});
