import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { LocationState } from "./geolocationStore";
import type { HeadingState } from "./headingStore";

const state = vi.hoisted(() => ({
  location: { status: "ok", position: { lng: 139.7, lat: 35.6 }, accuracyM: 10, updatedAt: 1 } as LocationState,
  heading: { status: "needs-permission", heading: null } as HeadingState,
  requestCompassPermission: vi.fn(async () => true),
  retryLocation: vi.fn(),
}));

vi.mock("./hooks", () => ({
  useCurrentLocation: () => state.location,
  useHeading: () => state.heading,
  requestCompassPermission: state.requestCompassPermission,
  retryLocation: state.retryLocation,
}));
vi.mock("./UserLocationMarker", () => ({ UserLocationMarker: () => null }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), back: vi.fn() }) }));

const { LocationLayer } = await import("./LocationLayer");

beforeEach(() => {
  state.location = { status: "ok", position: { lng: 139.7, lat: 35.6 }, accuracyM: 10, updatedAt: 1 };
  state.heading = { status: "needs-permission", heading: null };
  state.requestCompassPermission.mockClear();
  state.retryLocation.mockClear();
});

describe("LocationLayer", () => {
  it("iPhone の初回は向きの案内カードを出し、「はい、出す」で許可を求めて二度と出さない", async () => {
    const { rerender } = render(<LocationLayer />);
    expect(screen.getByRole("dialog")).toHaveTextContent("向いている方向も");
    await userEvent.click(screen.getByRole("button", { name: "はい、出す" }));
    expect(state.requestCompassPermission).toHaveBeenCalledOnce();
    await act(async () => {});
    expect(window.localStorage.getItem("doodle_maps:compass.prompted")).toBe("true");
    expect(window.localStorage.getItem("doodle_maps:compass.enabled")).toBe("true");
    rerender(<LocationLayer />);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("「いまは出さない」でも二度と出さない", async () => {
    render(<LocationLayer />);
    await userEvent.click(screen.getByRole("button", { name: "いまは出さない" }));
    expect(state.requestCompassPermission).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("Android など許可のいらない端末ではカードを出さない", () => {
    state.heading = { status: "active", heading: 90 };
    render(<LocationLayer />);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("位置情報を拒否されたら案内を出し、とじても現在地ボタンでまた出せる", async () => {
    state.location = { status: "denied", position: null, accuracyM: null, updatedAt: null };
    render(<LocationLayer />);
    expect(screen.getByRole("alert")).toHaveTextContent("現在地が使えません");
    expect(screen.queryByRole("dialog")).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "とじる" }));
    expect(screen.queryByRole("alert")).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "現在地にもどる" }));
    expect(state.retryLocation).toHaveBeenCalled();
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });

  it("アバターを変えるボタンがある(カードがないとき)", () => {
    state.heading = { status: "active", heading: 0 };
    render(<LocationLayer />);
    expect(screen.getByRole("button", { name: /アバターをえらぶ/ })).toBeInTheDocument();
  });
});
