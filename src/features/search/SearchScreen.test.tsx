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
    const fetchMock = vi.fn().mockResolvedValue(
      Response.json({
        elements: [{ type: "node", id: 1, lat: 35.6813, lon: 139.767, tags: { amenity: "cafe", name: "カフェ こもれび" } }],
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    render(<SearchScreen />);

    await userEvent.click(screen.getByRole("button", { name: "カフェ" }));

    expect(await screen.findByRole("heading", { name: "近くのカフェ" })).toBeInTheDocument();
    const link = await screen.findByRole("link", { name: "カフェ こもれびへ行く" });
    expect(link.getAttribute("href")).toMatch(/^\/navigate\?lng=139\.767&lat=35\.6813&name=/);
    expect(screen.getByRole("searchbox", { name: "場所をさがす" })).toHaveValue("カフェ");
    expect(String(fetchMock.mock.calls[0][0])).toContain("overpass");
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

  it("近くの検索が失敗したら、やさしいエラーを出す", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("", { status: 429 })));
    render(<SearchScreen />);
    await userEvent.click(screen.getByRole("button", { name: "トイレ" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("うまくさがせませんでした");
  });
});

describe("SearchScreen のお気に入り", () => {
  it("検索結果のハートでお気に入りに入れられる", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        Response.json({ elements: [{ type: "node", id: 1, lat: 35.68, lon: 139.76, tags: { name: "駅前カフェ" } }] }),
      ),
    );
    render(<SearchScreen />);
    await userEvent.click(screen.getByRole("button", { name: "カフェ" }));
    await userEvent.click(await screen.findByRole("button", { name: "駅前カフェをお気に入りに入れる" }));
    expect(screen.getByRole("button", { name: "駅前カフェをお気に入りから外す" })).toHaveAttribute("aria-pressed", "true");
  });
});
