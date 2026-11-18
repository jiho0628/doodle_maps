import { describe, expect, it } from "vitest";
import { findCategory } from "./categories";
import { buildGeocodeUrl, parseGeocodeResponse } from "./geocode";
import { buildOverpassQuery, parseOverpassResponse } from "./nearby";

describe("MapTiler 文字検索", () => {
  it("URL に日本語・近くの場所・日本限定を入れる", () => {
    const url = new URL(buildGeocodeUrl("東京駅", "KEY", { lng: 139.76712, lat: 35.68123 }));
    expect(url.pathname).toBe(`/geocoding/${encodeURIComponent("東京駅")}.json`);
    expect(url.searchParams.get("key")).toBe("KEY");
    expect(url.searchParams.get("language")).toBe("ja");
    expect(url.searchParams.get("country")).toBe("jp");
    expect(url.searchParams.get("proximity")).toBe("139.76712,35.68123");
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
      '[out:json][timeout:15];nwr["amenity"="cafe"](around:1200,35.700000,139.700000);out center 60;',
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
