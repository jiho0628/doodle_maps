import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { STORAGE_PREFIX } from "@/lib/storage";
import { FavoritesScreen } from "./FavoritesScreen";
import { FavoriteToggleButton } from "./FavoriteToggleButton";
import { addFavorite, getFavorites } from "./store";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

function mockGeolocation(result: { lng: number; lat: number } | { code: 1 | 2 | 3 }) {
  const getCurrentPosition = vi.fn((ok: PositionCallback, ng: PositionErrorCallback) => {
    if ("code" in result) {
      ng({ code: result.code, PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3, message: "" } as GeolocationPositionError);
    } else {
      ok({ coords: { longitude: result.lng, latitude: result.lat } } as GeolocationPosition);
    }
  });
  Object.defineProperty(navigator, "geolocation", { configurable: true, value: { getCurrentPosition } });
}

beforeEach(() => push.mockReset());

describe("お気に入り画面", () => {
  it("空のときは案内を出す", () => {
    render(<FavoritesScreen />);
    expect(screen.getByText("まだ何も入っていません")).toBeInTheDocument();
  });

  it("いまいる場所に名前を付けて保存できる", async () => {
    mockGeolocation({ lng: 139.7, lat: 35.6 });
    const user = userEvent.setup();
    render(<FavoritesScreen />);

    await user.click(screen.getByRole("button", { name: "いまいる場所を保存" }));
    const dialog = screen.getByRole("dialog", { name: "この場所を保存します" });
    await user.type(within(dialog).getByLabelText("名前"), "おうち");
    await user.click(within(dialog).getByRole("button", { name: "おうち" })); // しるし
    await user.click(within(dialog).getByRole("button", { name: "保存する" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("「おうち」を保存しました。");
    expect(getFavorites()).toMatchObject([{ name: "おうち", icon: "home", position: { lng: 139.7, lat: 35.6 } }]);
    expect(screen.getByRole("list", { name: "お気に入りの一覧" })).toHaveTextContent("おうち");
  });

  it("位置情報が許可されていないと、やさしく案内する", async () => {
    mockGeolocation({ code: 1 });
    render(<FavoritesScreen />);
    await userEvent.click(screen.getByRole("button", { name: "いまいる場所を保存" }));
    expect(screen.getByRole("alert")).toHaveTextContent("許可がありません");
  });

  it("「行く」を1回押すとルート案内へ進む", async () => {
    addFavorite({ name: "学校", position: { lng: 139.71, lat: 35.62 }, address: "東京都品川区" });
    render(<FavoritesScreen />);
    await userEvent.click(screen.getByRole("button", { name: "学校へ行く" }));
    expect(push).toHaveBeenCalledTimes(1);
    const url = new URL(push.mock.calls[0][0], "http://x");
    expect(url.pathname).toBe("/navigate");
    expect(Object.fromEntries(url.searchParams)).toEqual({ lng: "139.71", lat: "35.62", name: "学校", address: "東京都品川区" });
  });

  it("名前を変えられる", async () => {
    addFavorite({ name: "学校", position: { lng: 139.71, lat: 35.62 } });
    const user = userEvent.setup();
    render(<FavoritesScreen />);
    await user.click(screen.getByRole("button", { name: /^学校.名前を変える/ }));
    await user.click(screen.getByRole("button", { name: "名前を変える" }));
    const input = screen.getByLabelText("名前");
    await user.clear(input);
    await user.type(input, "小学校");
    await user.click(screen.getByRole("button", { name: "変える" }));
    expect(getFavorites()[0].name).toBe("小学校");
    expect(screen.getByRole("list")).toHaveTextContent("小学校");
  });

  it("消すときは確認し、「やめる」なら消さない", async () => {
    addFavorite({ name: "カフェ", position: { lng: 139.72, lat: 35.63 } });
    const user = userEvent.setup();
    render(<FavoritesScreen />);

    await user.click(screen.getByRole("button", { name: /^カフェ.名前を変える/ }));
    await user.click(screen.getByRole("button", { name: "消す" }));
    let confirm = screen.getByRole("alertdialog", { name: "「カフェ」を消しますか？" });
    // 誤って消さないよう、最初は「やめる」が選ばれている
    expect(within(confirm).getByRole("button", { name: "やめる" })).toHaveFocus();
    await user.click(within(confirm).getByRole("button", { name: "やめる" }));
    expect(getFavorites()).toHaveLength(1);

    await user.click(screen.getByRole("button", { name: /^カフェ.名前を変える/ }));
    await user.click(screen.getByRole("button", { name: "消す" }));
    confirm = screen.getByRole("alertdialog");
    await user.click(within(confirm).getByRole("button", { name: "消す" }));
    expect(getFavorites()).toHaveLength(0);
    expect(screen.getByText("まだ何も入っていません")).toBeInTheDocument();
  });

  it("別の画面で追加されたお気に入りもすぐ出る", () => {
    render(<FavoritesScreen />);
    act(() => {
      addFavorite({ name: "駅", position: { lng: 139.73, lat: 35.64 } });
    });
    expect(screen.getByRole("list")).toHaveTextContent("駅");
  });
});

describe("FavoriteToggleButton", () => {
  it("押すたびにお気に入りへ入れる/外すを切り替える", async () => {
    const place = { id: "p1", name: "図書館", position: { lng: 139.74, lat: 35.65 } };
    const user = userEvent.setup();
    render(<FavoriteToggleButton place={place} />);
    await user.click(screen.getByRole("button", { name: "図書館をお気に入りに入れる" }));
    expect(getFavorites()).toHaveLength(1);
    const btn = screen.getByRole("button", { name: "図書館をお気に入りから外す" });
    expect(btn).toHaveAttribute("aria-pressed", "true");
    await user.click(btn);
    expect(window.localStorage.getItem(STORAGE_PREFIX + "favorites")).toBe("[]");
  });
});
