import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { STORAGE_PREFIX } from "@/lib/storage";
import { AvatarScreen } from "./AvatarScreen";

const router = { push: vi.fn(), back: vi.fn(), replace: vi.fn(), refresh: vi.fn(), prefetch: vi.fn(), forward: vi.fn() };
vi.mock("next/navigation", () => ({ useRouter: () => router }));

const KEY = STORAGE_PREFIX + "avatar";

describe("AvatarScreen", () => {
  beforeEach(() => vi.clearAllMocks());

  it("最初はうさぎが選ばれている", () => {
    render(<AvatarScreen />);
    expect(screen.getByRole("button", { name: "うさぎ" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("img", { name: "えらんだアバター：うさぎ" })).toBeInTheDocument();
  });

  it("くまを選んで「この子にする」で保存し、地図へもどる", async () => {
    const user = userEvent.setup();
    render(<AvatarScreen />);
    await user.click(screen.getByRole("button", { name: "くま" }));
    expect(screen.getByRole("button", { name: "くま" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "うさぎ" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("img", { name: "えらんだアバター：くま" })).toBeInTheDocument();
    // 押すまでは保存しない
    expect(window.localStorage.getItem(KEY)).toBeNull();

    await user.click(screen.getByRole("button", { name: "この子にする" }));
    expect(JSON.parse(window.localStorage.getItem(KEY)!)).toEqual({ kind: "animal", animal: "bear" });
    expect(router.push).toHaveBeenCalledWith("/");
  });

  it("保存済みのアバターが選ばれた状態で開く", async () => {
    window.localStorage.setItem(KEY, JSON.stringify({ kind: "animal", animal: "penguin" }));
    render(<AvatarScreen />);
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "ペンギン" })).toHaveAttribute("aria-pressed", "true"),
    );
  });

  it("保存できないときはやさしいメッセージを出して、画面にとどまる", async () => {
    const user = userEvent.setup();
    const spy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("full", "QuotaExceededError");
    });
    render(<AvatarScreen />);
    await user.click(screen.getByRole("button", { name: "ねこ" }));
    await user.click(screen.getByRole("button", { name: "この子にする" }));
    expect(screen.getByRole("alert")).toHaveTextContent("保存できませんでした");
    expect(router.push).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it("もどるボタンがある", async () => {
    const user = userEvent.setup();
    render(<AvatarScreen />);
    await user.click(screen.getByRole("button", { name: "もどる" }));
    expect(router.back.mock.calls.length + router.push.mock.calls.length).toBe(1);
  });
});
