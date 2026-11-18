import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

const env = vi.hoisted(() => ({ publicEnv: { maptilerKey: "", maptilerStyle: "streets-v2" } }));
vi.mock("@/lib/config/env", () => env);

import { SearchScreen } from "./SearchScreen";
import { clearNearbyCache } from "./nearby";

afterEach(() => {
  clearNearbyCache();
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
    vi.stubGlobal("fetch", fetchMock);
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
    vi.stubGlobal("fetch", fetchMock);
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
    vi.stubGlobal("fetch", fetchMock);
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
    vi.stubGlobal("fetch", fetchMock);
    render(<SearchScreen />);

    await userEvent.type(screen.getByRole("searchbox"), "近くのコンビニ{Enter}");

    expect(await screen.findByRole("heading", { name: "近くのコンビニ" })).toBeInTheDocument();
    expect(await screen.findByText("ローソン 丸の内店")).toBeInTheDocument();
    expect(String(fetchMock.mock.calls[0][0])).toContain("/api/nearby?category=convenience");
    // 店名としての「コンビニ」では検索しない
    expect(fetchMock.mock.calls.some(([u]) => String(u).includes(encodeURIComponent("近くのコンビニ")))).toBe(false);
  });

  it("サーバーがだめならブラウザから Overpass に聞く", async () => {
    const fetchMock = vi.fn().mockImplementation(async (url: string) =>
      String(url).startsWith("/api/")
        ? new Response("", { status: 502 })
        : Response.json({ elements: [{ type: "node", id: 3, lat: 35.68, lon: 139.76, tags: { name: "駅" } }] }),
    );
    vi.stubGlobal("fetch", fetchMock);
    render(<SearchScreen />);
    await userEvent.click(screen.getByRole("button", { name: "駅" }));
    expect(await screen.findByRole("link", { name: "駅へ行く" })).toBeInTheDocument();
    expect(String(fetchMock.mock.calls[1][0])).toContain("overpass");
  });

  it("OpenStreetMap が遅いときは MapTiler の近くの結果を先に出す", async () => {
    env.publicEnv.maptilerKey = "KEY";
    vi.stubGlobal(
      "fetch",
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
    vi.stubGlobal(
      "fetch",
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
    vi.stubGlobal(
      "fetch",
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

describe("SearchScreen のお気に入り", () => {
  it("検索結果のハートでお気に入りに入れられる", async () => {
    vi.stubGlobal(
      "fetch",
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
