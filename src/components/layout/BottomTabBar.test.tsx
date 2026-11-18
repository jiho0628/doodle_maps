import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { BottomTabBar, isTabActive } from "./BottomTabBar";

const pathname = vi.hoisted(() => ({ current: "/" }));
vi.mock("next/navigation", () => ({ usePathname: () => pathname.current }));

describe("isTabActive", () => {
  it("地図タブは / のときだけ", () => {
    expect(isTabActive("/", "/")).toBe(true);
    expect(isTabActive("/favorites", "/")).toBe(false);
  });
  it("お気に入りタブは配下のページでも選択状態", () => {
    expect(isTabActive("/favorites", "/favorites")).toBe(true);
    expect(isTabActive("/favorites/edit", "/favorites")).toBe(true);
    expect(isTabActive("/favoritesX", "/favorites")).toBe(false);
  });
});

describe("BottomTabBar", () => {
  beforeEach(() => {
    pathname.current = "/";
  });

  it("タブは「地図」「お気に入り」の2つだけ", () => {
    render(<BottomTabBar />);
    const links = screen.getAllByRole("link");
    expect(links.map((l) => l.textContent)).toEqual(["地図", "お気に入り"]);
  });

  it("今いる画面のタブに aria-current が付く", () => {
    pathname.current = "/favorites";
    render(<BottomTabBar />);
    expect(screen.getByRole("link", { name: "お気に入り" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "地図" })).not.toHaveAttribute("aria-current");
  });
});
