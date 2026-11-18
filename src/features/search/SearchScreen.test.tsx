import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

const env = vi.hoisted(() => ({ publicEnv: { maptilerKey: "", maptilerStyle: "streets-v2" } }));
vi.mock("@/lib/config/env", () => env);

import { SearchScreen } from "./SearchScreen";

afterEach(() => {
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
    const fetchMock = vi.fn().mockResolvedValue(
      Response.json({
        features: [{ id: "1", text: "東京駅", place_name: "東京駅, 千代田区, 東京都, 日本", center: [139.767, 35.681] }],
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    render(<SearchScreen />);

    await userEvent.type(screen.getByRole("searchbox"), "東京駅{Enter}");

    const list = await screen.findByRole("list");
    expect(within(list).getByText("東京駅")).toBeInTheDocument();
    expect(within(list).getByText("東京都 千代田区")).toBeInTheDocument();
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
    const fetchMock = vi.fn().mockImplementation(async () =>
      Response.json({ places: [{ id: "osm:node/7", name: "ローソン 丸の内店", position: { lng: 139.767, lat: 35.681 } }] }),
    );
    vi.stubGlobal("fetch", fetchMock);
    render(<SearchScreen />);

    await userEvent.type(screen.getByRole("searchbox"), "近くのコンビニ{Enter}");

    expect(await screen.findByRole("heading", { name: "近くのコンビニ" })).toBeInTheDocument();
    expect(await screen.findByText("ローソン 丸の内店")).toBeInTheDocument();
    expect(String(fetchMock.mock.calls[0][0])).toContain("/api/nearby?category=convenience");
    expect(fetchMock.mock.calls.some(([u]) => String(u).includes("maptiler"))).toBe(false);
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

  it("近くの検索が失敗したら、やさしいエラーを出す", async () => {
    vi.stubGlobal("fetch", vi.fn().mockImplementation(async () => new Response("", { status: 429 })));
    render(<SearchScreen />);
    await userEvent.click(screen.getByRole("button", { name: "トイレ" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("うまくさがせませんでした");
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
