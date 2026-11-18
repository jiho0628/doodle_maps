import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

const env = vi.hoisted(() => ({ publicEnv: { maptilerKey: "", maptilerStyle: "streets-v2" } }));
vi.mock("@/lib/config/env", () => env);

import { SearchScreen } from "./SearchScreen";
import { clearNearbyCache } from "./nearby";
import { resetHereClient } from "./hereClient";

/** HERE のキーは未設定(/api/here は 503)として、それ以外を mock にまかせる */
function stubFetch(mock: (url: string, init?: RequestInit) => Promise<Response>) {
  vi.stubGlobal("fetch", (url: string, init?: RequestInit) =>
    String(url).startsWith("/api/here") ? Promise.resolve(Response.json({ error: "not_configured" }, { status: 503 })) : mock(url, init),
  );
}

afterEach(() => {
  clearNearbyCache();
  resetHereClient();
  vi.unstubAllGlobals();
  env.publicEnv.maptilerKey = "";
});

describe("SearchScreen", () => {
  it("「カフェ」を押すと近くのカフェが出て、「行く」で案内画面へ進める", async () => {
    const fetchMock = vi.fn().mockImplementation(async () =>
      Response.json({
        places: [{ id: "osm:node/1", name: "カフェ こもれび", position: { lng: 139.767, lat: 35.6813 }, category: "cafe" }],
      }),
    );
    stubFetch(fetchMock);
    render(<SearchScreen />);

    await userEvent.click(screen.getByRole("button", { name: "カフェ" }));

    expect(await screen.findByRole("heading", { name: "近くのカフェ" })).toBeInTheDocument();
    const link = await screen.findByRole("link", { name: "カフェ こもれびへ行く" });
    expect(link.getAttribute("href")).toMatch(/^\/navigate\?lng=139\.767&lat=35\.6813&name=/);
    expect(screen.getByRole("searchbox", { name: "場所をさがす" })).toHaveValue("カフェ");
    expect(String(fetchMock.mock.calls[0][0])).toMatch(/^\/api\/nearby\?category=cafe&lat=/);
  });

  it("文字で検索すると MapTiler に問い合わせる", async () => {
    env.publicEnv.maptilerKey = "KEY";
    const fetchMock = vi.fn().mockImplementation(async (url: string) =>
      Response.json({
        features:
          new URL(url).searchParams.get("types") === "poi"
            ? [{ id: "p1", text: "スターバックス 東京駅店", center: [139.766, 35.681] }]
            : [{ id: "1", text: "東京駅", place_name: "東京駅, 千代田区, 東京都, 日本", center: [139.767, 35.681] }],
      }),
    );
    stubFetch(fetchMock);
    render(<SearchScreen />);

    await userEvent.type(screen.getByRole("searchbox"), "東京駅{Enter}");

    const list = await screen.findByRole("list");
    expect(within(list).getByText("東京駅")).toBeInTheDocument();
    expect(within(list).getByText("東京都 千代田区")).toBeInTheDocument();
    // 店・施設(types=poi)も同時にさがす
    expect(within(list).getByText("スターバックス 東京駅店")).toBeInTheDocument();
    expect(String(fetchMock.mock.calls[0][0])).toContain("api.maptiler.com/geocoding/");
  });

  it("MapTiler のキーがなくても壊れず、ボタンでさがすよう案内する", async () => {
    const fetchMock = vi.fn();
    stubFetch(fetchMock);
    render(<SearchScreen />);

    await userEvent.type(screen.getByRole("searchbox"), "東京駅{Enter}");

    expect(await screen.findByRole("alert")).toHaveTextContent("いまは文字での検索が使えません");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("文字で「コンビニ」と入れても、店名ではなく近くのコンビニをさがす", async () => {
    env.publicEnv.maptilerKey = "KEY";
    const fetchMock = vi.fn().mockImplementation(async (url: string) =>
      String(url).startsWith("/api/nearby")
        ? Response.json({ places: [{ id: "osm:node/7", name: "ローソン 丸の内店", position: { lng: 139.767, lat: 35.681 } }] })
        : Response.json({ features: [] }),
    );
    stubFetch(fetchMock);
    render(<SearchScreen />);

    await userEvent.type(screen.getByRole("searchbox"), "近くのコンビニ{Enter}");

    expect(await screen.findByRole("heading", { name: "近くのコンビニ" })).toBeInTheDocument();
    expect(await screen.findByText("ローソン 丸の内店")).toBeInTheDocument();
    expect(String(fetchMock.mock.calls[0][0])).toContain("/api/nearby?category=convenience");
    // 店名としての「コンビニ」では検索しない
    expect(fetchMock.mock.calls.some(([u]) => String(u).includes(encodeURIComponent("近くのコンビニ")))).toBe(false);
  });

  it("サーバーがだめでも、ブラウザから直接 Overpass には聞かない(406 で断られるため)", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const fetchMock = vi.fn().mockImplementation(async () => new Response("", { status: 502 }));
    stubFetch(fetchMock);
    render(<SearchScreen />);
    await userEvent.click(screen.getByRole("button", { name: "駅" }));
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(fetchMock.mock.calls.some(([u]) => String(u).includes("overpass"))).toBe(false);
  });

  it("名前での検索は近くの店を先に、遠い同名の地名は後ろに出す", async () => {
    env.publicEnv.maptilerKey = "KEY";
    // 京都の現在地(テストでは東京駅あたりになる)の近くにだけ店がある
    stubFetch(
      vi.fn().mockImplementation(async (url: string) => {
        const u = new URL(url);
        const near = u.searchParams.has("bbox");
        const poi = u.searchParams.get("types") === "poi";
        if (near) return Response.json({ features: poi ? [{ id: "p1", text: "六角ace", center: [139.768, 35.682] }] : [] });
        return Response.json({
          features: poi ? [] : [{ id: "f1", text: "六角", place_name: "六角, 姫路市, 兵庫県, 日本", center: [134.69, 34.82] }],
        });
      }),
    );
    render(<SearchScreen />);
    await userEvent.type(screen.getByRole("searchbox"), "六角ace{Enter}");
    const list = await screen.findByRole("list");
    const names = within(list).getAllByRole("link").map((a) => a.getAttribute("aria-label"));
    expect(names).toEqual(["六角aceへ行く", "六角へ行く"]);
  });

  it("OpenStreetMap が遅いときは MapTiler の近くの結果を先に出す", async () => {
    env.publicEnv.maptilerKey = "KEY";
    stubFetch(
      vi.fn().mockImplementation((url: string, init?: RequestInit) => {
        if (String(url).includes("maptiler")) {
          const q = decodeURIComponent(new URL(String(url)).pathname.split("/").pop()!.replace(".json", ""));
          return Promise.resolve(
            Response.json({
              features: q === "ローソン" ? [{ id: "l1", text: "ローソン 東京駅前店", center: [139.7672, 35.6813] }] : [],
            }),
          );
        }
        // OpenStreetMap 側は返ってこない(取り消されるまで待つ)
        return new Promise((_, reject) => init?.signal?.addEventListener("abort", () => reject(new Error("aborted"))));
      }),
    );
    render(<SearchScreen />);
    await userEvent.click(screen.getByRole("button", { name: "コンビニ" }));
    expect(await screen.findByText("ローソン 東京駅前店", undefined, { timeout: 5000 })).toBeInTheDocument();
  }, 10_000);

  it("近くの検索が失敗したら、通信のエラーと「もう一度ためす」を出す", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    let fail = true;
    stubFetch(
      vi.fn().mockImplementation(async (url: string) =>
        fail
          ? new Response("", { status: 429 })
          : String(url).startsWith("/api/nearby")
            ? Response.json({ places: [{ id: "osm:node/5", name: "公衆トイレ", position: { lng: 139.76, lat: 35.68 } }] })
            : Response.json({ features: [] }),
      ),
    );
    render(<SearchScreen />);
    await userEvent.click(screen.getByRole("button", { name: "トイレ" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("通信がうまくいかなかった");
    fail = false;
    await userEvent.click(screen.getByRole("button", { name: "もう一度ためす" }));
    expect(await screen.findByRole("link", { name: "公衆トイレへ行く" })).toBeInTheDocument();
  });

  it("OpenStreetMap が失敗して MapTiler が0件なら「見つからない」ではなく通信のエラーにする", async () => {
    env.publicEnv.maptilerKey = "KEY";
    vi.spyOn(console, "warn").mockImplementation(() => {});
    stubFetch(
      vi.fn().mockImplementation(async (url: string) =>
        String(url).includes("maptiler") ? Response.json({ features: [] }) : new Response("", { status: 406 }),
      ),
    );
    render(<SearchScreen />);
    await userEvent.click(screen.getByRole("button", { name: "コンビニ" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("通信がうまくいかなかった");
    expect(screen.queryByText(/見つかりませんでした/)).not.toBeInTheDocument();
  });
});

describe("SearchScreen と HERE", () => {
  it("HERE のキーがあれば HERE の結果を出し、出所を表示する", async () => {
    env.publicEnv.maptilerKey = "KEY";
    const fetchMock = vi.fn().mockImplementation(async (url: string) =>
      String(url).startsWith("/api/here")
        ? Response.json({
            source: "here",
            places: [{ id: "here:1", name: "六角ace", address: "京都府京都市中京区", position: { lng: 135.762, lat: 35.007 } }],
          })
        : Response.json({ features: [] }),
    );
    vi.stubGlobal("fetch", fetchMock);
    render(<SearchScreen />);
    await userEvent.type(screen.getByRole("searchbox"), "六角ace{Enter}");
    expect(await screen.findByRole("link", { name: "六角aceへ行く" })).toBeInTheDocument();
    expect(screen.getByText("場所の情報 © HERE")).toBeInTheDocument();
    expect(String(fetchMock.mock.calls[0][0])).toMatch(/^\/api\/here\?q=/);
    // HERE で見つかったら MapTiler には聞かない
    expect(fetchMock.mock.calls.some(([u]) => String(u).includes("maptiler"))).toBe(false);
  });

  it("HERE が0件なら今までの検索にまかせる", async () => {
    const fetchMock = vi.fn().mockImplementation(async (url: string) =>
      String(url).startsWith("/api/here")
        ? Response.json({ source: "here", places: [] })
        : Response.json({ places: [{ id: "osm:node/1", name: "駅前カフェ", position: { lng: 139.76, lat: 35.68 } }] }),
    );
    vi.stubGlobal("fetch", fetchMock);
    render(<SearchScreen />);
    await userEvent.click(screen.getByRole("button", { name: "カフェ" }));
    expect(await screen.findByRole("link", { name: "駅前カフェへ行く" })).toBeInTheDocument();
    expect(screen.queryByText("場所の情報 © HERE")).not.toBeInTheDocument();
  });
});

describe("SearchScreen のお気に入り", () => {
  it("検索結果のハートでお気に入りに入れられる", async () => {
    stubFetch(
      vi.fn().mockImplementation(async () =>
        Response.json({ places: [{ id: "osm:node/1", name: "駅前カフェ", position: { lng: 139.76, lat: 35.68 } }] }),
      ),
    );
    render(<SearchScreen />);
    await userEvent.click(screen.getByRole("button", { name: "カフェ" }));
    await userEvent.click(await screen.findByRole("button", { name: "駅前カフェをお気に入りに入れる" }));
    expect(screen.getByRole("button", { name: "駅前カフェをお気に入りから外す" })).toHaveAttribute("aria-pressed", "true");
  });
});
